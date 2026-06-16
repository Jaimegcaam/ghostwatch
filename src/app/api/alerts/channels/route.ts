import { NextRequest, NextResponse } from "next/server";
import { linkChannelToProjectChecks } from "@/lib/alert-rules";
import { db } from "@/lib/db";
import { ChannelType } from "@/generated/prisma/client";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

const VALID_CHANNEL_TYPES = new Set<string>(Object.values(ChannelType));

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSession();
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    await requireProjectAccess(projectId, userId, "VIEWER");

    const channels = await db.alertChannel.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(channels);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to list alert channels:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSession();
    const body = await request.json();
    const { type, name, config, projectId } = body;

    if (!type || !name || !config || !projectId) {
      return NextResponse.json(
        { error: "type, name, config, and projectId are required" },
        { status: 400 },
      );
    }

    if (!VALID_CHANNEL_TYPES.has(type)) {
      return NextResponse.json(
        { error: `Invalid channel type. Must be one of: ${[...VALID_CHANNEL_TYPES].join(", ")}` },
        { status: 400 },
      );
    }

    await requireProjectAccess(projectId, userId, "EDITOR");

    const channel = await db.alertChannel.create({
      data: { type: type as ChannelType, name, config, projectId },
    });

    await linkChannelToProjectChecks(channel.id, projectId);

    return NextResponse.json(channel, { status: 201 });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to create alert channel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
