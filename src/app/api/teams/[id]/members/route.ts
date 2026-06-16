import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, requireTeamRole, TeamAuthError } from "@/lib/team-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;
    await requireTeamRole(id, userId, "VIEWER");

    const members = await db.teamMember.findMany({
      where: { teamId: id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
