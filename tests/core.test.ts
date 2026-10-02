import test from "node:test";
import assert from "node:assert/strict";
import { ResearchInputSchema, PersonaReactionSchema } from "../src/lib/schemas";
import { aggregateMetrics, normalizeSegments, allocatePanel, clusterObjections } from "../src/lib/research-metrics";
import { snippetizeEvidence, buildIndex, retrieve, cosineSimilarity } from "../src/lib/evidence-retriever";
import { runPipeline } from "../src/lib/research-engine";
import { evaluateGroundTruth, runHoldOutBacktest } from "../src/lib/calibration";
import { FakeProvider, input, persona, score } from "./fixtures";

test("input rejects invalid weights, duplicate citations and whitespace briefs", () => {
  for (const segmentWeights of [{ A: -1 }, { A: 0 }, { A: Number.NaN }, { " ": 10 }]) {
    assert.equal(ResearchInputSchema.safeParse({ ...input, segmentWeights }).success, false);
  }
  assert.equal(ResearchInputSchema.safeParse({ ...input, evidence: [input.evidence[0], input.evidence[0]] }).success, false);
  assert.equal(ResearchInputSchema.safeParse({ ...input, description: "          " }).success, false);
  assert.equal(ResearchInputSchema.safeParse({ ...input, segmentWeights: {} }).success, true);
});
test("model scores must be valid integers; missing values are not silently replaced", () => {
  assert.equal(PersonaReactionSchema.safeParse({ ...score, personaId: "P", purchase_intent: 0 }).success, false);
  assert.equal(PersonaReactionSchema.safeParse({ ...score, personaId: "P", trust_score: "8" }).success, false);
  assert.equal(PersonaReactionSchema.safeParse({ ...score, personaId: "P", trust_score: 8.5 }).success, false);
});
test("panel allocation covers each active segment and preserves population mass", () => {
  const segments = normalizeSegments([{ name: "Major", weight: 90, description: "Major" }, { name: "Minor", weight: 5, description: "Minor" }, { name: "Off", weight: 0, description: "Off" }]);
  const panel = allocatePanel(segments);
  assert.equal(panel.length, 12);
  assert.deepEqual(new Set(panel.map(s => s.name)), new Set(["Major", "Minor"]));
  assert.ok(Math.abs(panel.reduce((sum, p) => sum + p.weight, 0) - 100) < 0.00001);
  assert.ok(Math.abs(panel.filter(p => p.name === "Major").reduce((sum, p) => sum + p.weight, 0) - segments[0].weight) < 0.00001);
});
test("weighted means, variance and coverage do not reward missing evidence or failed personas", () => {
  const people = [persona("A", 90, 9), persona("B", 10, 1)];
  const metrics = aggregateMetrics(people);
  assert.equal(metrics.purchaseIntent.mean, 8.2);
  assert.equal(metrics.evidenceCoverage, 0);
  assert.equal(metrics.disagreementScore, 53);
  const grounded = { ...people[0], groundingType: "retrieval" as const, retrievedEvidenceIds: ["customer-1"] };
  assert.equal(aggregateMetrics([grounded, { ...people[1], degraded: true }]).evidenceCoverage, 90);
  assert.equal(aggregateMetrics([grounded, { ...people[1], degraded: true }]).purchaseIntent.mean, 9);
  assert.equal(aggregateMetrics(people.map(p => ({ ...p, degraded: true }))).purchaseIntent.mean, 0);
});
test("clustering is weighted, ranked and preserves real membership and citations", () => {
  const groups = clusterObjections([
    persona("A", 80, 4, { retrievedEvidenceIds: ["A-source"], groundingType: "retrieval", score: { ...score, objection_category: "Pricing", wouldNotBuyReason: "Monthly fees exceed budget" } }),
    persona("B", 10, 6),
    persona("C", 10, 6, { degraded: true, retrievedEvidenceIds: ["should-not-appear"] }),
  ]);
  assert.equal(groups[0].label, "Pricing");
  assert.equal(groups[0].percentage, 88.9);
  assert.equal(groups[0].expectedImpact, "high");
  assert.deepEqual(groups[0].personaIds, ["A"]);
  assert.deepEqual(groups[0].drivingEvidenceIds, ["A-source"]);
  assert.equal(groups.some(g => g.drivingEvidenceIds.includes("should-not-appear")), false);
});
test("retrieval excludes holdouts and duplicates, preserves IDs, and works without downloads", async () => {
  const evidence = [...input.evidence, { ...input.evidence[0], id: "duplicate" }];
  const snippets = snippetizeEvidence(evidence);
  assert.deepEqual(snippets.map(s => s.id), ["customer-1", "customer-2"]);
  const index = await buildIndex(snippets);
  const matches = await retrieve("reliable deployment alerts", snippets, index);
  assert.ok(matches.length > 0);
  assert.ok(matches.every(m => m.snippet.id.startsWith("customer-")));
  assert.equal(evidence[0].embedding, undefined);
  assert.deepEqual(await retrieve("unrelated bananas", snippets, index), []);
  assert.equal(cosineSimilarity([0], [0]), 0);
  assert.equal(cosineSimilarity([1, 2], [1]), 0);
});
test("pipeline runs independent persona calls, answers supplied questions and never leaks held-out evidence", async () => {
  const provider = new FakeProvider();
  const result = await runPipeline(input, provider);
  assert.equal(result.personas.length, 12);
  assert.equal(provider.prompts.filter(p => p.startsWith("Simulate this")).length, 12);
  assert.equal(provider.prompts.some(p => p.includes("HOLDOUT_SENTINEL")), false);
  assert.ok(provider.prompts.filter(p => p.startsWith("Simulate this")).every(p => p.includes(input.questions)));
  assert.equal(result.metrics?.purchaseIntent.mean, 6.8);
  assert.equal(result.inputSnapshot?.productName, input.productName);
  assert.ok(result.personas.every(p => p.role === "Software engineer"));
  assert.ok(result.auditTrail?.some(a => a.stage === "indexEvidence"));
  assert.ok(result.personas.flatMap(p => p.retrievedEvidenceIds).every(id => result.evidence?.some(e => e.id === id)));
  assert.ok(result.recommendations.length > 0);
  assert.equal(new Set(result.recommendations.map(r => r.title)).size, result.recommendations.length);
  assert.ok(result.recommendations.every(r => r.detail.includes(score.recommendation)));
});
test("profile failures remain degraded and do not receive simulations", async () => {
  const provider = new FakeProvider();
  provider.failProfile = true;
  const result = await runPipeline(input, provider);
  assert.equal(result.metrics?.degradedCount, 1);
  assert.equal(provider.prompts.filter(p => p.startsWith("Simulate this")).length, 11);
  assert.equal(result.personas[0].degraded, true);
  assert.equal(result.metrics?.purchaseIntent.values.length, 11);
});
test("malformed reactions are excluded, and a heavily degraded run fails explicitly", async () => {
  const provider = new FakeProvider();
  provider.failReaction = true;
  const result = await runPipeline(input, provider);
  assert.equal(result.metrics?.degradedCount, 1);
  const broken = new FakeProvider();
  broken.failAllReactions = true;
  await assert.rejects(runPipeline(input, broken), /12 of 12 personas failed/);
});
test("zero evidence and empty objections produce bounded metrics without invented grounding", async () => {
  const provider = new FakeProvider();
  provider.emptyObjections = true;
  const result = await runPipeline({ ...input, evidence: [] }, provider);
  assert.equal(result.evidenceCoverage, 0);
  assert.ok(result.personas.every(p => p.groundingType === "hypothesis" && p.objectionMode === "open"));
  assert.ok(Number.isFinite(result.metrics?.disagreementScore));
});
test("format retries are bounded and cancellation prevents provider calls", async () => {
  let calls = 0;
  const provider = { metadata: new FakeProvider().metadata, complete: async () => { calls++; return "{}"; } };
  await assert.rejects(runPipeline(input, provider), /invalid research data/);
  assert.equal(calls, 2);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runPipeline(input, provider, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 2);
});

test("placeholder objection labels trigger a repair instead of contaminating recommendations", async () => {
  const provider = new FakeProvider();
  provider.placeholderReaction = true;
  const result = await runPipeline(input, provider);
  assert.ok(result.personas.every(p => p.score.objection_category !== "primary concern"));
  assert.equal(result.metrics?.degradedCount, 0);
  assert.equal(provider.prompts.filter(p => p.startsWith("Simulate this")).length, 24);
});
test("calibration compares equivalent units and holdout matches need meaningful terms", async () => {
  const metrics = aggregateMetrics([persona("A", 100, 7)]);
  assert.equal(evaluateGroundTruth(metrics, { metric: "purchase_intent", realValue: 6 }).delta, 1);
  assert.throws(() => evaluateGroundTruth(metrics, { metric: "conversion_rate", realValue: 70 }), /not a conversion probability/);
  const backtest = await runHoldOutBacktest([
    { id: "H", source: "Holdout", text: "The unrelated banana problem", tags: [], heldOut: true },
  ], [persona("A")]);
  assert.equal(backtest?.hitRate, 0);
  assert.equal(await runHoldOutBacktest(input.evidence.filter(e => !e.heldOut), [persona("A")]), null);
});

