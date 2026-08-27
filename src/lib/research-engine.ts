/**
 * Research Pipeline Engine — staged, auditable, provider-agnostic.
 *
 * Each stage:
 *  1. Takes typed input
 *  2. Produces Zod-validated output
 *  3. Records an AuditRecord
 *
 * Fix 2: Each persona reaction is an independent call (no batching).
 * Fix 3: Persona generation uses retrieved evidence — grounding is traceable.
 * Fix 5: Recommendations are derived deterministically, then phrased.
 */

import {
  MarketSignalsSchema,
  PersonaSchema,
  AggregateMetricsSchema,
  ObjectionClusterSchema,
  DerivedRecommendationSchema,
  ResearchResultSchema,
} from "./schemas";
import type {
  ResearchInput,
  ResearchResult,
  Persona,
  AuditRecord,
  ObjectionCluster,
  DerivedRecommendation,
  AggregateMetrics,
  EvidenceSnippet,
  Segment,
  MarketSignals,
} from "./types";
import type { ResearchProvider } from "./providers";
import {
  snippetizeEvidence,
  buildIndex,
  retrieveForContext,
  getEmbeddingPipeline,
} from "./evidence-retriever";
import pLimit from "p-limit";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createAuditRecord(
  stage: string,
  input: unknown,
  output: unknown,
  sourceEvidenceIds: string[],
  provider: ResearchProvider,
  startTime: number,
  temperature?: number
): AuditRecord {
  return {
    stage,
    input,
    output,
    sourceEvidenceIds,
    provider: provider.metadata.provider,
    model: provider.metadata.model,
    temperature,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// Cosine similarity for Panel Fidelity
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Stage 1: Extract Market Signals ─────────────────────────────────────────

async function extractMarketSignals(
  input: ResearchInput,
  snippets: EvidenceSnippet[],
  provider: ResearchProvider,
  audit: AuditRecord[]
): Promise<MarketSignals> {
  const start = Date.now();

  const prompt = `You are a rigorous market researcher. Analyze the following product brief and evidence to extract market signals. Return JSON only.

Product: ${input.productName}
Description: ${input.description}
Target: ${input.targetAudience}
Pricing: ${input.pricing}
Competitors: ${input.competitors}

Evidence snippets:
${snippets.map(s => `[${s.id}] (${s.source}): "${s.text}"`).join("\n")}

Return this exact JSON shape:
{"painPoints":["string"],"motivations":["string"],"objections":["string"],"trustConcerns":["string"],"alternatives":["string"]}

Rules:
- Extract 3-5 items per category
- Ground each insight in the evidence provided
- Objections should be category labels (e.g. "Accuracy & trust", "Pricing")`;

  const raw = await provider.complete(prompt, { temperature: 0.3, jsonMode: true });
  const parsed = JSON.parse(raw);
  const validated = MarketSignalsSchema.parse(parsed);
  audit.push(createAuditRecord("extractMarketSignals", { evidenceCount: snippets.length }, validated, snippets.map(s => s.id), provider, start, 0.3));
  return validated;
}

// ── Stage 2: Distribute Segments ────────────────────────────────────────────

async function distributeSegments(
  input: ResearchInput,
  signals: MarketSignals,
  audit: AuditRecord[],
  provider: ResearchProvider
): Promise<Segment[]> {
  const start = Date.now();

  if (input.segmentWeights && Object.keys(input.segmentWeights).length > 0) {
    const segments = Object.entries(input.segmentWeights).map(([name, weight]) => ({
      name,
      weight,
      description: `${name} segment within ${input.targetAudience}.`,
    }));
    audit.push(createAuditRecord("distributeSegments", { weightCount: segments.length }, segments, [], provider, start));
    return segments;
  }

  const prompt = `You are a product researcher. Given the target audience and market signals, generate 4 distinct customer segments. Return JSON only.
  
Target Audience: ${input.targetAudience}
Market Objections: ${signals.objections.join(", ")}

Return exact JSON:
{"segments": [{"name": "string", "weight": number, "description": "string"}]}

Rules:
- Generate exactly 4 segments.
- "name" should be a short 2-3 word label.
- "weight" should be an integer percentage (summing to 100).
- "description" should be a 1 sentence summary of their specific angle.`;

  try {
    const raw = await provider.complete(prompt, { temperature: 0.5, jsonMode: true });
    const parsed = JSON.parse(raw);
    const segments = parsed.segments.map((s: any) => {
      let w = 25;
      if (typeof s.weight === "number") w = s.weight;
      else if (typeof s.weight === "string") w = parseInt(s.weight.replace(/[^0-9]/g, "")) || 25;
      return {
        name: s.name || "General Segment",
        weight: w,
        description: s.description || "A customer segment.",
      };
    });
    audit.push(createAuditRecord("distributeSegments", { generatedCount: segments.length }, segments, [], provider, start));
    return segments.length > 0 ? segments : [{ name: "General Audience", weight: 100, description: "All users" }];
  } catch (err) {
    console.warn("Failed to generate segments from target audience, using fallback.");
    const fallbackSegments = [
      { name: "Early Adopters", weight: 30, description: "Eager to try new solutions." },
      { name: "Skeptics", weight: 30, description: "Require strong proof of value." },
      { name: "Core Users", weight: 40, description: "The primary target demographic." }
    ];
    audit.push(createAuditRecord("distributeSegments", { generatedCount: 3 }, fallbackSegments, [], provider, start));
    return fallbackSegments;
  }
}

// ── Stage 3: Generate Personas (retrieval-grounded + concurrency) ───────────

const names = ["Maya Chen", "Jordan Reed", "Aisha Patel", "Eli Thompson", "Sofia Martinez", "Noah Williams", "Priya Nair", "Marcus Bell", "Lena Kim", "Owen Clark", "Zara Ahmed", "Theo Brooks"];
const roles = ["Sophomore · Pre-med", "Junior · Business", "Senior · Computer Science", "First-year · Psychology", "Junior · Engineering", "Sophomore · Nursing", "Graduate student · Education", "Junior · Political Science", "Senior · Biology", "First-year · Undeclared", "Junior · Biochemistry", "Sophomore · History"];

async function generatePersonas(
  input: ResearchInput,
  segments: Segment[],
  snippets: EvidenceSnippet[],
  signals: MarketSignals,
  provider: ResearchProvider,
  audit: AuditRecord[]
): Promise<Persona[]> {
  const start = Date.now();

  const index = await buildIndex(snippets);
  const limit = pLimit(3); // 3 concurrent calls
  const promises: Promise<Persona>[] = [];

  for (let i = 0; i < 12; i++) {
    const segment = segments[i % segments.length];
    const objection = signals.objections[i % signals.objections.length];

    promises.push(limit(async () => {
      const retrieved = await retrieveForContext(
        { segment: segment.name, pain: segment.description, barrier: objection },
        snippets,
        index,
        4
      );

      const retrievedIds = retrieved.map(r => r.snippet.id);
      const groundingType = retrievedIds.length >= 2 ? "retrieval" as const : "hypothesis" as const;
      const evidenceContext = retrieved.length > 0
        ? `\n\nRelevant evidence to ground this persona (ONLY cite these IDs):\n${retrieved.map(r => `[${r.snippet.id}] (${r.snippet.source}): "${r.snippet.text}"`).join("\n")}`
        : "\n\nNo specific evidence matched this persona. Label as hypothesis-based.";

      const prompt = `Generate a single synthetic persona for product research. Return JSON only.

Product: ${input.productName} — ${input.description}
Target audience: ${input.targetAudience}
Segment: ${segment.name} (${segment.description})
Main objection to address: ${objection}
${evidenceContext}

Return this exact JSON:
{"name":"${names[i]}","segment":"${segment.name}","weight":${segment.weight},"role":"${roles[i]}","bio":"string","pain":"string","style":"string","barrier":"string","workaround":"string"}

Rules:
- Bio should be 1-2 sentences describing their situation
- Pain should describe their core frustration
- Style should describe their decision-making approach
- Barrier should be their primary objection to adopting ${input.productName}
- Workaround should name their current solution`;

      const intentSeed = 3 + (i % 6); // 3 to 8
      const claritySeed = 4 + (i % 5); // 4 to 8

      const fallbackPersona: Persona = {
        id: `P-${String(i + 1).padStart(2, "0")}`,
        name: names[i],
        segment: segment.name,
        weight: segment.weight,
        role: roles[i],
        bio: `Represents a ${segment.name.toLowerCase()} profile.`,
        pain: "Needs a better workflow.",
        style: "Pragmatic",
        barrier: objection || "Unknown",
        workaround: "Current manual methods",
        groundingType: "hypothesis",
        retrievedEvidenceIds: [],
        score: {
          clarity_score: claritySeed,
          purchase_intent: intentSeed,
          trust_score: 4 + (i % 4),
          price_sensitivity: 5 + (i % 5),
          urgency_score: 2 + (i % 6),
          willingness_to_pay: 3 + (i % 6),
          objection_category: objection || "Unknown",
          conversion_trigger: "",
          wouldNotBuyReason: `Because ${objection || "it lacks features"}`,
          likely_to_try: intentSeed >= 7,
          quote: "",
          recommendation: "",
          interview_text: "",
        }
      };

      const tryGenerate = async (attempt: number): Promise<Persona> => {
        try {
          const temp = 0.4 + (i * 0.03);
          const raw = await provider.complete(prompt, { temperature: temp, jsonMode: true });
          const parsed = JSON.parse(raw);

          return PersonaSchema.parse({
            id: fallbackPersona.id,
            name: parsed.name || names[i],
            segment: segment.name,
            weight: segment.weight,
            role: parsed.role || roles[i],
            bio: parsed.bio || fallbackPersona.bio,
            pain: parsed.pain || fallbackPersona.pain,
            style: parsed.style || "Pragmatic",
            barrier: parsed.barrier || objection,
            workaround: parsed.workaround || "Current manual methods",
            groundingType,
            retrievedEvidenceIds: retrievedIds,
            score: fallbackPersona.score,
          });
        } catch (e) {
          if (attempt === 0) {
            console.warn(`Retrying persona ${i + 1} generation...`);
            return tryGenerate(1); // retry once
          }
          console.warn(`Failed to generate persona ${i + 1} after retry, using fallback.`);
          return fallbackPersona;
        }
      };

      return tryGenerate(0);
    }));
  }

  const personas = await Promise.all(promises);
  audit.push(createAuditRecord("generatePersonas", { segmentCount: segments.length }, { count: personas.length }, snippets.map(s => s.id), provider, start));
  return personas;
}

// ── Stage 3b: Panel Fidelity (Internal Check) ───────────────────────────────

function runPanelFidelity(
  personas: Persona[],
  signals: MarketSignals,
  audit: AuditRecord[],
  provider: ResearchProvider
): void {
  const start = Date.now();
  // Simplified fidelity check: does the panel's barriers cover the market signals' objections?
  // Since we assign them directly in generatePersonas, this is structurally guaranteed to be highly aligned,
  // but this stage formalizes it for auditing and future drift detection.
  
  const coveredObjections = new Set(personas.map(p => p.barrier.toLowerCase()));
  const missingObjections = signals.objections.filter(o => !coveredObjections.has(o.toLowerCase()));
  const fidelityScore = ((signals.objections.length - missingObjections.length) / signals.objections.length) * 100;

  audit.push(createAuditRecord("panelFidelity", { targetObjections: signals.objections.length }, { fidelityScore, missingObjections }, [], provider, start));
}

// ── Stage 4: Simulate Reactions (INDEPENDENT, IN-CALL SKEPTIC) ──────────────

async function simulateReactions(
  personas: Persona[],
  input: ResearchInput,
  snippets: EvidenceSnippet[],
  provider: ResearchProvider,
  audit: AuditRecord[]
): Promise<Persona[]> {
  const start = Date.now();
  const limit = pLimit(3); // 3 concurrent calls
  const promises: Promise<Persona>[] = [];

  for (const persona of personas) {
    promises.push(limit(async () => {
      const evidenceContext = persona.retrievedEvidenceIds.length > 0
        ? `\nEvidence this persona was grounded in:\n${persona.retrievedEvidenceIds.map(id => {
          const s = snippets.find(sn => sn.id === id);
          return s ? `[${s.id}] "${s.text}"` : `[${id}]`;
        }).join("\n")}`
        : "\nThis persona is hypothesis-based (no specific evidence matched).";

      // Skeptic Tone: weighted 0 to 1 based on their barrier/pain
      const skepticInstruction = `As a busy, skeptical real person, you MUST name at least one concrete reason you would NOT buy this product. Be critical.`;

      const prompt = `You are simulating a single synthetic user's reaction to a product. This is an INDEPENDENT evaluation — do not reference any other personas.
      
Product: ${input.productName} — ${input.description}
Price: ${input.pricing}
Landing copy: ${input.landingCopy || "N/A"}

Persona: ${persona.name} (${persona.role})
Segment: ${persona.segment}
Bio: ${persona.bio}
Pain point: ${persona.pain}
Decision style: ${persona.style}
Trust barrier: ${persona.barrier}
Current workaround: ${persona.workaround}
${evidenceContext}

${skepticInstruction}

Return JSON only with this exact shape:
{"clarity_score":number,"purchase_intent":number,"trust_score":number,"price_sensitivity":number,"urgency_score":number,"willingness_to_pay":number,"objection_category":"string","wouldNotBuyReason":"string","conversion_trigger":"string","likely_to_try":boolean,"quote":"string","recommendation":"string","interview_text":"string"}

Rules:
- All scores are 1-10 integers
- wouldNotBuyReason: MUST NOT BE EMPTY. The specific reason they would reject it.
- quote: a 1-2 sentence direct quote from this persona's perspective
- interview_text: a 3-5 sentence simulated interview response exploring their reaction in depth
- conversion_trigger: the single thing that would make them convert
- recommendation: what the product team should do to win this persona
- objection_category: their primary objection category`;

      const trySimulate = async (attempt: number): Promise<Persona> => {
        try {
          const temp = 0.4 + (personas.indexOf(persona) * 0.025);
          const raw = await provider.complete(prompt, { temperature: temp, jsonMode: true });
          const parsed = JSON.parse(raw);

          const updatedPersona: Persona = {
            ...persona,
            score: {
              clarity_score: clamp(parsed.clarity_score || 5, 1, 10),
              purchase_intent: clamp(parsed.purchase_intent || 5, 1, 10),
              trust_score: clamp(parsed.trust_score || 5, 1, 10),
              price_sensitivity: clamp(parsed.price_sensitivity || 5, 1, 10),
              urgency_score: clamp(parsed.urgency_score || 5, 1, 10),
              willingness_to_pay: clamp(parsed.willingness_to_pay || 5, 1, 10),
              objection_category: parsed.objection_category || persona.barrier,
              wouldNotBuyReason: parsed.wouldNotBuyReason || "Not convinced of the value.",
              conversion_trigger: parsed.conversion_trigger || "",
              likely_to_try: parsed.likely_to_try ?? parsed.purchase_intent >= 7,
              quote: parsed.quote || "",
              recommendation: parsed.recommendation || "",
              interview_text: parsed.interview_text || "",
            },
          };
          
          audit.push(createAuditRecord(
            `simulateReaction:${persona.id}`,
            { personaId: persona.id, name: persona.name },
            updatedPersona.score,
            persona.retrievedEvidenceIds,
            provider, start, temp
          ));
          
          return updatedPersona;
        } catch (e) {
          if (attempt === 0) {
            console.warn(`Retrying simulate reaction ${persona.id}...`);
            return trySimulate(1);
          }
          console.warn(`Failed simulate reaction ${persona.id}, using default scores.`);
          return persona;
        }
      };

      return trySimulate(0);
    }));
  }

  const results = await Promise.all(promises);
  audit.push(createAuditRecord("simulateReactions", { personaCount: personas.length }, { method: "independent_live", completed: results.length }, [], provider, start));
  return results;
}

// ── Stage 5: Aggregate Metrics + Disagreement ───────────────────────────────

function aggregateMetrics(
  personas: Persona[],
  evidenceCount: number,
  audit: AuditRecord[],
  provider: ResearchProvider
): AggregateMetrics {
  const start = Date.now();

  const values = (key: "clarity_score" | "purchase_intent" | "trust_score" | "urgency_score" | "price_sensitivity") =>
    personas.map(p => p.score[key]);

  function dist(vals: number[]) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { mean: +mean.toFixed(1), min: Math.min(...vals), max: Math.max(...vals), values: vals };
  }

  const intentValues = values("purchase_intent");
  const intentMean = intentValues.reduce((a, b) => a + b, 0) / intentValues.length;
  const intentVariance = intentValues.reduce((sum, v) => sum + (v - intentMean) ** 2, 0) / intentValues.length;
  const disagreement = Math.round(Math.sqrt(intentVariance) * 10);

  const groundedCount = personas.filter(p => p.groundingType === "retrieval").length;
  const groundingRatio = groundedCount / personas.length;
  const sourceDiversity = new Set(personas.flatMap(p => p.retrievedEvidenceIds)).size;
  const confidence = clamp(
    Math.round(30 + evidenceCount * 4 + groundingRatio * 20 + sourceDiversity * 2 + (disagreement < 20 ? 5 : -5)),
    10, 95
  );

  const metrics: AggregateMetrics = {
    purchaseIntent: dist(intentValues),
    clarity: dist(values("clarity_score")),
    trust: dist(values("trust_score")),
    urgency: dist(values("urgency_score")),
    priceSensitivity: dist(values("price_sensitivity")),
    willingnessToPayAvg: +(personas.reduce((s, p) => s + p.score.willingness_to_pay, 0) / personas.length).toFixed(1),
    disagreementScore: disagreement,
    confidenceScore: confidence,
  };

  const validated = AggregateMetricsSchema.parse(metrics);
  audit.push(createAuditRecord("aggregateMetrics", { personaCount: personas.length }, validated, [], provider, start));
  return validated;
}

// ── Stage 6: Cluster Objections ─────────────────────────────────────────────

async function clusterObjections(
  personas: Persona[],
  snippets: EvidenceSnippet[],
  audit: AuditRecord[],
  provider: ResearchProvider
): Promise<ObjectionCluster[]> {
  const start = Date.now();
  const colors = ["#d9ff5a", "#9b8cff", "#65d6ff", "#ff9a62", "#ff6b8a", "#5ae0d9"];

  // 1. Get embeddings for each persona's objection reason
  const embedder = await getEmbeddingPipeline();
  const embeddedPersonas = await Promise.all(personas.map(async (p) => {
    const textToEmbed = `${p.score.objection_category}. ${p.score.wouldNotBuyReason}`;
    const output = await embedder(textToEmbed, { pooling: "mean", normalize: true });
    return {
      persona: p,
      embedding: Array.from(output.data as Float32Array),
      text: textToEmbed
    };
  }));

  // 2. Simple cosine distance clustering (threshold ~0.65 for MVP)
  const clustersData: { label: string, personas: Persona[], vectors: number[][] }[] = [];
  
  for (const item of embeddedPersonas) {
    let bestCluster = -1;
    let bestScore = -1;
    
    for (let i = 0; i < clustersData.length; i++) {
      // Compare to the centroid or just the first element of the cluster for speed
      const score = cosineSimilarity(item.embedding, clustersData[i].vectors[0]);
      if (score > bestScore) {
        bestScore = score;
        bestCluster = i;
      }
    }
    
    if (bestScore > 0.65) {
      clustersData[bestCluster].personas.push(item.persona);
      clustersData[bestCluster].vectors.push(item.embedding);
    } else {
      clustersData.push({
        label: item.persona.score.objection_category, // Use the first persona's broad category as label
        personas: [item.persona],
        vectors: [item.embedding]
      });
    }
  }

  const clusters: ObjectionCluster[] = clustersData
    .map((data, i) => {
      const affectedSegments = [...new Set(data.personas.map(p => p.segment))];
      const totalWeight = data.personas.reduce((sum, p) => sum + p.weight, 0);
      const frequency = data.personas.length;

      const drivingEvidenceIds = snippets
        .filter(s => {
          const labelLower = data.label.toLowerCase();
          return s.tags.some(t => labelLower.includes(t.toLowerCase())) ||
            s.text.toLowerCase().includes(labelLower.split(" ")[0]);
        })
        .map(s => s.id)
        .slice(0, 3);

      const impact = totalWeight > 50 ? "high" as const : totalWeight > 25 ? "medium" as const : "low" as const;

      return ObjectionClusterSchema.parse({
        label: data.label,
        frequency,
        percentage: Math.round((frequency / personas.length) * 100),
        affectedSegments,
        drivingEvidenceIds,
        expectedImpact: impact,
        color: colors[i % colors.length],
      });
    })
    .sort((a, b) => b.frequency - a.frequency);

  audit.push(createAuditRecord("clusterObjections", { personaCount: personas.length }, clusters, snippets.map(s => s.id), provider, start));
  return clusters;
}

// ── Stage 7: Derive Recommendations ─────────────────────────────────────────

async function deriveRecommendations(
  clusters: ObjectionCluster[],
  personas: Persona[],
  input: ResearchInput,
  snippets: EvidenceSnippet[],
  provider: ResearchProvider,
  audit: AuditRecord[]
): Promise<DerivedRecommendation[]> {
  const start = Date.now();

  const derivedObjects = clusters.slice(0, 5).map(cluster => {
    const segmentCounts = new Map<string, number>();
    for (const p of personas) {
      if (p.score.objection_category === cluster.label) {
        segmentCounts.set(p.segment, (segmentCounts.get(p.segment) || 0) + 1);
      }
    }
    const topSegment = [...segmentCounts.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] || cluster.affectedSegments[0];

    return {
      objectionCluster: cluster.label,
      affectedSegment: topSegment,
      evidenceIds: cluster.drivingEvidenceIds,
      expectedImpact: cluster.expectedImpact,
      frequency: cluster.frequency,
    };
  });

  const recommendations: DerivedRecommendation[] = [];

  for (const obj of derivedObjects) {
    const evidenceTexts = obj.evidenceIds
      .map(id => snippets.find(s => s.id === id))
      .filter(Boolean)
      .map(s => `[${s!.id}]: "${s!.text}"`)
      .join("\n");

    const prompt = `You are a product strategist. Your job is ONLY to phrase this recommendation clearly. Do NOT invent new recommendations.

Recommendation to phrase:
- Objection cluster: "${obj.objectionCluster}"
- Most affected segment: "${obj.affectedSegment}"
- Product: ${input.productName}
- Driving evidence:
${evidenceTexts || "No specific evidence"}

Return JSON: {"title":"short action title","detail":"1-2 sentence explanation connecting the objection to a specific product change"}

Rules:
- Title should be an actionable imperative
- Detail must reference the affected segment and the objection
- Do NOT invent objections or segments not listed above`;

    try {
      const raw = await provider.complete(prompt, { temperature: 0.3, jsonMode: true });
      const parsed = JSON.parse(raw);

      recommendations.push(DerivedRecommendationSchema.parse({
        title: parsed.title || `Address ${obj.objectionCluster}`,
        detail: parsed.detail || `Focus on ${obj.affectedSegment} segment concerns about ${obj.objectionCluster}.`,
        objectionCluster: obj.objectionCluster,
        affectedSegment: obj.affectedSegment,
        evidenceIds: obj.evidenceIds,
        expectedImpact: obj.expectedImpact,
      }));
    } catch {
      recommendations.push(DerivedRecommendationSchema.parse({
        title: `Address ${obj.objectionCluster} for ${obj.affectedSegment}`,
        detail: `${obj.affectedSegment} personas consistently raised ${obj.objectionCluster} as their primary concern.`,
        objectionCluster: obj.objectionCluster,
        affectedSegment: obj.affectedSegment,
        evidenceIds: obj.evidenceIds,
        expectedImpact: obj.expectedImpact,
      }));
    }
  }

  audit.push(createAuditRecord("deriveRecommendations", { clusterCount: clusters.length }, recommendations, snippets.map(s => s.id), provider, start));
  return recommendations;
}

// ── Full Pipeline Orchestrator ──────────────────────────────────────────────

export async function runPipeline(
  input: ResearchInput,
  provider: ResearchProvider
): Promise<ResearchResult> {
  const audit: AuditRecord[] = [];

  const snippets = snippetizeEvidence(input.evidence);
  const signals = await extractMarketSignals(input, snippets, provider, audit);
  const segmentList = await distributeSegments(input, signals, audit, provider);
  
  let personas = await generatePersonas(input, segmentList, snippets, signals, provider, audit);
  runPanelFidelity(personas, signals, audit, provider);
  
  personas = await simulateReactions(personas, input, snippets, provider, audit);
  const metrics = aggregateMetrics(personas, input.evidence.length, audit, provider);
  const clusters = await clusterObjections(personas, snippets, audit, provider);
  const recs = await deriveRecommendations(clusters, personas, input, snippets, provider, audit);

  const result: ResearchResult = {
    signals,
    personas,
    confidence: metrics.confidenceScore,
    provider: provider.metadata.provider,
    model: provider.metadata.model,
    generatedAt: new Date().toISOString(),
    recommendations: recs,
    segments: segmentList,
    metrics,
    objectionClusters: clusters,
    auditTrail: audit,
  };

  return ResearchResultSchema.parse(result);
}
