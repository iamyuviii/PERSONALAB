import type { Persona, EvidenceSnippet, AggregateMetrics } from "./types";
import { lexicalSimilarity, tokens } from "./evidence-retriever";

export const calibrationMetrics = ["purchase_intent", "clarity_score", "trust_score", "urgency_score", "price_sensitivity", "willingness_to_pay"] as const;
export interface GroundTruth { metric: string; realValue: number }
export interface CalibrationVerdict { delta: number; verdict: string }

export function evaluateGroundTruth(metrics: AggregateMetrics, truth: GroundTruth): CalibrationVerdict {
  const values: Record<string, number> = {
    purchase_intent: metrics.purchaseIntent.mean, clarity_score: metrics.clarity.mean,
    trust_score: metrics.trust.mean, urgency_score: metrics.urgency.mean,
    price_sensitivity: metrics.priceSensitivity.mean, willingness_to_pay: metrics.willingnessToPayAvg,
  };
  if (!(truth.metric in values)) throw new Error("Compare matching 1–10 survey scores only. Purchase intent is not a conversion probability.");
  if (!Number.isFinite(truth.realValue) || truth.realValue < 1 || truth.realValue > 10) throw new Error("Observed scores must be between 1 and 10.");
  if (!metrics.purchaseIntent.values.length) throw new Error("No valid simulations are available to compare.");
  const delta = +(values[truth.metric] - truth.realValue).toFixed(2);
  return {
    delta,
    verdict: Math.abs(delta) < 0.5
      ? "This simulated average is close to the observed survey average. One comparison does not establish calibration."
      : `The panel ${delta > 0 ? "overestimated" : "underestimated"} this survey score by ${Math.abs(delta).toFixed(1)} points on the same 1–10 scale.`,
  };
}

export async function runHoldOutBacktest(evidence: EvidenceSnippet[], personas: Persona[]) {
  const heldOut = evidence.filter(item => item.heldOut);
  if (!heldOut.length) return null;
  const valid = personas.filter(p => !p.degraded);
  const matches = heldOut.filter(item => valid.some(persona => {
    const objection = persona.score.objection_category + " " + persona.score.wouldNotBuyReason;
    const terms = new Set(tokens(objection));
    const overlap = new Set(tokens(item.text).filter(word => terms.has(word))).size;
    return overlap >= 2 && lexicalSimilarity(item.text, objection) >= 0.25;
  }));
  const hitRate = matches.length / heldOut.length * 100;
  return {
    heldOutCount: heldOut.length, hitRate, method: "lexical-overlap",
    verdict: `${hitRate.toFixed(0)}% of held-out feedback shares objection terms with the panel. This lexical check does not measure predictive accuracy.`,
  };
}
