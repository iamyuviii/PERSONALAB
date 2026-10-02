import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectWriteSchema } from "@/lib/schemas";
import { apiError, HttpError } from "@/lib/api-errors";
import { latestReport, projectResponse, saveProject } from "@/lib/project-store";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id }, include: { ...latestReport, groundTruths: true, runs: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    if (!project) throw new HttpError("Project not found.", 404);
    return NextResponse.json(projectResponse(project));
  } catch (error) { return apiError(error); }
}
export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const { product } = ProjectWriteSchema.parse(await request.json());
    return NextResponse.json(await saveProject(product, id));
  } catch (error) { return apiError(error); }
}
