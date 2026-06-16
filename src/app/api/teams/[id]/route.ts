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

    const team = await db.team.findUnique({
      where: { id },
      include: {
        _count: { select: { members: true, projects: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(team);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to get team:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;
    await requireTeamRole(id, userId, "ADMIN");

    const body = await request.json();
    const { name, slug, imageUrl } = body;

    const data: Record<string, unknown> = {};
    if (name && typeof name === "string") data.name = name.trim();
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (slug && typeof slug === "string") {
      const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
      const existing = await db.team.findUnique({ where: { slug: clean } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
      }
      data.slug = clean;
    }

    const team = await db.team.update({ where: { id }, data });
    return NextResponse.json(team);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to update team:", error);
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
    await requireTeamRole(id, userId, "ADMIN");

    await db.team.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to delete team:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
