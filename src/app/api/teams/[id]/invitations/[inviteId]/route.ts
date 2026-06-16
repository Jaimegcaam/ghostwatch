import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, requireTeamRole, TeamAuthError } from "@/lib/team-auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> },
) {
  try {
    const userId = await requireSession();
    const { id, inviteId } = await params;
    await requireTeamRole(id, userId, "ADMIN");

    const invitation = await db.teamInvitation.findUnique({
      where: { id: inviteId },
    });
    if (!invitation || invitation.teamId !== id) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    await db.teamInvitation.delete({ where: { id: inviteId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
