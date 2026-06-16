import { NextResponse } from "next/server";

import { getDomainSetupInfo } from "@/lib/status-domains";
import { requireSession } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

/** DNS / reverse-proxy instructions for custom status-page domains. */
export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(getDomainSetupInfo());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
