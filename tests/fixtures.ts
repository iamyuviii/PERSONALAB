import { ResearchInputSchema, PersonaSchema } from "../src/lib/schemas";
import type { ResearchProvider } from "../src/lib/providers";
import type { Persona } from "../src/lib/types";

export const input = ResearchInputSchema.parse({
  productName: "DeployWatch", description: "A deployment monitoring service for small software teams.",
  targetAudience: "Software developers and engineering managers",
  pricing: "$20 per month", questions: "How would this fit into your deployment workflow?",
  evidence: [
    { id: "customer-1", source: "Interview", text: "Developers need reliable deployment alerts and easier incident monitoring.", tags: ["developers", "reliability"] },
    { id: "customer-2", source: "Survey", text: "Managers need reliable deployment alerts without expensive monitoring fees.", tags: ["managers", "cost"] },
    { id: "secret-holdout", source: "Holdout", text: "HOLDOUT_SENTINEL should never enter generation.", heldOut: true },
  ],
});
export const score: Persona["score"] = {
  clarity_score: 8, purchase_intent: 6, trust_score: 5, urgency_score: 7, price_sensitivity: 8,
  willingness_to_pay: 6, objection_category: "Reliability", wouldNotBuyReason: "Deployment alerts might miss incidents.",
  conversion_trigger: "Demonstrate reliable incident detection", likely_to_try: true,
  quote: "I would test these deployment alerts first.", recommendation: "Run a monitored deployment trial.",
  interview_text: "I would try alerts during a real deployment. I need proof of reliable monitoring. A trial would fit our workflow.",
};
export function persona(id: string, weight = 50, intent = 6, overrides: Partial<Persona> = {}): Persona {
  return PersonaSchema.parse({
    id, name: id, segment: id, weight, role: "Engineer", bio: "Maintains software.", pain: "Missed alerts",
    style: "Practical", barrier: "Reliability", workaround: "Manual checks", groundingType: "hypothesis",
    retrievedEvidenceIds: [], objectionMode: "open", score: { ...score, purchase_intent: intent }, ...overrides,
  });
}
export class FakeProvider implements ResearchProvider {
  metadata = { provider: "fixture", model: "test-only", deterministic: true };
  prompts: string[] = [];
  failProfile = false;
  failReaction = false;
  failAllReactions = false;
  placeholderReaction = false;
  emptyObjections = false;
  async complete(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    if (prompt.startsWith("Extract market")) return JSON.stringify({
      painPoints: ["Deployment alert reliability"], motivations: ["Reliable monitoring"],
      objections: this.emptyObjections ? [] : ["Reliability", "Cost"], trustConcerns: ["Missed incidents"], alternatives: ["Manual monitoring"],
    });
    if (prompt.startsWith("Define four")) return JSON.stringify({ segments: [
      { name: "Developers", weight: 70, description: "Developers need reliable deployment alerts" },
      { name: "Managers", weight: 30, description: "Managers need affordable incident monitoring" },
    ] });
    if (prompt.startsWith("Generate one")) {
      const segment = JSON.parse(prompt.split("\n").find(line => line.startsWith("Segment: "))!.slice(9));
      if (this.failProfile && segment.name === "Developers" && prompt.includes("Variation: persona 1 ")) return "{}";
      return JSON.stringify({ name: "Alex", role: "Software engineer", bio: "Maintains deployments.", pain: "Unreliable alerts", style: "Practical", barrier: "Missed incidents", workaround: "Manual monitoring" });
    }
    if (prompt.startsWith("Simulate this")) {
      const profile = JSON.parse(prompt.split("\n").find(line => line.startsWith("Persona: "))!.slice(9));
      if (this.placeholderReaction && !prompt.includes("Your previous response was invalid")) return JSON.stringify({ ...score, objection_category: "primary concern" });
      if (this.failAllReactions || (this.failReaction && profile.id === "P-01")) return JSON.stringify({ ...score, trust_score: "invalid" });
      return JSON.stringify({ ...score, purchase_intent: profile.segment === "Developers" ? 8 : 4 });
    }
    throw new Error("Unexpected test prompt");
  }
}

