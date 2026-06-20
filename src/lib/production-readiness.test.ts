import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  currentCheckSlot,
  floorToMinute,
  getNextCheckRunAt,
  isCheckDue,
  checkSlotEnd,
} from "@/lib/check-schedule";

describe("check-schedule", () => {
  it("floors timestamps to the start of the minute", () => {
    const input = new Date("2026-06-19T14:32:45.123Z");
    expect(floorToMinute(input).toISOString()).toBe("2026-06-19T14:32:00.000Z");
  });

  it("marks never-checked monitors as due", () => {
    expect(isCheckDue(null, 60)).toBe(true);
  });

  it("aligns long intervals to minute slots", () => {
    const now = new Date("2026-06-19T14:32:10.000Z");
    const last = new Date("2026-06-19T14:31:00.000Z");
    expect(isCheckDue(last, 60, now)).toBe(true);
    expect(currentCheckSlot(60, now).toISOString()).toBe("2026-06-19T14:32:00.000Z");
  });

  it("computes the next run after a completed slot", () => {
    const last = new Date("2026-06-19T14:00:00.000Z");
    expect(getNextCheckRunAt(last, 60).toISOString()).toBe("2026-06-19T14:01:00.000Z");
  });

  it("computes slot end windows", () => {
    const slot = new Date("2026-06-19T14:00:00.000Z");
    expect(checkSlotEnd(slot, 60).toISOString()).toBe("2026-06-19T14:01:00.000Z");
  });
});

describe("data-retention helpers", () => {
  const original = process.env.CHECK_RESULT_RETENTION_DAYS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CHECK_RESULT_RETENTION_DAYS;
    } else {
      process.env.CHECK_RESULT_RETENTION_DAYS = original;
    }
  });

  it("defaults to 90 days", async () => {
    delete process.env.CHECK_RESULT_RETENTION_DAYS;
    const { getCheckResultRetentionDays } = await import("@/lib/data-retention-policy");
    expect(getCheckResultRetentionDays()).toBe(90);
  });

  it("disables retention when set to 0", async () => {
    process.env.CHECK_RESULT_RETENTION_DAYS = "0";
    const { getCheckResultRetentionDays } = await import("@/lib/data-retention-policy");
    expect(getCheckResultRetentionDays()).toBe(0);
  });

  it("runs retention at the top of each UTC hour", async () => {
    const { shouldRunRetentionJob } = await import("@/lib/data-retention-policy");
    expect(shouldRunRetentionJob(new Date("2026-06-19T14:00:30.000Z"))).toBe(true);
    expect(shouldRunRetentionJob(new Date("2026-06-19T14:15:00.000Z"))).toBe(false);
  });
});

describe("url-security", () => {
  const original = process.env.ALLOW_PRIVATE_MONITOR_URLS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ALLOW_PRIVATE_MONITOR_URLS;
    } else {
      process.env.ALLOW_PRIVATE_MONITOR_URLS = original;
    }
  });

  beforeEach(() => {
    delete process.env.ALLOW_PRIVATE_MONITOR_URLS;
  });

  it("allows public https URLs", async () => {
    const { validateMonitorUrl } = await import("@/lib/url-security");
    const result = validateMonitorUrl("https://example.com/health");
    expect(result.ok).toBe(true);
  });

  it("blocks localhost targets", async () => {
    const { validateMonitorUrl } = await import("@/lib/url-security");
    const result = validateMonitorUrl("http://localhost:3000/api/health");
    expect(result.ok).toBe(false);
  });

  it("blocks private IPv4 literals", async () => {
    const { validateMonitorUrl } = await import("@/lib/url-security");
    expect(validateMonitorUrl("http://192.168.1.10/status").ok).toBe(false);
    expect(validateMonitorUrl("http://10.0.0.5/status").ok).toBe(false);
    expect(validateMonitorUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
  });

  it("blocks non-http schemes", async () => {
    const { validateMonitorUrl } = await import("@/lib/url-security");
    expect(validateMonitorUrl("file:///etc/passwd").ok).toBe(false);
  });

  it("allows private URLs when explicitly enabled for dev", async () => {
    process.env.ALLOW_PRIVATE_MONITOR_URLS = "true";
    const { validateMonitorUrl } = await import("@/lib/url-security");
    expect(validateMonitorUrl("http://127.0.0.1:3000").ok).toBe(true);
  });
});

describe("check-schemas", () => {
  it("rejects unsafe monitor URLs on create", async () => {
    const { createCheckSchema } = await import("@/lib/check-schemas");
    const parsed = createCheckSchema.safeParse({
      name: "Internal API",
      url: "http://127.0.0.1/admin",
      projectId: "proj_123",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts valid monitor payloads", async () => {
    const { createCheckSchema } = await import("@/lib/check-schemas");
    const parsed = createCheckSchema.safeParse({
      name: "Website",
      url: "https://example.com",
      projectId: "proj_123",
      interval: 60,
    });
    expect(parsed.success).toBe(true);
  });
});
