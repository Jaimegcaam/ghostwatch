import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

type Params = { projectId: string };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { projectId } = await params;
    await requireProjectAccess(projectId, userId, "VIEWER");

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        team: { select: { id: true, name: true } },
        checks: {
          select: {
            id: true,
            results: {
              select: { success: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
        statusPages: {
          select: { id: true, title: true, slug: true, isPublic: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const total = project.checks.length;
    const passing = project.checks.filter(
      (c: { id: string; results: { success: boolean }[] }) => c.results[0]?.success === true,
    ).length;
    const failing = project.checks.filter(
      (c: { id: string; results: { success: boolean }[] }) => c.results[0]?.success === false,
    ).length;

    const { checks: _, ...rest } = project;

    return NextResponse.json({
      ...rest,
      summary: { total, passing, failing },
    });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to get project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { projectId } = await params;
    await requireProjectAccess(projectId, userId, "EDITOR");

    const body = await request.json();
    const project = await db.project.update({
      where: { id: projectId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.slug !== undefined && { slug: body.slug }),
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { projectId } = await params;
    await requireProjectAccess(projectId, userId, "ADMIN");

    await db.project.delete({ where: { id: projectId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
