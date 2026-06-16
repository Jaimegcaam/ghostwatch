import type { NextRequest } from "next/server";
import { createProbeHandler } from "@/lib/probe";

/**
 * Generic regional probe route for self-hosted workers and custom region ids
 * (e.g. eu-south-2). Named routes like /api/probe/us-east-1 take precedence
 * on Vercel Edge where preferredRegion is pinned.
 */
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ region: string }> },
) {
  const { region } = await context.params;
  return createProbeHandler(region)(request);
}
