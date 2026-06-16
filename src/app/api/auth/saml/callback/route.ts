import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOAuthController } from "@/lib/jackson";
import { signIn } from "@/lib/auth";

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const oauthController = await getOAuthController();

    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    const { access_token } = await oauthController.token({
      code: body.RelayState || body.code || "",
      client_id: "dummy",
      client_secret: "dummy",
      redirect_uri: `${APP_URL}/api/auth/saml/callback`,
      grant_type: "authorization_code",
    });

    const profile = await oauthController.userInfo(access_token);

    if (!profile?.email) {
      return NextResponse.redirect(new URL("/login?error=sso_no_email", APP_URL));
    }

    const email = profile.email.toLowerCase();
    const name = profile.firstName
      ? `${profile.firstName} ${profile.lastName || ""}`.trim()
      : email.split("@")[0];

    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name,
          emailVerified: new Date(),
        },
      });
    }

    const state = body.RelayState ? JSON.parse(body.RelayState) : {};
    const teamId = state.teamId || profile.requested?.tenant;

    if (teamId) {
      const existingMembership = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: user.id } },
      });
      if (!existingMembership) {
        await db.teamMember.create({
          data: { teamId, userId: user.id, role: "VIEWER" },
        });
      }
    }

    // Sign the user in via NextAuth credentials-like flow
    // Since we can't call signIn() server-side from a route handler directly,
    // we redirect to a special page that will complete the login
    const loginToken = Buffer.from(
      JSON.stringify({ userId: user.id, email: user.email, name: user.name }),
    ).toString("base64url");

    const redirectUrl = new URL("/api/auth/sso/complete", APP_URL);
    redirectUrl.searchParams.set("token", loginToken);
    if (teamId) {
      redirectUrl.searchParams.set("teamId", teamId);
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("SAML callback error:", error);
    return NextResponse.redirect(new URL("/login?error=sso_failed", APP_URL));
  }
}
