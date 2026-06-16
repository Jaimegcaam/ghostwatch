import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

type Params = { id: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;
    const body = await request.json();

    const existing = await db.alertRule.findUnique({
      where: { id },
      include: { check: { select: { projectId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.check.projectId, userId, "EDITOR");

    const rule = await db.alertRule.update({
      where: { id },
      data: {
        ...(body.consecutiveFailures !== undefined && { consecutiveFailures: body.consecutiveFailures }),
        ...(body.notifyOnRecovery !== undefined && { notifyOnRecovery: body.notifyOnRecovery }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;

    const existing = await db.alertRule.findUnique({
      where: { id },
      include: { check: { select: { projectId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.check.projectId, userId, "EDITOR");

    await db.alertRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
