import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "@/lib/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
  });

  it("allows requests under the limit", () => {
    const first = checkRateLimit("test-key", 3, 60_000, 1_000);
    expect(first.ok).toBe(true);
  });

  it("blocks requests over the limit", () => {
    const now = 1_000;
    expect(checkRateLimit("blocked", 2, 60_000, now).ok).toBe(true);
    expect(checkRateLimit("blocked", 2, 60_000, now + 1).ok).toBe(true);
    const third = checkRateLimit("blocked", 2, 60_000, now + 2);
    expect(third.ok).toBe(false);
  });
});
