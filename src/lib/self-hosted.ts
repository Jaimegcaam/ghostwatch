/**
 * Instance access policy.
 *
 * Ghostwatch defaults to a private, invitation-only deployment:
 * - Set OPEN_REGISTRATION=true to allow anyone to sign up (each gets their own team).
 * - Otherwise only the first user (or OWNER_EMAIL) bootstraps; everyone else needs an invite.
 *
 * Never expose OWNER_EMAIL in API/UI responses — use publicAuthMessage() only.
 */

import { db } from "@/lib/db";
import {
  type RegistrationDenialCode,
  publicAuthMessage as messageForCode,
} from "@/lib/self-hosted-messages";

export {
  INVALID_CREDENTIALS_MESSAGE,
  SIGN_IN_DENIED_MESSAGE,
  REGISTRATION_DENIED_MESSAGE,
  REGISTRATION_CLOSED_MESSAGE,
} from "@/lib/self-hosted-messages";

export function isSelfHosted(): boolean {
  // Private/self-hosted is the default and only supported mode. Set
  // SELF_HOSTED=false only to opt out of self-hosted conveniences (e.g. owner
  // auto-verification); the invitation-only access policy still applies.
  return process.env.SELF_HOSTED !== "false";
}

export function isProbeWorker(): boolean {
  return process.env.PROBE_WORKER === "true";
}

export function shouldUseInProcessChecks(): boolean {
  if (isProbeWorker()) return false;
  if (process.env.USE_EDGE_PROBES === "true") return false;
  if (isSelfHosted()) return true;
  if (!process.env.VERCEL) return true;
  return false;
}

export function shouldEnableBuiltinScheduler(): boolean {
  if (process.env.PROBE_WORKER === "true") return false;
  if (process.env.ENABLE_BUILTIN_SCHEDULER === "false") return false;
  if (process.env.ENABLE_BUILTIN_SCHEDULER === "true") return true;
  return isSelfHosted();
}

export function ownerEmail(): string | null {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return email && email.length > 0 ? email : null;
}

export function appHost(): string | null {
  const url = process.env.APP_HOST || process.env.NEXTAUTH_URL;
  if (!url) return null;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Open/public registration when OPEN_REGISTRATION=true.
 * Default is invitation-only after the first owner bootstraps the instance.
 */
export function isOpenRegistrationEnabled(): boolean {
  return process.env.OPEN_REGISTRATION === "true";
}

export type RegistrationDecision =
  | { allowed: true; reason: "open" | "bootstrap" | "owner" | "invitation" }
  | { allowed: false; code: RegistrationDenialCode };

/** Safe message for API responses — never includes OWNER_EMAIL. */
export function publicAuthMessage(
  decision: Extract<RegistrationDecision, { allowed: false }>,
): string {
  return messageForCode(decision.code);
}

export async function canRegister(email: string): Promise<RegistrationDecision> {
  const norm = email.trim().toLowerCase();

  // First user bootstraps the instance and becomes the owner.
  const userCount = await db.user.count();
  if (userCount === 0) {
    const expected = ownerEmail();
    if (expected && norm !== expected) {
      return { allowed: false, code: "bootstrap_denied" };
    }
    return { allowed: true, reason: "bootstrap" };
  }

  // The configured owner can always (re)create their account.
  if (ownerEmail() === norm) {
    return { allowed: true, reason: "owner" };
  }

  if (isOpenRegistrationEnabled()) {
    return { allowed: true, reason: "open" };
  }

  // Everyone else needs a pending team invitation for their email.
  const pending = await db.teamInvitation.findFirst({
    where: {
      email: norm,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (pending) {
    return { allowed: true, reason: "invitation" };
  }

  return { allowed: false, code: "closed" };
}

/**
 * Login: only existing users with a password may sign in via credentials.
 * Returns false for unknown emails without revealing the owner address.
 */
export async function canSignInWithCredentials(email: string): Promise<boolean> {
  const norm = email.trim().toLowerCase();

  const user = await db.user.findUnique({
    where: { email: norm },
    select: { id: true, hashedPassword: true },
  });

  return !!user?.hashedPassword;
}
