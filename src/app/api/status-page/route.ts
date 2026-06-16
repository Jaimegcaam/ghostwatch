import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  collectRawDomainsFromBody,
  domainListsEqual,
  formatStatusPageResponse,
  normalizeDomainListStrict,
  replaceStatusPageDomains,
  statusPageInclude,
  syncStatusPageDomains,
  validateDomainsForSync,
} from "@/lib/status-domains";
import { generateSlug } from "@/lib/utils";
import { parseStatusPageTheme } from "@/lib/status-page-theme";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

function isDomainConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Unique constraint") &&
    error.message.includes("domain")
  );
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSession();
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    await requireProjectAccess(projectId, userId, "VIEWER");

    const statusPages = await db.statusPage.findMany({
      where: { projectId },
      include: statusPageInclude,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(statusPages.map(formatStatusPageResponse));
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to get status pages:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSession();
    const body = await request.json();
    const {
      projectId,
      title,
      slug: rawSlug,
      description,
      isPublic,
      logoUrl,
      checkIds,
      theme: rawTheme,
    } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: "projectId and title are required" }, { status: 400 });
    }

    await requireProjectAccess(projectId, userId, "EDITOR");

    const slug = (rawSlug?.trim() || generateSlug(title)).toLowerCase();
    const existing = await db.statusPage.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "A status page with this slug already exists" }, { status: 409 });
    }

    if (checkIds?.length) {
      const validChecks = await db.check.findMany({
        where: { id: { in: checkIds }, projectId, isPublic: true },
        select: { id: true },
      });
      if (validChecks.length !== checkIds.length) {
        return NextResponse.json({ error: "Some checks are invalid or not public" }, { status: 400 });
      }
    }

    const domainInputs = collectRawDomainsFromBody(body);

    const statusPage = await db.statusPage.create({
      data: {
        projectId,
        title: title.trim(),
        slug,
        description: description?.trim() || null,
        isPublic: isPublic ?? true,
        theme: parseStatusPageTheme(rawTheme),
        logoUrl: logoUrl?.trim() || null,
        ...(checkIds?.length && {
          checks: { create: checkIds.map((checkId: string) => ({ checkId })) },
        }),
      },
    });

    if (domainInputs.length > 0) {
      try {
        await syncStatusPageDomains(statusPage.id, domainInputs);
      } catch (e) {
        await db.statusPage.delete({ where: { id: statusPage.id } });
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Invalid custom domain" },
          { status: 400 },
        );
      }
    }

    const full = await db.statusPage.findUnique({
      where: { id: statusPage.id },
      include: statusPageInclude,
    });

    return NextResponse.json(formatStatusPageResponse(full!), { status: 201 });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isDomainConstraintError(error)) {
      return NextResponse.json(
        { error: "One of these custom domains is already in use on another status page." },
        { status: 409 },
      );
    }
    console.error("Failed to create status page:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await requireSession();
    const body = await request.json();
    const { id, title, slug: rawSlug, description, isPublic, logoUrl, checkIds, theme: rawTheme } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await db.statusPage.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.projectId, userId, "EDITOR");

    if (rawSlug !== undefined) {
      const slug = rawSlug.trim().toLowerCase();
      const slugConflict = await db.statusPage.findUnique({ where: { slug } });
      if (slugConflict && slugConflict.id !== id) {
        return NextResponse.json({ error: "A status page with this slug already exists" }, { status: 409 });
      }
    }

    if (checkIds !== undefined && checkIds.length > 0) {
      const validChecks = await db.check.findMany({
        where: { id: { in: checkIds }, projectId: existing.projectId, isPublic: true },
        select: { id: true },
      });
      if (validChecks.length !== checkIds.length) {
        return NextResponse.json({ error: "Some checks are invalid or not public" }, { status: 400 });
      }
    }

    const shouldSyncDomains =
      body.customDomains !== undefined || body.customDomain !== undefined;

    // Only validate/replace domains when the list actually changed — editing
    // title, description, or theme must not re-validate or wipe DNS verification.
    let domainsToSync: string[] | null = null;
    if (shouldSyncDomains) {
      const { domains: requestedDomains, invalid } = normalizeDomainListStrict(
        collectRawDomainsFromBody(body),
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          {
            error: `"${invalid[0]}" is not a valid domain. Use a hostname like status.example.com.`,
          },
          { status: 400 },
        );
      }

      const existingDomains = await db.statusPageCustomDomain.findMany({
        where: { statusPageId: id },
        select: { domain: true },
      });
      const existingList = existingDomains.map((row) => row.domain);

      if (!domainListsEqual(existingList, requestedDomains)) {
        try {
          domainsToSync = await validateDomainsForSync(
            collectRawDomainsFromBody(body),
            id,
          );
        } catch (e) {
          return NextResponse.json(
            { error: e instanceof Error ? e.message : "Invalid custom domain" },
            { status: 400 },
          );
        }
      }
    }

    const statusPage = await db.$transaction(async (tx) => {
      await tx.statusPage.update({
        where: { id },
        data: {
          ...(title !== undefined && { title: title.trim() }),
          ...(rawSlug !== undefined && { slug: rawSlug.trim().toLowerCase() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(isPublic !== undefined && { isPublic }),
          ...(rawTheme !== undefined && { theme: parseStatusPageTheme(rawTheme) }),
          ...(logoUrl !== undefined && { logoUrl: logoUrl?.trim() || null }),
        },
      });

      if (checkIds !== undefined) {
        await tx.statusPageCheck.deleteMany({ where: { statusPageId: id } });
        if (checkIds.length > 0) {
          await tx.statusPageCheck.createMany({
            data: checkIds.map((checkId: string) => ({ statusPageId: id, checkId })),
          });
        }
      }

      if (domainsToSync !== null) {
        await replaceStatusPageDomains(tx, id, domainsToSync);
      }

      return tx.statusPage.findUnique({
        where: { id },
        include: statusPageInclude,
      });
    });

    return NextResponse.json(formatStatusPageResponse(statusPage!));
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isDomainConstraintError(error)) {
      return NextResponse.json(
        { error: "One of these custom domains is already in use on another status page." },
        { status: 409 },
      );
    }
    console.error("Failed to update status page:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireSession();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = await db.statusPage.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.projectId, userId, "EDITOR");

    await db.statusPage.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to delete status page:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
