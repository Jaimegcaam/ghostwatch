import { NextRequest, NextResponse } from "next/server";
import { discoverFromOpenAPI } from "@/lib/discovery";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSession();
    const body = await request.json();
    const { specUrl, projectId } = body;

    if (!specUrl || typeof specUrl !== "string") {
      return NextResponse.json({ error: "specUrl is required" }, { status: 400 });
    }
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    await requireProjectAccess(projectId, userId, "EDITOR");

    const suggestions = await discoverFromOpenAPI(specUrl.trim());
    return NextResponse.json({ suggestions, count: suggestions.length });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to parse specification";
    console.error("Failed to discover endpoints:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
