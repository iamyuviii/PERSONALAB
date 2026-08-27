import type { z } from "zod";
import type {
  EvidenceSnippetSchema,
  ResearchInputSchema,
  MarketSignalsSchema,
  SegmentSchema,
  SegmentDistributionSchema,
  PersonaProfileSchema,
  PersonaReactionSchema,
  PersonaSchema,
  ScoreDistributionSchema,
  AggregateMetricsSchema,
  ObjectionClusterSchema,
  DerivedRecommendationSchema,
  AuditRecordSchema,
  PipelineResultSchema,
  ResearchResultSchema,
} from "./schemas";

export type EvidenceSnippet = z.infer<typeof EvidenceSnippetSchema>;
export type ResearchInput = z.infer<typeof ResearchInputSchema>;
export type MarketSignals = z.infer<typeof MarketSignalsSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type SegmentDistribution = z.infer<typeof SegmentDistributionSchema>;
export type PersonaProfile = z.infer<typeof PersonaProfileSchema>;
export type PersonaReaction = z.infer<typeof PersonaReactionSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type ScoreDistribution = z.infer<typeof ScoreDistributionSchema>;
export interface PersonaScore {
  clarity_score: number;
  purchase_intent: number;
  trust_score: number;
  price_sensitivity: number;
  urgency_score: number;
  willingness_to_pay: number;
  objection_category: string;
  wouldNotBuyReason: string;
  conversion_trigger: string;
  likely_to_try: boolean;
  quote: string;
  recommendation: string;
  interview_text: string;
}
export type AggregateMetrics = z.infer<typeof AggregateMetricsSchema>;
export type ObjectionCluster = z.infer<typeof ObjectionClusterSchema>;
export type DerivedRecommendation = z.infer<typeof DerivedRecommendationSchema>;
export type AuditRecord = z.infer<typeof AuditRecordSchema>;
export type PipelineResult = z.infer<typeof PipelineResultSchema>;
export type ResearchResult = z.infer<typeof ResearchResultSchema>;
