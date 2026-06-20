/**
 * SSRF guardrails for monitor URLs — blocks private networks and cloud metadata endpoints.
 */

export class MonitorUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonitorUrlError";
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
]);

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".localdomain"];

function allowPrivateMonitorUrls(): boolean {
  return process.env.ALLOW_PRIVATE_MONITOR_URLS === "true";
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (value < 0 || value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function normalizeIpv6(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = normalizeIpv6(hostname);
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;

  const ipv4 = parseIpv4(lower);
  if (ipv4 && isPrivateIpv4(ipv4)) return true;

  if (lower.includes(":") && isPrivateIpv6(lower)) return true;

  return false;
}

export function validateMonitorUrl(rawUrl: string):
  | { ok: true; url: URL }
  | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs are allowed" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "URLs with embedded credentials are not allowed" };
  }

  if (!allowPrivateMonitorUrls() && isBlockedHostname(parsed.hostname)) {
    return {
      ok: false,
      error: "This URL targets a private or restricted network address",
    };
  }

  return { ok: true, url: parsed };
}

export function assertSafeMonitorUrl(rawUrl: string): URL {
  const result = validateMonitorUrl(rawUrl);
  if (!result.ok) {
    throw new MonitorUrlError(result.error);
  }
  return result.url;
}
