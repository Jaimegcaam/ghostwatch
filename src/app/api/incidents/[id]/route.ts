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

    const existing = await db.incident.findUnique({
      where: { id },
      include: { check: { select: { projectId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.check.projectId, userId, "EDITOR");

    const incident = await db.incident.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.status === "RESOLVED" && { resolvedAt: new Date() }),
      },
    });

    return NextResponse.json(incident);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
