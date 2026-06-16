import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSession();
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    await requireProjectAccess(projectId, userId, "VIEWER");

    const maintenances = await db.maintenance.findMany({
      where: { projectId },
      include: {
        checks: {
          include: { check: { select: { id: true, name: true, url: true } } },
        },
      },
      orderBy: { scheduledStart: "desc" },
    });

    return NextResponse.json(maintenances);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to get maintenances:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSession();
    const body = await request.json();
    const { projectId, title, description, scheduledStart, scheduledEnd, checkIds } = body;

    if (!projectId || !title || !scheduledStart || !scheduledEnd) {
      return NextResponse.json(
        { error: "projectId, title, scheduledStart, and scheduledEnd are required" },
        { status: 400 },
      );
    }

    await requireProjectAccess(projectId, userId, "EDITOR");

    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);

    if (end <= start) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const now = new Date();
    let status: "SCHEDULED" | "IN_PROGRESS" = "SCHEDULED";
    if (start <= now && end > now) {
      status = "IN_PROGRESS";
    }

    const maintenance = await db.maintenance.create({
      data: {
        projectId,
        title: title.trim(),
        description: description?.trim() || null,
        scheduledStart: start,
        scheduledEnd: end,
        status,
        ...(checkIds?.length && {
          checks: { create: checkIds.map((checkId: string) => ({ checkId })) },
        }),
      },
      include: {
        checks: {
          include: { check: { select: { id: true, name: true, url: true } } },
        },
      },
    });

    return NextResponse.json(maintenance, { status: 201 });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to create maintenance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
