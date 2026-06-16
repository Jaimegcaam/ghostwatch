import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { token } = body;
  if (!token) {
    return NextResponse.json(
      { error: "Token is required" },
      { status: 400 }
    );
  }

  const verificationToken = await db.verificationToken.findFirst({
    where: { token },
  });

  if (!verificationToken || verificationToken.expires < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired verification link." },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { email: verificationToken.identifier },
    data: { emailVerified: new Date() },
  });

  await db.verificationToken.deleteMany({
    where: {
      identifier: verificationToken.identifier,
      token: verificationToken.token,
    },
  });

  return NextResponse.json({ ok: true });
}
