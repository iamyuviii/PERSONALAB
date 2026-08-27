import { NextResponse } from "next/server";
import { ResearchInputSchema } from "@/lib/schemas";
import { runPipeline } from "@/lib/research-engine";
import { getProvider } from "@/lib/providers";

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const input = ResearchInputSchema.parse(raw);
    const provider = getProvider();

    const result = await runPipeline(input, provider);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create research run.";
    console.error("[research API]", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
