import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { allocateUniqueProjectSlug } from "@/lib/team-projects";
import { generateSlug } from "@/lib/utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await db.teamMember.findMany({
      where: { userId: session.user.id },
      include: {
        team: {
          include: {
            _count: { select: { members: true, projects: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const teams = memberships.map((m) => ({
      ...m.team,
      role: m.role,
      memberCount: m.team._count.members,
      projectCount: m.team._count.projects,
    }));

    return NextResponse.json(teams);
  } catch (error) {
    console.error("Failed to list teams:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let slug = generateSlug(name);
    const existing = await db.team.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const trimmedName = name.trim();
    const projectSlug = await allocateUniqueProjectSlug(`${slug}-default`);

    const team = await db.team.create({
      data: {
        name: trimmedName,
        slug,
        members: {
          create: { userId: session.user.id, role: "ADMIN" },
        },
        projects: {
          create: {
            name: trimmedName,
            slug: projectSlug,
          },
        },
      },
      include: {
        projects: { select: { id: true, name: true, slug: true } },
        _count: { select: { members: true, projects: true } },
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("Failed to create team:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
