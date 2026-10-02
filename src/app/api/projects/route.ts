import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectWriteSchema } from "@/lib/schemas";
import { apiError } from "@/lib/api-errors";
import { latestReport, projectResponse, saveProject } from "@/lib/project-store";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({ orderBy: { updatedAt: "desc" }, include: latestReport });
    return NextResponse.json(projects.map(projectResponse));
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const { product: input } = ProjectWriteSchema.parse(await request.json());
    return NextResponse.json(await saveProject(input), { status: 201 });
  } catch (error) { return apiError(error); }
}
