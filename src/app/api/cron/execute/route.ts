import { NextRequest, NextResponse } from "next/server";
import { runCronTick } from "@/lib/cron-tick";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const authHeader = request.headers.get("authorization")?.trim() ?? "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = bearerMatch?.[1];
    if (!cronSecret || !token || token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await runCronTick();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("Cron execution failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
