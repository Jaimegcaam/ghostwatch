import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import {
  canRegister,
  isSelfHosted,
  publicAuthMessage,
} from "@/lib/self-hosted";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
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

  const { name, email, password } = parsed.data;
  const emailNorm = email.toLowerCase().trim();

  // Enforce instance registration policy (self-hosted: closed by default)
  const decision = await canRegister(emailNorm);
  if (!decision.allowed) {
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

    // On a self-hosted instance, the first user is auto-verified (owner bootstrap)
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
      select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
    });

    if (decision.reason === "invitation") {
      // Invited users join the team they were invited to — no personal team.
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
      // First user (bootstrap) or owner re-registration: create their own team.
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

    // On a self-hosted instance the owner doesn't need to verify by email —
    // skip the verification step if we already auto-verified them above.
    if (!autoVerify) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.verificationToken.create({
        data: { identifier: emailNorm, token, expires },
      });
      await sendVerificationEmail(emailNorm, token);
    }

    return NextResponse.json(user, { status: 201 });
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
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
