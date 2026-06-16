import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, requireTeamRole, TeamAuthError } from "@/lib/team-auth";
import type { TeamRole } from "@/generated/prisma/client";

const VALID_ROLES: TeamRole[] = ["ADMIN", "EDITOR", "VIEWER"];

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const userId = await requireSession();
    const { id, memberId } = await params;
    await requireTeamRole(id, userId, "ADMIN");

    const body = await request.json();
    const { role } = body;

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const target = await db.teamMember.findUnique({ where: { id: memberId } });
    if (!target || target.teamId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent demoting yourself if you're the last admin
    if (target.userId === userId && role !== "ADMIN") {
      const adminCount = await db.teamMember.count({
        where: { teamId: id, role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin. Promote another member first." },
          { status: 400 },
        );
      }
    }

    const updated = await db.teamMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const userId = await requireSession();
    const { id, memberId } = await params;
    await requireTeamRole(id, userId, "ADMIN");

    const target = await db.teamMember.findUnique({ where: { id: memberId } });
    if (!target || target.teamId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (target.userId === userId) {
      const adminCount = await db.teamMember.count({
        where: { teamId: id, role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin." },
          { status: 400 },
        );
      }
    }

    await db.teamMember.delete({ where: { id: memberId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
