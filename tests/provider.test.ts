import test from "node:test";
import assert from "node:assert/strict";
import { GroqResearchProvider, ProviderError, parseResetDuration } from "../src/lib/providers";

test("provider parses Groq quota reset durations", () => {
  assert.equal(parseResetDuration("1m2.5s"), 62500);
  assert.equal(parseResetDuration("7.66s"), 7660);
  assert.equal(parseResetDuration("300ms"), 300);
  assert.equal(parseResetDuration(null), 0);
});

test("provider does not retry authentication errors or expose upstream bodies", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("PRIVATE_PAYLOAD", { status: 401 }); };
  try {
    await assert.rejects(new GroqResearchProvider("test-key").complete("test"), error => error instanceof ProviderError && error.status === 401 && !error.message.includes("PRIVATE"));
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
test("provider honors transient retry and rejects truncated output", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1 ? new Response("busy", { status: 429, headers: { "Retry-After": "0" } }) :
      Response.json({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }] });
  };
  try {
    assert.equal(await new GroqResearchProvider("test").complete("test"), '{"ok":true}');
    assert.equal(calls, 2);
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: "{}" }, finish_reason: "length" }] });
    await assert.rejects(new GroqResearchProvider("test").complete("test"), /truncated/);
  } finally { globalThis.fetch = original; }
});
test("provider observes cancellation before any network request", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(new GroqResearchProvider("test", undefined, controller.signal).complete("test"), { name: "AbortError" });
});

test("provider serializes calls so quota information applies before the next request", async () => {
  const original = globalThis.fetch;
  let inFlight = 0;
  let peak = 0;
  globalThis.fetch = async () => {
    peak = Math.max(peak, ++inFlight);
    await new Promise(resolve => setTimeout(resolve, 5));
    inFlight--;
    return Response.json({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] });
  };
  try {
    const provider = new GroqResearchProvider("test");
    await Promise.all([provider.complete("first"), provider.complete("second")]);
    assert.equal(peak, 1);
  } finally { globalThis.fetch = original; }
});

