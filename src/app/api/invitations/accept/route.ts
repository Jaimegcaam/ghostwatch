import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const invitation = await db.teamInvitation.findUnique({
      where: { token },
      include: { team: { select: { id: true, name: true } } },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
    }

    if (invitation.acceptedAt) {
      return NextResponse.json({ error: "This invitation has already been accepted" }, { status: 400 });
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invitation has expired" }, { status: 400 });
    }

    if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: `This invitation was sent to ${invitation.email}. Please log in with that email to accept it.`,
          wrongEmail: true,
          expectedEmail: invitation.email,
        },
        { status: 403 },
      );
    }

    const existingMember = await db.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: invitation.teamId,
          userId: session.user.id,
        },
      },
    });

    if (existingMember) {
      await db.teamInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return NextResponse.json({
        ok: true,
        teamId: invitation.teamId,
        teamName: invitation.team.name,
        message: "You are already a member of this team",
      });
    }

    await db.$transaction([
      db.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId: session.user.id,
          role: invitation.role,
        },
      }),
      db.teamInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      teamId: invitation.teamId,
      teamName: invitation.team.name,
    });
  } catch (error) {
    console.error("Failed to accept invitation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
