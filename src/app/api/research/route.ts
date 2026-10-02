import { NextResponse } from "next/server";
import { z } from "zod";
import { ResearchInputSchema } from "@/lib/schemas";
import { runPipeline } from "@/lib/research-engine";
import { getProvider } from "@/lib/providers";
import { apiError } from "@/lib/api-errors";
import { beginRun, finishRun, failRun } from "@/lib/project-store";
import type { AuditRecord } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 360;
const RequestSchema = ResearchInputSchema.extend({ projectId: z.string().min(1).optional() });
export async function POST(request: Request) {
  let run: { projectId: string; runId: string } | undefined;
  const audit: AuditRecord[] = [];
  try {
    const { projectId, ...input } = RequestSchema.parse(await request.json());
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(360000)]);
    const provider = getProvider(signal);
    run = await beginRun(input, projectId);
    const result = await runPipeline(input, provider, { signal, audit });
    await finishRun(run.projectId, run.runId, result);
    return NextResponse.json(result, { headers: { "X-Project-Id": run.projectId, "X-Run-Id": run.runId } });
  } catch (error) {
    const response = apiError(error);
    if (run) {
      audit.push({
        stage: "runFailure", input: { projectId: run.projectId }, output: await response.clone().json(),
        sourceEvidenceIds: [], provider: "pipeline", model: "", timestamp: new Date().toISOString(),
      });
      try { await failRun(run.runId, audit); } catch { console.error("[research] Could not record failed run."); }
    }
    if (run) response.headers.set("X-Project-Id", run.projectId);
    return response;
  }
}
