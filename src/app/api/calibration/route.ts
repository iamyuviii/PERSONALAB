import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateGroundTruth, runHoldOutBacktest } from "@/lib/calibration";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { projectId, metric, realValue, note } = data;

    // Save the ground truth
    const groundTruth = await prisma.groundTruth.create({
      data: {
        projectId,
        metric,
        realValue,
        note,
      },
    });

    // Optionally evaluate it immediately if we have a recent result
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        reports: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    let verdict = null;
    if (project?.reports[0]) {
      const resultData = project.reports[0].data as any;
      if (resultData && resultData.metrics) {
        verdict = evaluateGroundTruth(resultData.metrics, groundTruth);
      }
    }

    return NextResponse.json({ groundTruth, verdict });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save calibration" }, { status: 500 });
  }
}
