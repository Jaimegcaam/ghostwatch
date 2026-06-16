import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const teamId = request.nextUrl.searchParams.get("teamId");

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=missing_token", APP_URL));
    }

    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
    const { userId, email, name } = decoded;

    if (!userId || !email) {
      return NextResponse.redirect(new URL("/login?error=invalid_token", APP_URL));
    }

    const jwt = await encode({
      token: { id: userId, email, name, sub: userId },
      secret: SECRET,
      maxAge: 30 * 24 * 60 * 60,
      salt: "authjs.session-token",
    });

    const cookieStore = await cookies();
    cookieStore.set("authjs.session-token", jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    if (teamId) {
      cookieStore.set("active-team-id", teamId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return NextResponse.redirect(new URL("/dashboard", APP_URL));
  } catch (error) {
    console.error("SSO complete error:", error);
    return NextResponse.redirect(new URL("/login?error=sso_complete_failed", APP_URL));
  }
}
