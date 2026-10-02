import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { runPipeline } from "../src/lib/research-engine";
import { FakeProvider, input } from "./fixtures";

test("database persists complete studies, stable evidence and failed-run audit without overwriting history", async () => {
  const folder = mkdtempSync(resolve(".test-build", "database-"));
  process.env.DATABASE_URL = "file:" + join(folder, "test.db").replace(/\\/g, "/");
  writeFileSync(join(folder, "test.db"), "", { flag: "wx" });
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { cwd: process.cwd(), env: process.env, stdio: "pipe" });
  const { prisma } = await import("../src/lib/prisma");
  const { saveProject, beginRun, finishRun, failRun, projectResponse, latestReport } = await import("../src/lib/project-store");
  try {
    const created = await saveProject(input);
    const check = execFileSync(process.execPath, ["scripts/database.mjs", "check"], { cwd: process.cwd(), env: process.env, encoding: "utf8" });
    assert.match(check, /Application database read succeeded/);
    assert.ok(!check.includes(input.productName));
    const run = await beginRun(input, created.id);
    await assert.rejects(beginRun(input, created.id), /already running/);
    await assert.rejects(saveProject(input, created.id), /in progress/);
    const result = await runPipeline(input, new FakeProvider());
    await finishRun(created.id, run.runId, result);
    const reloaded = await prisma.project.findUniqueOrThrow({ where: { id: created.id }, include: { ...latestReport, evidence: true, personas: { include: { simulations: true } }, runs: { include: { stageLogs: true } } } });
    assert.equal(reloaded.reports.length, 1);
    assert.equal(reloaded.personas.length, 12);
    assert.equal(reloaded.personas.reduce((n, p) => n + p.simulations.length, 0), 12);
    assert.equal(reloaded.runs[0].status, "complete");
    assert.equal(reloaded.runs[0].stageLogs.length, result.auditTrail?.length);
    assert.deepEqual(projectResponse(reloaded).evidence, input.evidence);
    assert.deepEqual(reloaded.reports[0].data, JSON.parse(JSON.stringify(result)));
    await assert.rejects(finishRun(created.id, run.runId, result), /no longer active/);
    const updatedInput = { ...input, productName: "Changed brief", evidence: [{ ...input.evidence[0], text: "Updated deployment alert requirements." }] };
    await saveProject(updatedInput, created.id);
    assert.equal(await prisma.evidence.count({ where: { projectId: created.id } }), 1);
    const historical = await prisma.report.findFirstOrThrow({ where: { projectId: created.id } });
    assert.equal((historical.data as { inputSnapshot: { productName: string } }).inputSnapshot.productName, input.productName);
    const failed = await beginRun(updatedInput, created.id);
    await failRun(failed.runId, [
      ...result.auditTrail!.slice(0, 1),
      { stage: "nullableAudit", input: null, output: null, sourceEvidenceIds: [], provider: "test", model: "test", timestamp: new Date().toISOString() },
    ]);
    assert.equal((await prisma.run.findUniqueOrThrow({ where: { id: failed.runId } })).status, "failed");
    assert.equal(await prisma.report.count({ where: { projectId: created.id } }), 1);
    // The same public evidence IDs can be used in a second project.
    const second = await saveProject(input);
    assert.notEqual(second.id, created.id);
    assert.equal(await prisma.evidence.count({ where: { projectId: second.id } }), 3);
    await assert.rejects(saveProject(input, "does-not-exist"));
  } finally { await prisma.$disconnect(); }
});

