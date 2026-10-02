import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ProviderError } from "./providers";
import { PipelineError } from "./research-engine";

export class HttpError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function apiError(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues.map(i => `${i.path.join(".") || "Input"}: ${i.message}`).join("; ") }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "The request must contain valid JSON." }, { status: 400 });
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ProviderError) return NextResponse.json({ error: error.message }, { status: error.status === 429 ? 429 : error.status === 503 ? 503 : 502 });
  if (error instanceof PipelineError) return NextResponse.json({ error: error.message }, { status: 502 });
  if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) return NextResponse.json({ error: "Research was cancelled or exceeded its six-minute time limit. Please retry." }, { status: 504 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Project not found." }, { status: 404 });
  console.error("[API] Request failed:", error instanceof Error ? error.name : "Unknown error");
  return NextResponse.json({ error: "Could not save or load research. Check the database configuration and run npm run db:setup." }, { status: 500 });
}

