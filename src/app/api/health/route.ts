import { NextResponse } from "next/server";
import { requiresEmailVerification } from "@/lib/auth-email";
import { db } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { shouldEnableBuiltinScheduler } from "@/lib/self-hosted";
import { APP_VERSION } from "@/lib/version";

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

  const base = {
    status: "ok" as const,
    version: APP_VERSION,
    emailConfigured: isEmailConfigured(),
    requiresEmailVerification: requiresEmailVerification(),
    builtinScheduler: shouldEnableBuiltinScheduler(),
  };

  if (!deep) {
    return NextResponse.json(base);
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ...base, database: "ok" });
  } catch (error) {
    return NextResponse.json(
      {
        ...base,
        status: "degraded",
        database: "down",
        error: error instanceof Error ? error.message : "unknown",
      },
      { status: 503 },
    );
  }
}
