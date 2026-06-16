import { NextRequest, NextResponse } from "next/server";
import { performHttpCheck } from "@/lib/http-check";

interface ProbePayload {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string | null;
  timeout: number;
  expectedStatus: number;
}

interface ProbeResult {
  status: number | null;
  responseTime: number;
  success: boolean;
  error: string | null;
  region: string;
}

/**
 * Regional probe handler for Vercel Edge deployments.
 * Self-hosted instances run checks in-process instead (see checker.ts).
 */
export function createProbeHandler(region: string) {
  return async function POST(
    request: NextRequest,
  ): Promise<NextResponse<ProbeResult>> {
    const secret = process.env.CRON_SECRET?.trim();
    const auth = request.headers.get("x-probe-secret")?.trim();
    if (!secret || auth !== secret) {
      return NextResponse.json(
        {
          status: null,
          responseTime: 0,
          success: false,
          error: "Unauthorized",
          region,
        },
        { status: 401 },
      );
    }

    let payload: ProbePayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        {
          status: null,
          responseTime: 0,
          success: false,
          error: "Invalid payload",
          region,
        },
        { status: 400 },
      );
    }

    const result = await performHttpCheck(payload);
    return NextResponse.json({ ...result, region });
  };
}
