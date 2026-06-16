import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token, password } = body;
  if (!token || !password) {
    return NextResponse.json(
      { error: "Token and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

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

  return NextResponse.json({ ok: true });
}
