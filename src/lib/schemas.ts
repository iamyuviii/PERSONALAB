import { z } from "zod";

// ── Evidence ────────────────────────────────────────────────────────────────

export const EvidenceSnippetSchema = z.object({
  id: z.string(),
  source: z.string().min(1),
  text: z.string().min(3),
  tags: z.array(z.string()).default([]),
  heldOut: z.boolean().optional().default(false),
  embedding: z.array(z.number()).optional(),
});

// ── Research Input ──────────────────────────────────────────────────────────

export const ResearchInputSchema = z.object({
  productName: z.string().min(2).max(100),
  description: z.string().min(10).max(4000),
  targetAudience: z.string().min(3).max(1000),
  landingCopy: z.string().max(6000).optional().default(""),
  pricing: z.string().max(200).default(""),
  competitors: z.string().max(1000).default(""),
  questions: z.string().max(3000).default(""),
  evidence: z.array(EvidenceSnippetSchema).max(50).default([]),
  segmentWeights: z.record(z.string(), z.number()).optional(),
});

// ── Stage 1: Market Signals ─────────────────────────────────────────────────

export const MarketSignalsSchema = z.object({
  painPoints: z.array(z.string()),
  motivations: z.array(z.string()),
  objections: z.array(z.string()),
  trustConcerns: z.array(z.string()),
  alternatives: z.array(z.string()),
});

// ── Stage 2: Segments ───────────────────────────────────────────────────────

export const SegmentSchema = z.object({
  name: z.string(),
  weight: z.number().min(0).max(100),
  description: z.string(),
});

export const SegmentDistributionSchema = z.object({
  segments: z.array(SegmentSchema).min(2).max(8),
});

// ── Stage 3: Persona Profile ────────────────────────────────────────────────

export const PersonaProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  segment: z.string(),
  weight: z.number().min(0).max(100),
  role: z.string(),
  bio: z.string(),
  pain: z.string(),
  style: z.string(),
  barrier: z.string(),
  workaround: z.string(),
  groundingType: z.enum(["retrieval", "hypothesis"]),
  retrievedEvidenceIds: z.array(z.string()),
  degraded: z.boolean().default(false),
  degradeReason: z.enum(["llm_failure", "parse_failure", "rate_limit"]).optional(),
  objectionMode: z.enum(["assigned", "open"]).default("assigned"),
});

// ── Stage 4: Persona Reaction (independent per persona) ─────────────────────

export const PersonaReactionSchema = z.object({
  personaId: z.string(),
  clarity_score: z.number().min(1).max(10),
  purchase_intent: z.number().min(1).max(10),
  trust_score: z.number().min(1).max(10),
  price_sensitivity: z.number().min(1).max(10),
  urgency_score: z.number().min(1).max(10),
  willingness_to_pay: z.number().min(1).max(10),
  objection_category: z.string(),
  wouldNotBuyReason: z.string().min(1),
  conversion_trigger: z.string(),
  likely_to_try: z.boolean(),
  quote: z.string(),
  recommendation: z.string(),
  interview_text: z.string(),
});

// ── Combined Persona (profile + reaction) ───────────────────────────────────

export const PersonaSchema = z.object({
  ...PersonaProfileSchema.shape,
  score: z.object({
    clarity_score: z.number().min(1).max(10),
    purchase_intent: z.number().min(1).max(10),
    trust_score: z.number().min(1).max(10),
    price_sensitivity: z.number().min(1).max(10),
    urgency_score: z.number().min(1).max(10),
    willingness_to_pay: z.number().min(1).max(10),
    objection_category: z.string(),
    wouldNotBuyReason: z.string().min(1),
    conversion_trigger: z.string(),
    likely_to_try: z.boolean(),
    quote: z.string(),
    recommendation: z.string(),
    interview_text: z.string(),
  }),
});

// ── Stage 5: Aggregate Metrics ──────────────────────────────────────────────

export const ScoreDistributionSchema = z.object({
  mean: z.number(),
  min: z.number(),
  max: z.number(),
  values: z.array(z.number()),
});

export const AggregateMetricsSchema = z.object({
  purchaseIntent: ScoreDistributionSchema,
  clarity: ScoreDistributionSchema,
  trust: ScoreDistributionSchema,
  urgency: ScoreDistributionSchema,
  priceSensitivity: ScoreDistributionSchema,
  willingnessToPayAvg: z.number(),
  /** Labeled "simulated variance" — computed from independent persona runs, not real-world measurement. */
  disagreementScore: z.number().min(0).max(100),
  /** Function of evidence volume, source diversity, grounding coverage, response consistency. */
  evidenceCoverage: z.number().min(0).max(100),
  degradedCount: z.number().default(0),
  totalPersonaCount: z.number().default(0),
});

// ── Stage 6: Objection Clusters ─────────────────────────────────────────────

export const ObjectionClusterSchema = z.object({
  label: z.string(),
  frequency: z.number(),
  percentage: z.number(),
  affectedSegments: z.array(z.string()),
  drivingEvidenceIds: z.array(z.string()),
  expectedImpact: z.enum(["high", "medium", "low"]),
  color: z.string(),
  mode: z.enum(["assigned", "open"]).default("assigned"),
});

// ── Stage 7: Derived Recommendations ────────────────────────────────────────

export const DerivedRecommendationSchema = z.object({
  title: z.string(),
  detail: z.string(),
  objectionCluster: z.string(),
  affectedSegment: z.string(),
  evidenceIds: z.array(z.string()),
  expectedImpact: z.enum(["high", "medium", "low"]),
});

// ── Audit Record ────────────────────────────────────────────────────────────

export const AuditRecordSchema = z.object({
  stage: z.string(),
  input: z.unknown(),
  output: z.unknown(),
  sourceEvidenceIds: z.array(z.string()),
  provider: z.string(),
  model: z.string(),
  temperature: z.number().optional(),
  timestamp: z.string(),
  durationMs: z.number().optional(),
});

// ── Full Pipeline Result ────────────────────────────────────────────────────

export const PipelineResultSchema = z.object({
  signals: MarketSignalsSchema,
  segments: z.array(SegmentSchema),
  personas: z.array(PersonaSchema).min(4).max(30),
  metrics: AggregateMetricsSchema,
  objectionClusters: z.array(ObjectionClusterSchema),
  recommendations: z.array(DerivedRecommendationSchema).min(1).max(8),
  auditTrail: z.array(AuditRecordSchema),
  provider: z.string(),
  model: z.string(),
  generatedAt: z.string(),
});

// ── Legacy-compat: ResearchResult for gradual migration ─────────────────────

export const RecommendationSchema = z.object({
  title: z.string(),
  detail: z.string(),
});

export const ResearchResultSchema = z.object({
  signals: MarketSignalsSchema,
  personas: z.array(PersonaSchema).min(4).max(30),
  evidenceCoverage: z.number().min(0).max(100),
  provider: z.string(),
  model: z.string(),
  generatedAt: z.string(),
  recommendations: z.array(DerivedRecommendationSchema).min(1).max(8),
  // v2 additions
  segments: z.array(SegmentSchema).optional(),
  metrics: AggregateMetricsSchema.optional(),
  objectionClusters: z.array(ObjectionClusterSchema).optional(),
  auditTrail: z.array(AuditRecordSchema).optional(),
});
