import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import {
  authEmailField,
  authPasswordField,
  normalizeAuthEmail,
  requiresEmailVerification,
  validateAuthEmail,
} from "@/lib/auth-email";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { logEvent } from "@/lib/logger";
import {
  enforceAuthEmailRateLimit,
  enforceAuthRateLimit,
} from "@/lib/auth-rate-limit";
import {
  canRegister,
  isSelfHosted,
  publicAuthMessage,
} from "@/lib/self-hosted";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: authEmailField,
  password: authPasswordField,
});

function slugFromName(name: string): string {
  const raw = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return raw || "project";
}

function isPrismaUniqueViolation(
  error: unknown
): error is { code: string; meta?: { target?: string | string[] } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

function metaTarget(error: {
  meta?: { target?: string | string[] };
}): string[] {
  const t = error.meta?.target;
  if (Array.isArray(t)) return t;
  if (typeof t === "string") return [t];
  return [];
}

async function allocateUniqueSlug(
  name: string,
  table: "team" | "project",
): Promise<string> {
  const base = slugFromName(name);
  let candidate = base;
  let n = 2;
  for (;;) {
    const existing =
      table === "team"
        ? await db.team.findUnique({ where: { slug: candidate }, select: { id: true } })
        : await db.project.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 1002) {
      throw new Error(`Could not allocate a unique ${table} slug`);
    }
  }
}

export async function POST(request: Request) {
  const ipLimit = enforceAuthRateLimit(request, "register:ip", 30);
  if (ipLimit) {
    logEvent("warn", "auth.register.rate_limited", { scope: "ip" });
    return ipLimit;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, password } = parsed.data;
  const emailNorm = normalizeAuthEmail(parsed.data.email);

  const emailLimit = enforceAuthEmailRateLimit(emailNorm, "register", 5);
  if (emailLimit) {
    logEvent("warn", "auth.register.rate_limited", { scope: "email" });
    return emailLimit;
  }

  const deliverability = await validateAuthEmail(emailNorm);
  if (!deliverability.ok) {
    return NextResponse.json(
      { error: deliverability.error, issues: [{ path: ["email"], message: deliverability.error }] },
      { status: 400 },
    );
  }

  const decision = await canRegister(emailNorm);
  if (!decision.allowed) {
    logEvent("warn", "auth.register.denied", { code: decision.code });
    return NextResponse.json(
      {
        error: publicAuthMessage(decision),
        closed: decision.code === "closed",
      },
      { status: 403 },
    );
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const teamSlug = await allocateUniqueSlug(name, "team");
    const projectSlug = await allocateUniqueSlug(name, "project");

    const autoVerify =
      isSelfHosted() &&
      (decision.reason === "bootstrap" ||
        decision.reason === "owner" ||
        decision.reason === "invitation" ||
        decision.reason === "open");

    const user = await db.user.create({
      data: {
        name,
        email: emailNorm,
        hashedPassword,
        emailVerified: autoVerify ? new Date() : null,
      },
      select: { id: true, name: true, email: true, createdAt: true, updatedAt: true, emailVerified: true },
    });

    if (decision.reason === "invitation") {
      const invitations = await db.teamInvitation.findMany({
        where: {
          email: emailNorm,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      for (const invitation of invitations) {
        await db.$transaction([
          db.teamMember.create({
            data: {
              teamId: invitation.teamId,
              userId: user.id,
              role: invitation.role,
            },
          }),
          db.teamInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
          }),
        ]);
      }
    } else {
      await db.team.create({
        data: {
          name: `${name}'s Team`,
          slug: teamSlug,
          members: {
            create: { userId: user.id, role: "ADMIN" },
          },
          projects: {
            create: { name, slug: projectSlug },
          },
        },
      });
    }

    let requiresVerification = false;
    if (!autoVerify) {
      requiresVerification = requiresEmailVerification();
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.verificationToken.create({
        data: { identifier: emailNorm, token, expires },
      });
      await sendVerificationEmail(emailNorm, token);
    }

    logEvent("info", "auth.register.success", {
      userId: user.id,
      requiresVerification,
    });

    return NextResponse.json(
      {
        ...user,
        requiresVerification,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (isPrismaUniqueViolation(error)) {
      const target = metaTarget(error);
      if (target.includes("email")) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
      if (target.includes("slug")) {
        return NextResponse.json(
          { error: "Could not create a unique project slug. Try again." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "A record with this value already exists" },
        { status: 409 }
      );
    }
    logEvent("error", "auth.register.failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
