import { NextRequest, NextResponse } from "next/server";
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
    const body = await request.json();

    const existing = await db.check.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(existing.projectId, userId, "EDITOR");

    let resolvedRegions: string[] | undefined;
    if (body.regions !== undefined) {
      try {
        resolvedRegions = await resolveMonitorRegions(body.regions);
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
        ...(body.name !== undefined && { name: body.name }),
        ...(body.url !== undefined && { url: body.url }),
        ...(body.method !== undefined && { method: body.method }),
        ...(body.headers !== undefined && { headers: body.headers }),
        ...(body.body !== undefined && { body: body.body }),
        ...(body.expectedStatus !== undefined && { expectedStatus: body.expectedStatus }),
        ...(body.timeout !== undefined && { timeout: body.timeout }),
        ...(body.interval !== undefined && { interval: body.interval }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
        ...(resolvedRegions !== undefined && { regions: resolvedRegions }),
        ...(body.folder !== undefined && {
          folder: normalizeFolder(body.folder),
        }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
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
