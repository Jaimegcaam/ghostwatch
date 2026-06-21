import { describe, expect, it, afterEach } from "vitest";
import {
  normalizeAuthEmail,
  validateEmailFormat,
  requiresEmailVerification,
} from "@/lib/auth-email";

describe("auth-email", () => {
  afterEach(() => {
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
    delete process.env.RESEND_API_KEY;
  });

  it("normalizes email addresses", () => {
    expect(normalizeAuthEmail("  Test@Example.COM ")).toBe("test@example.com");
  });

  it("blocks placeholder local parts like test@gmail.com", () => {
    const result = validateEmailFormat("test@gmail.com");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/real email/i);
    }
  });

  it("blocks disposable providers", () => {
    expect(validateEmailFormat("person@mailinator.com").ok).toBe(false);
  });

  it("allows normal work emails", () => {
    expect(validateEmailFormat("jaime.garcia@company.com").ok).toBe(true);
  });

  it("requires verification when Resend is configured", () => {
    process.env.RESEND_API_KEY = "re_test";
    expect(requiresEmailVerification()).toBe(true);
  });
});
