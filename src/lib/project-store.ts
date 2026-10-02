import { Prisma, type Project, type Report } from "@prisma/client";
import { prisma } from "./prisma";
import type { ResearchInput, ResearchResult, AuditRecord } from "./types";
import { HttpError } from "./api-errors";

export const jsonValue = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export const latestReport = { reports: { orderBy: { createdAt: "desc" as const }, take: 1 } };

/** Product snapshots carry public evidence IDs; database IDs are scoped to the project. */
export function projectResponse(project: Project & { reports?: Report[] }) {
  const product = project.product as Record<string, unknown>;
  return { ...project, evidence: Array.isArray(product.evidence) ? product.evidence : [] };
}
export async function writeProject(tx: Prisma.TransactionClient, input: ResearchInput, id?: string) {
  const project = id
    ? await tx.project.update({ where: { id }, data: { name: input.productName, product: jsonValue(input) } })
    : await tx.project.create({ data: { name: input.productName, product: jsonValue(input) } });
  await tx.evidence.deleteMany({ where: { projectId: project.id } });
  for (const evidence of input.evidence) {
    await tx.evidence.create({ data: {
      id: `${project.id}:${evidence.id}`, projectId: project.id, source: evidence.source,
      text: evidence.text, tags: jsonValue(evidence.tags), heldOut: evidence.heldOut,
    } });
  }
  return project;
}
export async function saveProject(input: ResearchInput, id?: string) {
  return prisma.$transaction(async tx => {
    if (id && await tx.run.count({ where: { projectId: id, status: "running" } })) throw new HttpError("This project has a research run in progress. Wait for it to finish before saving edits.", 409);
    return projectResponse(await writeProject(tx, input, id));
  }, { timeout: 10000 });
}
export async function beginRun(input: ResearchInput, id?: string) {
  return prisma.$transaction(async tx => {
    if (id) {
      // Recover runs interrupted by a process restart; normal requests have a six-minute deadline.
      await tx.run.updateMany({ where: { projectId: id, status: "running", createdAt: { lt: new Date(Date.now() - 7 * 60000) } }, data: { status: "failed" } });
      if (await tx.run.count({ where: { projectId: id, status: "running" } })) throw new HttpError("Research is already running for this project.", 409);
    }
    const project = await writeProject(tx, input, id);
    const run = await tx.run.create({ data: { projectId: project.id } });
    return { projectId: project.id, runId: run.id };
  }, { timeout: 10000 });
}
async function writeAudit(tx: Prisma.TransactionClient, runId: string, audit: AuditRecord[]) {
  for (const entry of audit) await tx.stageLog.create({ data: {
    runId, stage: entry.stage,
    input: entry.input == null ? Prisma.JsonNull : jsonValue(entry.input),
    output: entry.output == null ? Prisma.JsonNull : jsonValue(entry.output),
    sourceIds: jsonValue(entry.sourceEvidenceIds), provider: entry.provider, model: entry.model,
    temperature: entry.temperature, durationMs: entry.durationMs, timestamp: new Date(entry.timestamp),
  } });
}
export async function finishRun(projectId: string, runId: string, result: ResearchResult) {
  await prisma.$transaction(async tx => {
    const updated = await tx.run.updateMany({ where: { id: runId, status: "running" }, data: { status: "complete" } });
    if (updated.count !== 1) throw new HttpError("This research run is no longer active.", 409);
    await writeAudit(tx, runId, result.auditTrail || []);
    // Reports hold immutable historical panels. These tables hold the latest successful panel.
    await tx.persona.deleteMany({ where: { projectId } });
    for (const persona of result.personas) await tx.persona.create({ data: {
      id: `${projectId}:${persona.id}`, projectId, profile: jsonValue(persona),
      evidenceIds: jsonValue(persona.retrievedEvidenceIds), retrievedEvidenceIds: jsonValue(persona.retrievedEvidenceIds),
      groundingType: persona.groundingType,
      simulations: persona.degraded ? undefined : { create: { rawResponse: persona.score.interview_text, scores: jsonValue(persona.score) } },
    } });
    await tx.report.create({ data: { projectId, data: jsonValue(result) } });
    await tx.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
  }, { timeout: 20000 });
}
export async function failRun(runId: string, audit: AuditRecord[]) {
  await prisma.$transaction(async tx => {
    await tx.run.update({ where: { id: runId }, data: { status: "failed" } });
    await writeAudit(tx, runId, audit);
  }, { timeout: 10000 });
}

