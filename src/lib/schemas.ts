import { z } from "zod";

// ── Evidence ────────────────────────────────────────────────────────────────

export const EvidenceSnippetSchema = z.object({
  id: z.string().trim().min(1).max(150),
  source: z.string().trim().min(1).max(300),
  text: z.string().trim().min(3).max(12000),
  tags: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  heldOut: z.boolean().optional().default(false),
  embedding: z.array(z.number().finite()).max(4096).optional(),
});

// ── Research Input ──────────────────────────────────────────────────────────

export const ResearchInputSchema = z.object({
  productName: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(4000),
  targetAudience: z.string().trim().min(3).max(1000),
  landingCopy: z.string().max(6000).optional().default(""),
  pricing: z.string().max(200).default(""),
  competitors: z.string().max(1000).default(""),
  questions: z.string().max(3000).default(""),
  evidence: z.array(EvidenceSnippetSchema).max(50).default([])
    .refine(items => new Set(items.map(item => item.id)).size === items.length, "Evidence IDs must be unique.")
    .refine(items => items.reduce((sum, item) => sum + item.text.length, 0) <= 60000, "Evidence must total at most 60,000 characters."),
  segmentWeights: z.record(z.string().trim().min(1).max(100), z.number().finite().min(0).max(100))
    .refine(weights => Object.keys(weights).length <= 8, "Use at most eight segments.")
    .refine(weights => !Object.keys(weights).length || Object.values(weights).some(weight => weight > 0), "At least one segment must have a positive weight.")
    .optional(),
});

export const ProjectWriteSchema = z.object({ product: ResearchInputSchema });

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
  name: z.string().trim().min(1),
  weight: z.number().min(0).max(100),
  description: z.string().trim().min(1),
});

export const SegmentDistributionSchema = z.object({
  segments: z.array(SegmentSchema).min(1).max(8)
    .refine(segments => new Set(segments.map(s => s.name.trim().toLowerCase())).size === segments.length, "Segment names must be unique.")
    .refine(segments => segments.some(s => s.weight > 0), "Segment weights must have a positive total."),
});

// ── Stage 3: Persona Profile ────────────────────────────────────────────────

export const PersonaProfileSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
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
  clarity_score: z.number().int().min(1).max(10),
  purchase_intent: z.number().int().min(1).max(10),
  trust_score: z.number().int().min(1).max(10),
  price_sensitivity: z.number().int().min(1).max(10),
  urgency_score: z.number().int().min(1).max(10),
  willingness_to_pay: z.number().int().min(1).max(10),
  objection_category: z.string().trim().min(1),
  wouldNotBuyReason: z.string().trim().min(1),
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
    clarity_score: z.number().int().min(1).max(10),
    purchase_intent: z.number().int().min(1).max(10),
    trust_score: z.number().int().min(1).max(10),
    price_sensitivity: z.number().int().min(1).max(10),
    urgency_score: z.number().int().min(1).max(10),
    willingness_to_pay: z.number().int().min(1).max(10),
    objection_category: z.string().trim().min(1),
    wouldNotBuyReason: z.string().trim().min(1),
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
  personaIds: z.array(z.string()).default([]),
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
  recommendations: z.array(DerivedRecommendationSchema).max(8),
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
  inputSnapshot: ResearchInputSchema.optional(),
  evidence: z.array(EvidenceSnippetSchema).optional(),
  signals: MarketSignalsSchema,
  personas: z.array(PersonaSchema).min(4).max(30),
  evidenceCoverage: z.number().min(0).max(100),
  provider: z.string(),
  model: z.string(),
  generatedAt: z.string(),
  recommendations: z.array(DerivedRecommendationSchema).max(8),
  // v2 additions
  segments: z.array(SegmentSchema).optional(),
  metrics: AggregateMetricsSchema.optional(),
  objectionClusters: z.array(ObjectionClusterSchema).optional(),
  auditTrail: z.array(AuditRecordSchema).optional(),
});
