import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authPasswordField } from "@/lib/auth-email";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/logger";
import { enforceAuthRateLimit } from "@/lib/auth-rate-limit";

const resetSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: authPasswordField,
});

export async function POST(request: Request) {
  const ipLimit = enforceAuthRateLimit(request, "reset", 15);
  if (ipLimit) return ipLimit;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { token, password } = parsed.data;

  const resetToken = await db.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken || resetToken.expires < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired reset link. Please request a new one." },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await db.user.update({
    where: { email: resetToken.email },
    data: { hashedPassword },
  });

  await db.passwordResetToken.delete({ where: { id: resetToken.id } });
  logEvent("info", "auth.password_reset.completed");

  return NextResponse.json({ ok: true });
}
