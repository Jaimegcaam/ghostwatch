import { NextRequest, NextResponse } from "next/server";
import { linkCheckToProjectChannels } from "@/lib/alert-rules";
import { normalizeFolder } from "@/lib/check-folders";
import {
  RegionSelectionError,
  resolveMonitorRegions,
} from "@/lib/probe-health";
import { db } from "@/lib/db";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSession();
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    await requireProjectAccess(projectId, userId, "VIEWER");

    const checks = await db.check.findMany({
      where: { projectId },
      include: {
        results: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(checks);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to list checks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSession();
    const body = await request.json();
    const {
      name, url, method, headers, body: checkBody,
      expectedStatus, timeout, interval, projectId, isPublic, regions,
      folder, sortOrder,
    } = body;

    if (!name || !url || !projectId) {
      return NextResponse.json({ error: "name, url, and projectId are required" }, { status: 400 });
    }

    await requireProjectAccess(projectId, userId, "EDITOR");

    let resolvedRegions: string[];
    try {
      resolvedRegions = await resolveMonitorRegions(regions);
    } catch (error) {
      if (error instanceof RegionSelectionError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    const check = await db.check.create({
      data: {
        name, url,
        method: method || "GET",
        headers: headers || undefined,
        body: checkBody || undefined,
        expectedStatus: expectedStatus ?? 200,
        timeout: timeout ?? 30000,
        interval: interval ?? 60,
        projectId,
        isPublic: isPublic ?? true,
        regions: resolvedRegions,
        folder: normalizeFolder(folder),
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
    });

    await linkCheckToProjectChannels(check.id, projectId);

    return NextResponse.json(check, { status: 201 });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to create check:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
