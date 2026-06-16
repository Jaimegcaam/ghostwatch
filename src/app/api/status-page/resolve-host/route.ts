import { NextRequest, NextResponse } from "next/server";

import { normalizeCustomDomain } from "@/lib/status-domain-utils";
import { resolvePublicStatusPageByHost } from "@/lib/status-domains";

export const dynamic = "force-dynamic";

/** Resolve a custom hostname to a public status-page slug (used by middleware). */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("host")?.trim();
  const host = raw ? normalizeCustomDomain(raw) : null;
  if (!host) {
    return NextResponse.json({ error: "host required" }, { status: 400 });
  }

  const statusPage = await resolvePublicStatusPageByHost(host);
  if (!statusPage) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ slug: statusPage.slug, host });
}
