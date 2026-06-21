import dns from "node:dns/promises";
import { z } from "zod";
import { isEmailConfigured } from "@/lib/email";
import { DISPOSABLE_EMAIL_DOMAINS } from "@/lib/disposable-email-domains";

const BLOCKED_LOCAL_PARTS = new Set([
  "abc",
  "admin",
  "anonymous",
  "asdf",
  "demo",
  "donotreply",
  "dummy",
  "email",
  "example",
  "fake",
  "guest",
  "invalid",
  "mail",
  "no-reply",
  "none",
  "noreply",
  "null",
  "placeholder",
  "qwerty",
  "sample",
  "spam",
  "temp",
  "test",
  "testing",
  "tmp",
  "trash",
  "undefined",
  "user",
  "xxx",
]);

export type EmailValidationResult =
  | { ok: true; email: string; domain: string }
  | { ok: false; error: string };

export function normalizeAuthEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function requiresEmailVerification(): boolean {
  if (process.env.REQUIRE_EMAIL_VERIFICATION === "true") return true;
  if (process.env.REQUIRE_EMAIL_VERIFICATION === "false") return false;
  return isEmailConfigured();
}

function skipMxValidation(): boolean {
  return process.env.SKIP_EMAIL_MX_CHECK === "true";
}

function localPart(email: string): string {
  return email.split("@")[0]?.split("+")[0] ?? "";
}

function domainPart(email: string): string {
  return email.split("@")[1] ?? "";
}

export function validateEmailFormat(raw: string): EmailValidationResult {
  const email = normalizeAuthEmail(raw);
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) {
    return { ok: false, error: "Invalid email address" };
  }

  const local = localPart(email);
  const domain = domainPart(email);

  if (local.length < 3) {
    return { ok: false, error: "Please use a personal or work email address" };
  }

  if (/^\d+$/.test(local)) {
    return { ok: false, error: "Please use a personal or work email address" };
  }

  if (BLOCKED_LOCAL_PARTS.has(local)) {
    return {
      ok: false,
      error: "Please use a real email address, not a placeholder like test@…",
    };
  }

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      ok: false,
      error: "Disposable email addresses are not allowed",
    };
  }

  if (domain === "example.com" || domain.endsWith(".example")) {
    return { ok: false, error: "Please use a real email address" };
  }

  return { ok: true, email, domain };
}

export async function validateEmailDeliverability(
  raw: string,
): Promise<EmailValidationResult> {
  const format = validateEmailFormat(raw);
  if (!format.ok) return format;

  if (skipMxValidation()) {
    return format;
  }

  try {
    const mx = await dns.resolveMx(format.domain);
    if (mx.length > 0) {
      return format;
    }
  } catch {
    // Fall through to A record lookup.
  }

  try {
    const addresses = await dns.resolve4(format.domain);
    if (addresses.length > 0) {
      return format;
    }
  } catch {
    // Fall through to error below.
  }

  return {
    ok: false,
    error: "This email domain cannot receive mail. Check the address and try again.",
  };
}

export async function validateAuthEmail(raw: string): Promise<EmailValidationResult> {
  return validateEmailDeliverability(raw);
}

export const authEmailField = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const result = validateEmailFormat(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error });
    }
  });

export const authPasswordField = z
  .string()
  .min(8, "Password must be at least 8 characters");
