import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isEmailConfigured, sendVerificationEmail } from "@/lib/email";
import { logEvent } from "@/lib/logger";
import { enforceAuthRateLimit } from "@/lib/auth-rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipLimit = enforceAuthRateLimit(request, "resend-verification", 10);
  if (ipLimit) return ipLimit;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });

  if (!user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  await db.verificationToken.deleteMany({
    where: { identifier: user.email },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.verificationToken.create({
    data: { identifier: user.email, token, expires },
  });

  const sent = await sendVerificationEmail(user.email, token);
  if (!sent && isEmailConfigured()) {
    logEvent("error", "auth.verification.resend_failed");
    return NextResponse.json(
      { error: "Could not send verification email. Try again later." },
      { status: 503 },
    );
  }

  logEvent("info", "auth.verification.resent", { userId: session.user.id });
  return NextResponse.json({ ok: true });
}
