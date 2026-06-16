import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { verifyCustomDomainDns } from "@/lib/status-domain-dns";
import { normalizeCustomDomain } from "@/lib/status-domain-utils";
import { requireProjectAccess, requireSession, TeamAuthError } from "@/lib/team-auth";

type Params = { id: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;

    const page = await db.statusPage.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        isPublic: true,
        customDomains: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!page) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(page.projectId, userId, "VIEWER");

    const body = await request.json().catch(() => ({}));
    const fromBody =
      typeof body.domain === "string"
        ? normalizeCustomDomain(body.domain)
        : null;
    const domain = fromBody ?? page.customDomains[0]?.domain ?? null;

    if (!domain) {
      return NextResponse.json(
        { error: "Add at least one custom domain before verifying DNS." },
        { status: 400 },
      );
    }

    if (!page.isPublic) {
      return NextResponse.json(
        {
          verified: false,
          message: "Enable “Public” on this status page before using a custom domain.",
        },
        { status: 400 },
      );
    }

    const dns = await verifyCustomDomainDns(domain);

    // Persist verification state so the UI reflects it after reload.
    await db.statusPageCustomDomain.updateMany({
      where: { statusPageId: id, domain },
      data: {
        verified: dns.verified,
        verifiedAt: dns.verified ? new Date() : null,
      },
    });

    return NextResponse.json({
      domain,
      ...dns,
    });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Domain verification failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
