import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health endpoint for k8s/Docker/uptime checks.
 *
 * - GET /api/health?deep=true → also pings the database.
 * - GET /api/health → fast 200 OK if the process is up.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "true";

  if (!deep) {
    return NextResponse.json({ status: "ok" });
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        database: "down",
        error: error instanceof Error ? error.message : "unknown",
      },
      { status: 503 },
    );
  }
}
