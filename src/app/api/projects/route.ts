import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { name, product, evidence } = data;

    const project = await prisma.project.create({
      data: {
        name: name || "New Project",
        product,
        evidence: {
          create: evidence.map((ev: any) => ({
            source: ev.source,
            text: ev.text,
            tags: ev.tags,
            heldOut: ev.heldOut || false,
          })),
        },
      },
      include: {
        evidence: true,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
