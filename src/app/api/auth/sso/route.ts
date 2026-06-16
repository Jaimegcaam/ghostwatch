import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOAuthController } from "@/lib/jackson";

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const team = await db.team.findFirst({
      where: {
        ssoEnabled: true,
        ssoDomain: domain,
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "No SSO configuration found for this email domain" },
        { status: 404 },
      );
    }

    const oauthController = await getOAuthController();
    const { redirect_url } = await oauthController.authorize({
      tenant: team.id,
      product: "signal",
      redirect_uri: `${APP_URL}/api/auth/saml/callback`,
      state: JSON.stringify({ teamId: team.id }),
      client_id: "dummy",
      response_type: "code",
      code_challenge: "",
      code_challenge_method: "",
    } as unknown as Parameters<typeof oauthController.authorize>[0]);

    return NextResponse.json({ redirectUrl: redirect_url });
  } catch (error) {
    console.error("SSO initiation error:", error);
    return NextResponse.json({ error: "SSO initiation failed" }, { status: 500 });
  }
}
