import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeCheck } from "@/lib/checker";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

type Params = { id: string };

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;

    const check = await db.check.findUnique({ where: { id } });
    if (!check) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(check.projectId, userId, "EDITOR");

    const result = await executeCheck(check);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to test check:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
