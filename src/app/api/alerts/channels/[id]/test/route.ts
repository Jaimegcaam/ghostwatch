import { NextRequest, NextResponse } from "next/server";

import { sendAlertToChannel } from "@/lib/alerting";
import { db } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { requireSession, requireProjectAccess, TeamAuthError } from "@/lib/team-auth";

type Params = { id: string };

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;

    const channel = await db.alertChannel.findUnique({ where: { id } });
    if (!channel) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requireProjectAccess(channel.projectId, userId, "EDITOR");

    if (channel.type === "EMAIL" && !isEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            "Email is not configured on this server. Set RESEND_API_KEY (and optionally FROM_EMAIL) in your environment.",
          emailConfigured: false,
        },
        { status: 503 },
      );
    }

    const sent = await sendAlertToChannel(
      channel.id,
      "This is a test alert from Ghostwatch. If you received this, notifications are working.",
      {
        checkName: "Test monitor",
        url: process.env.NEXTAUTH_URL || "http://localhost:3000",
        status: 503,
        responseTime: 0,
        error: "Test alert — not a real outage",
        region: process.env.PROBE_REGION || "local",
      },
      { throwOnError: true },
    );

    if (!sent) {
      return NextResponse.json(
        { error: "Channel is disabled or could not be reached" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      emailConfigured: channel.type === "EMAIL" ? isEmailConfigured() : undefined,
    });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to send test alert:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send test alert",
      },
      { status: 500 },
    );
  }
}
