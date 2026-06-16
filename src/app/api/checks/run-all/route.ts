import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runCheck } from "@/lib/checker";
import { requireSession, getUserProjectIds, TeamAuthError } from "@/lib/team-auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userId = await requireSession();
    const projectIds = await getUserProjectIds(userId);

    if (projectIds.length === 0) {
      return NextResponse.json({ error: "No project found" }, { status: 404 });
    }

    const checks = await db.check.findMany({
      where: { projectId: { in: projectIds }, enabled: true },
    });

    if (checks.length === 0) {
      return NextResponse.json({ ok: true, ran: 0, message: "No enabled checks" });
    }

    const results = await Promise.allSettled(
      checks.flatMap((check) =>
        check.regions.map((region) => runCheck(check.id, region)),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ ok: true, ran: checks.length, regions: results.length, succeeded, failed });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
