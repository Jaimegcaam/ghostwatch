import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, requireTeamRole, TeamAuthError } from "@/lib/team-auth";
import { getConnectionController } from "@/lib/jackson";

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;
    await requireTeamRole(id, userId, "ADMIN");

    const team = await db.team.findUnique({
      where: { id },
      select: {
        ssoEnabled: true,
        ssoProvider: true,
        ssoDomain: true,
        ssoMetadataUrl: true,
      },
    });

    return NextResponse.json(team);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireSession();
    const { id } = await params;
    await requireTeamRole(id, userId, "ADMIN");

    const body = await request.json();
    const { ssoEnabled, ssoDomain, ssoMetadataUrl, ssoProvider } = body;

    if (ssoEnabled && ssoMetadataUrl && ssoDomain) {
      const connectionController = await getConnectionController();

      try {
        await connectionController.createSAMLConnection({
          encodedRawMetadata: "",
          metadataUrl: ssoMetadataUrl,
          defaultRedirectUrl: `${APP_URL}/api/auth/saml/callback`,
          redirectUrl: [APP_URL],
          tenant: id,
          product: "signal",
          name: ssoProvider || "SAML SSO",
          description: `SSO for team ${id}`,
        });
      } catch (err) {
        console.error("Failed to create SAML connection:", err);
        return NextResponse.json(
          { error: "Failed to configure SAML connection. Check your metadata URL." },
          { status: 400 },
        );
      }
    }

    const team = await db.team.update({
      where: { id },
      data: {
        ssoEnabled: ssoEnabled ?? false,
        ssoProvider: ssoProvider || null,
        ssoDomain: ssoDomain || null,
        ssoMetadataUrl: ssoMetadataUrl || null,
      },
    });

    return NextResponse.json(team);
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to update SSO:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
