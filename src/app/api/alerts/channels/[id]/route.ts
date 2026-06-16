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

    const existing = await db.alertChannel.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.projectId, userId, "EDITOR");

    const channel = await db.alertChannel.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.config !== undefined && { config: body.config }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    });

    return NextResponse.json(channel);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to update alert channel:", error);
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

    const existing = await db.alertChannel.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.projectId, userId, "EDITOR");

    await db.alertChannel.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to delete alert channel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
