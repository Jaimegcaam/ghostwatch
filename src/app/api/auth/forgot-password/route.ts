import { NextResponse } from "next/server";
import crypto from "crypto";
import { validateAuthEmail } from "@/lib/auth-email";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { logEvent } from "@/lib/logger";
import {
  enforceAuthEmailRateLimit,
  enforceAuthRateLimit,
} from "@/lib/auth-rate-limit";

export async function POST(request: Request) {
  const ipLimit = enforceAuthRateLimit(request, "forgot:ip", 20);
  if (ipLimit) return ipLimit;

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const validated = await validateAuthEmail(email);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const emailLimit = enforceAuthEmailRateLimit(validated.email, "forgot", 3);
  if (emailLimit) return emailLimit;

  const user = await db.user.findUnique({ where: { email: validated.email } });

  if (!user) {
    return NextResponse.json({ ok: true });
  }

  await db.passwordResetToken.deleteMany({ where: { email: validated.email } });

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await db.passwordResetToken.create({
    data: { email: validated.email, token, expires },
  });

  await sendPasswordResetEmail(validated.email, token);
  logEvent("info", "auth.password_reset.requested", { userId: user.id });

  return NextResponse.json({ ok: true });
}
