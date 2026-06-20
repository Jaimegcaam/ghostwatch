import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { updateCheckSchema } from "@/lib/check-schemas";
import { normalizeFolder } from "@/lib/check-folders";
import {
  RegionSelectionError,
  resolveMonitorRegions,
} from "@/lib/probe-health";
import { db } from "@/lib/db";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

type Params = { id: string };

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;

    const check = await db.check.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, teamId: true } },
        results: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!check) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(check.projectId, userId, "VIEWER");

    const { project: _, ...rest } = check;
    return NextResponse.json(rest);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to get check:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateCheckSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const existing = await db.check.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.projectId, userId, "EDITOR");

    const data = parsed.data;
    let resolvedRegions: string[] | undefined;
    if (data.regions !== undefined) {
      try {
        resolvedRegions = await resolveMonitorRegions(data.regions);
      } catch (error) {
        if (error instanceof RegionSelectionError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    const check = await db.check.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.method !== undefined && { method: data.method }),
        ...(data.headers !== undefined && {
          headers:
            data.headers === null ? Prisma.DbNull : data.headers,
        }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.expectedStatus !== undefined && { expectedStatus: data.expectedStatus }),
        ...(data.timeout !== undefined && { timeout: data.timeout }),
        ...(data.interval !== undefined && { interval: data.interval }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
        ...(resolvedRegions !== undefined && { regions: resolvedRegions }),
        ...(data.folder !== undefined && {
          folder: normalizeFolder(data.folder),
        }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });

    return NextResponse.json(check);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to update check:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;

    const existing = await db.check.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.projectId, userId, "EDITOR");

    await db.check.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to delete check:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
