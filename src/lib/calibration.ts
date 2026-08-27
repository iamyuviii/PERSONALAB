import { Persona, EvidenceSnippet, AggregateMetrics } from "./types";

// Mode A: Ground Truth Comparison
export interface GroundTruth {
  metric: string; // e.g. "purchase_intent" or "conversion_rate"
  realValue: number;
}

export interface CalibrationVerdict {
  delta: number;
  verdict: string;
}

export function evaluateGroundTruth(
  metrics: AggregateMetrics,
  truth: GroundTruth
): CalibrationVerdict {
  // Example: comparing simulated intent mean (1-10) scaled to percentage vs real conversion rate
  let simulatedValue = 0;
  if (truth.metric === "conversion_rate" || truth.metric === "purchase_intent") {
    // If real value is e.g. 22%, and mean intent is 5.5, the implied probability might be roughly proportional.
    // For MVP, we simply map 1-10 scale to 10-100% 
    simulatedValue = metrics.purchaseIntent.mean * 10;
  }
  
  const delta = simulatedValue - truth.realValue;
  const absDelta = Math.abs(delta);
  
  let verdict = "";
  if (absDelta < 5) {
    verdict = "Panel prediction closely matches reality. Highly calibrated.";
  } else if (delta > 0) {
    verdict = `Panel over-estimated intent by ~${delta.toFixed(1)} pts — treat as optimistic.`;
  } else {
    verdict = `Panel under-estimated intent by ~${absDelta.toFixed(1)} pts — treat as pessimistic.`;
  }

  return { delta, verdict };
}

// Mode B: Hold-out Backtest
// Measure similarity between held-out evidence and panel's generated objections.
export async function runHoldOutBacktest(
  heldOutEvidence: EvidenceSnippet[],
  personas: Persona[]
) {
  if (heldOutEvidence.length === 0) return null;

  // We need cosine similarity. For simplicity in MVP, we just check if the text contains keywords 
  // or if we have embeddings on both, we compare.
  // In a full implementation, we'd embed the persona's 'wouldNotBuyReason' and compare to the held out text embeddings.
  
  let hitCount = 0;
  for (const evidence of heldOutEvidence) {
    const evidenceLower = evidence.text.toLowerCase();
    const isHit = personas.some(p => {
      const reasonLower = p.score.wouldNotBuyReason.toLowerCase();
      const objectionLower = p.score.objection_category.toLowerCase();
      
      // Simple heuristic overlap for MVP, could use dense vectors for real comparison
      return evidenceLower.includes(objectionLower.split(" ")[0]) || reasonLower.includes(evidenceLower.split(" ")[0]);
    });

    if (isHit) hitCount++;
  }

  const hitRate = (hitCount / heldOutEvidence.length) * 100;

  return {
    heldOutCount: heldOutEvidence.length,
    hitRate,
    verdict: hitRate > 50 
      ? `Successfully predicted ${hitRate.toFixed(0)}% of held-out real feedback.`
      : `Missed ${(100 - hitRate).toFixed(0)}% of held-out feedback. Panel may lack context.`
  };
}
