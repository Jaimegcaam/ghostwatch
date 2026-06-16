import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, requireProjectAccess, getUserProjectIds, TeamAuthError } from "@/lib/team-auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSession();
    const channelId = request.nextUrl.searchParams.get("channelId");
    const checkId = request.nextUrl.searchParams.get("checkId");
    const projectId = request.nextUrl.searchParams.get("projectId");

    if (projectId) {
      await requireProjectAccess(projectId, userId, "VIEWER");
    }

    const where: Record<string, unknown> = {};
    if (channelId) where.alertChannelId = channelId;
    if (checkId) where.checkId = checkId;

    if (projectId) {
      where.check = { projectId };
    } else {
      const projectIds = await getUserProjectIds(userId);
      where.check = { projectId: { in: projectIds } };
    }

    const rules = await db.alertRule.findMany({
      where,
      include: {
        check: { select: { id: true, name: true, url: true, enabled: true } },
        alertChannel: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(rules);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSession();
    const body = await request.json();
    const { checkId, alertChannelId, consecutiveFailures, notifyOnRecovery, enabled } = body;

    if (!checkId || !alertChannelId) {
      return NextResponse.json(
        { error: "checkId and alertChannelId are required" },
        { status: 400 },
      );
    }

    const check = await db.check.findUnique({ where: { id: checkId }, select: { projectId: true } });
    if (!check) {
      return NextResponse.json({ error: "Check not found" }, { status: 404 });
    }

    await requireProjectAccess(check.projectId, userId, "EDITOR");

    const rule = await db.alertRule.create({
      data: {
        checkId,
        alertChannelId,
        consecutiveFailures: consecutiveFailures ?? 5,
        notifyOnRecovery: notifyOnRecovery ?? true,
        enabled: enabled ?? true,
      },
      include: {
        check: { select: { id: true, name: true } },
        alertChannel: { select: { id: true, name: true, type: true } },
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
