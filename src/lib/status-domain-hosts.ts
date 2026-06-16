/**
 * Host/env helpers for custom status-page domains.
 * Edge-safe (no node:dns, no Prisma) — used by middleware.
 */

/** Hostnames that run the full dashboard (not custom status-only domains). */
export function getMainAppHosts(): Set<string> {
  const out = new Set<string>();
  const add = (v?: string | null) => {
    if (!v) return;
    try {
      const host = new URL(v.includes("://") ? v : `https://${v}`).hostname;
      out.add(host.split(":")[0].toLowerCase());
    } catch {
      out.add(v.split(":")[0].toLowerCase());
    }
  };

  add(process.env.APP_HOST);
  add(process.env.NEXTAUTH_URL);
  add(process.env.STATUS_CNAME_TARGET);

  // Vercel injects these per deployment — treat as main app hosts when APP_HOST
  // was not updated yet (common on first deploy / preview URLs).
  for (const key of [
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
  ] as const) {
    const host = process.env[key]?.trim();
    if (host) add(`https://${host}`);
  }

  out.add("localhost");
  out.add("127.0.0.1");
  out.add("0.0.0.0");
  return out;
}

/** Where customers point their CNAME (defaults to the main app hostname). */
export function getStatusCnameTarget(): string {
  const explicit = process.env.STATUS_CNAME_TARGET?.trim();
  if (explicit) {
    try {
      return new URL(
        explicit.includes("://") ? explicit : `https://${explicit}`,
      ).hostname.toLowerCase();
    } catch {
      return explicit.split(":")[0].toLowerCase();
    }
  }

  const fromApp = process.env.APP_HOST?.trim();
  if (fromApp) {
    try {
      return new URL(
        fromApp.includes("://") ? fromApp : `https://${fromApp}`,
      ).hostname.toLowerCase();
    } catch {
      return fromApp.split(":")[0].toLowerCase();
    }
  }

  const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "localhost";
  }
}

export function getAppPublicOrigin(): string {
  const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
  try {
    return new URL(url).origin;
  } catch {
    return "http://localhost:3000";
  }
}
