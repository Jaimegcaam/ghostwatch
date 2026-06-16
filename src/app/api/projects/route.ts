import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { allocateUniqueProjectSlug, ensureDefaultProject } from "@/lib/team-projects";
import { requireSession, getUserTeams, requireTeamRole, TeamAuthError } from "@/lib/team-auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSession();
    const teamId = request.nextUrl.searchParams.get("teamId");

    if (teamId) {
      const membership = await requireTeamRole(teamId, userId, "VIEWER");
      let projects = await db.project.findMany({
        where: { teamId },
        include: { _count: { select: { checks: true, statusPages: true } } },
        orderBy: { createdAt: "desc" },
      });

      // Legacy teams created without a project — auto-provision for editors/admins
      if (
        projects.length === 0 &&
        (membership.role === "ADMIN" || membership.role === "EDITOR")
      ) {
        const team = await db.team.findUnique({
          where: { id: teamId },
          select: { name: true, slug: true },
        });
        if (team) {
          await ensureDefaultProject(teamId, team.name, team.slug);
          projects = await db.project.findMany({
            where: { teamId },
            include: { _count: { select: { checks: true, statusPages: true } } },
            orderBy: { createdAt: "desc" },
          });
        }
      }

      return NextResponse.json(projects);
    }

    const memberships = await getUserTeams(userId);
    const teamIds = memberships.map((m) => m.teamId);

    const projects = await db.project.findMany({
      where: { teamId: { in: teamIds } },
      include: {
        _count: { select: { checks: true, statusPages: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to list projects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSession();
    const body = await request.json();
    const { name, teamId } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    }

    await requireTeamRole(teamId, userId, "EDITOR");

    const slug = await allocateUniqueProjectSlug(name);

    const project = await db.project.create({
      data: { name: name.trim(), slug, teamId },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
