import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calibrationMetrics, evaluateGroundTruth } from "@/lib/calibration";
import { ResearchResultSchema } from "@/lib/schemas";
import { apiError, HttpError } from "@/lib/api-errors";

const CalibrationSchema = z.object({
  projectId: z.string().min(1), metric: z.enum(calibrationMetrics),
  realValue: z.number().finite().min(1).max(10), note: z.string().max(2000).optional(),
});
export async function POST(request: Request) {
  try {
    const data = CalibrationSchema.parse(await request.json());
    const project = await prisma.project.findUnique({
      where: { id: data.projectId }, include: { reports: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!project) throw new HttpError("Project not found.", 404);
    const result = ResearchResultSchema.safeParse(project.reports[0]?.data);
    const verdict = result.success && result.data.metrics ? evaluateGroundTruth(result.data.metrics, data) : null;
    const groundTruth = await prisma.groundTruth.create({ data });
    return NextResponse.json({ groundTruth, verdict });
  } catch (error) { return apiError(error); }
}
