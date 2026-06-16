import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;

    const existing = await db.maintenance.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.projectId, userId, "EDITOR");

    const body = await request.json();
    const { title, description, scheduledStart, scheduledEnd, status, checkIds } = body;

    const result = await db.$transaction(async (tx) => {
      await tx.maintenance.update({
        where: { id },
        data: {
          ...(title !== undefined && { title: title.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(scheduledStart !== undefined && { scheduledStart: new Date(scheduledStart) }),
          ...(scheduledEnd !== undefined && { scheduledEnd: new Date(scheduledEnd) }),
          ...(status !== undefined && { status }),
        },
      });

      if (checkIds !== undefined) {
        await tx.maintenanceCheck.deleteMany({ where: { maintenanceId: id } });
        if (checkIds.length > 0) {
          await tx.maintenanceCheck.createMany({
            data: checkIds.map((checkId: string) => ({ maintenanceId: id, checkId })),
          });
        }
      }

      return tx.maintenance.findUnique({
        where: { id },
        include: {
          checks: {
            include: { check: { select: { id: true, name: true, url: true } } },
          },
        },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to update maintenance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;

    const existing = await db.maintenance.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.projectId, userId, "EDITOR");

    await db.maintenance.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to delete maintenance:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
