import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, requireProjectAccess, getUserProjectIds, TeamAuthError } from "@/lib/team-auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSession();
    const projectId = request.nextUrl.searchParams.get("projectId");
    const status = request.nextUrl.searchParams.get("status");
    const checkId = request.nextUrl.searchParams.get("checkId");

    let projectIds: string[];
    if (projectId) {
      await requireProjectAccess(projectId, userId, "VIEWER");
      projectIds = [projectId];
    } else {
      projectIds = await getUserProjectIds(userId);
    }

    const where: Record<string, unknown> = {
      check: { projectId: { in: projectIds } },
    };
    if (status) where.status = status;
    if (checkId) where.checkId = checkId;

    const incidents = await db.incident.findMany({
      where,
      include: {
        check: { select: { id: true, name: true, url: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 100,
    });

    return NextResponse.json(incidents);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
