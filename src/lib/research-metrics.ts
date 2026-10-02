import { AggregateMetricsSchema, ObjectionClusterSchema, SegmentDistributionSchema } from "./schemas";
import type { AggregateMetrics, Persona, Segment, ObjectionCluster } from "./types";
import { lexicalSimilarity } from "./evidence-retriever";

/** Normalize arbitrary positive ratios; the last segment absorbs rounding drift. */
export function normalizeSegments(segments: Segment[]): Segment[] {
  const active = SegmentDistributionSchema.parse({ segments }).segments.filter(s => s.weight > 0);
  const total = active.reduce((sum, s) => sum + s.weight, 0);
  let assigned = 0;
  return active.map((s, i) => {
    const weight = i === active.length - 1 ? +(100 - assigned).toFixed(6) : +(s.weight / total * 100).toFixed(6);
    assigned += weight;
    return { ...s, name: s.name.trim(), weight };
  });
}

/** Ensure every active segment is represented, then apportion remaining seats. */
export function allocatePanel(segments: Segment[], size = 12): Segment[] {
  if (size < segments.length) throw new Error("Panel size must cover every active segment.");
  const counts = segments.map(() => 1);
  for (let n = segments.length; n < size; n++) {
    const next = segments.map((s, i) => ({ i, deficit: s.weight / 100 * size - counts[i] }))
      .sort((a, b) => b.deficit - a.deficit || a.i - b.i)[0].i;
    counts[next]++;
  }
  return segments.flatMap((segment, i) => Array.from({ length: counts[i] }, () => ({
    ...segment, weight: segment.weight / counts[i],
  })));
}

export function aggregateMetrics(personas: Persona[]): AggregateMetrics {
  const valid = personas.filter(p => !p.degraded && p.weight > 0);
  const mass = valid.reduce((sum, p) => sum + p.weight, 0);
  const panelMass = personas.reduce((sum, p) => sum + p.weight, 0);
  const mean = (key: keyof Persona["score"]) => mass ? valid.reduce((sum, p) => sum + Number(p.score[key]) * p.weight, 0) / mass : 0;
  const distribution = (key: keyof Persona["score"]) => {
    const values = valid.map(p => Number(p.score[key]));
    return { mean: +mean(key).toFixed(1), min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0, values };
  };
  const intent = mean("purchase_intent");
  const variance = mass ? valid.reduce((sum, p) => sum + p.weight * (p.score.purchase_intent - intent) ** 2, 0) / mass : 0;
  const groundedMass = valid.filter(p => p.groundingType === "retrieval" && p.retrievedEvidenceIds.length).reduce((sum, p) => sum + p.weight, 0);
  return AggregateMetricsSchema.parse({
    purchaseIntent: distribution("purchase_intent"), clarity: distribution("clarity_score"),
    trust: distribution("trust_score"), urgency: distribution("urgency_score"),
    priceSensitivity: distribution("price_sensitivity"), willingnessToPayAvg: +mean("willingness_to_pay").toFixed(1),
    disagreementScore: Math.min(100, Math.round(Math.sqrt(variance) / 4.5 * 100)),
    evidenceCoverage: panelMass ? Math.round(groundedMass / panelMass * 100) : 0,
    degradedCount: personas.length - valid.length, totalPersonaCount: personas.length,
  });
}

/** Deterministic membership; citations come only from the actual contributing personas. */
export function clusterObjections(personas: Persona[]): ObjectionCluster[] {
  const valid = personas.filter(p => !p.degraded && p.weight > 0);
  const mass = valid.reduce((sum, p) => sum + p.weight, 0);
  const groups: { mode: "assigned" | "open"; members: Persona[] }[] = [];
  for (const persona of valid) {
    const label = persona.score.objection_category.trim().toLowerCase();
    const group = groups.find(g => g.mode === persona.objectionMode && g.members.every(member =>
      member.score.objection_category.trim().toLowerCase() === label ||
      lexicalSimilarity(member.score.objection_category + " " + member.score.wouldNotBuyReason, label + " " + persona.score.wouldNotBuyReason) >= 0.55));
    if (group) group.members.push(persona);
    else groups.push({ mode: persona.objectionMode, members: [persona] });
  }
  const colors = ["#d9ff5a", "#9b8cff", "#65d6ff", "#ff9a62", "#ff6b8a", "#5ae0d9"];
  return groups.map(({ mode, members }, i) => {
    const segmentMass = new Map<string, number>();
    members.forEach(p => segmentMass.set(p.segment, (segmentMass.get(p.segment) || 0) + p.weight));
    const share = mass ? members.reduce((sum, p) => sum + p.weight, 0) / mass * 100 : 0;
    return ObjectionClusterSchema.parse({
      label: members[0].score.objection_category, frequency: members.length,
      percentage: +share.toFixed(1),
      affectedSegments: [...segmentMass].sort((a, b) => b[1] - a[1]).map(([name]) => name),
      drivingEvidenceIds: [...new Set(members.flatMap(p => p.retrievedEvidenceIds))],
      personaIds: members.map(p => p.id),
      expectedImpact: share >= 50 ? "high" : share >= 25 ? "medium" : "low",
      color: colors[i % colors.length], mode,
    });
  }).sort((a, b) => b.percentage - a.percentage || b.frequency - a.frequency || a.label.localeCompare(b.label));
}

