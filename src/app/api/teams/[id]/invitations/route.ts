import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { validateAuthEmail } from "@/lib/auth-email";
import { db } from "@/lib/db";
import { sendTeamInvitationEmail } from "@/lib/email";
import { requireSession, requireTeamRole, TeamAuthError } from "@/lib/team-auth";
import type { TeamRole } from "@/generated/prisma/client";

const VALID_ROLES: TeamRole[] = ["ADMIN", "EDITOR", "VIEWER"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;
    await requireTeamRole(id, userId, "ADMIN");

    const invitations = await db.teamInvitation.findMany({
      where: { teamId: id, acceptedAt: null },
      include: {
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invitations);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;
    await requireTeamRole(id, userId, "ADMIN");

    const body = await request.json();
    const { email, role = "VIEWER" } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const validated = await validateAuthEmail(email);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const normalizedEmail = validated.email;

    const existingMember = await db.teamMember.findFirst({
      where: {
        teamId: id,
        user: { email: normalizedEmail },
      },
    });
    if (existingMember) {
      return NextResponse.json(
        { error: "This user is already a member of this team" },
        { status: 409 },
      );
    }

    const pendingInvite = await db.teamInvitation.findFirst({
      where: {
        teamId: id,
        email: normalizedEmail,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (pendingInvite) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 409 },
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await db.teamInvitation.create({
      data: {
        teamId: id,
        email: normalizedEmail,
        role,
        token,
        expiresAt,
        invitedById: userId,
      },
      include: {
        team: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
    });

    await sendTeamInvitationEmail(
      normalizedEmail,
      token,
      invitation.team.name,
      invitation.invitedBy.name || "A teammate",
    );

    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to create invitation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
