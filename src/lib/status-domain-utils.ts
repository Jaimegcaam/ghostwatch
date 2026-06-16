/** Pure domain helpers (safe for client components). */

export const DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** Strip protocol, paths, ports; return lowercase hostname or null. */
export function normalizeCustomDomain(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let host = raw;
  try {
    if (raw.includes("://")) {
      host = new URL(raw).hostname;
    } else if (raw.includes("/")) {
      host = new URL(`https://${raw}`).hostname;
    } else {
      host = raw.split("/")[0].split(":")[0];
    }
  } catch {
    host = raw.split("/")[0].split(":")[0];
  }

  host = host.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("www.")) host = host.slice(4);
  return host || null;
}

export function normalizeDomainList(
  inputs: (string | null | undefined)[],
): string[] {
  return normalizeDomainListStrict(inputs).domains;
}

/**
 * Normalize a list of domains, separating valid (deduped) hostnames from
 * entries that were provided but are not valid hostnames. Unlike
 * {@link normalizeDomainList}, invalid input is surfaced instead of being
 * silently dropped, so callers can report a clear error.
 */
export function normalizeDomainListStrict(
  inputs: (string | null | undefined)[],
): { domains: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const domains: string[] = [];
  const invalid: string[] = [];
  for (const input of inputs) {
    if (input == null) continue;
    const raw = String(input).trim();
    if (!raw) continue;
    const host = normalizeCustomDomain(raw);
    if (!host || !DOMAIN_RE.test(host)) {
      invalid.push(raw);
      continue;
    }
    if (seen.has(host)) continue;
    seen.add(host);
    domains.push(host);
  }
  return { domains, invalid };
}

/** Collect the raw (un-normalized) domain strings sent by a client. */
export function collectRawDomainsFromBody(body: {
  customDomains?: unknown;
  customDomain?: unknown;
}): string[] {
  const list: string[] = [];
  if (Array.isArray(body.customDomains)) {
    for (const item of body.customDomains) {
      if (typeof item === "string") list.push(item);
    }
  }
  if (typeof body.customDomain === "string" && body.customDomain.trim()) {
    list.push(body.customDomain);
  }
  return list;
}

export function collectDomainsFromBody(body: {
  customDomains?: unknown;
  customDomain?: unknown;
}): string[] {
  return normalizeDomainList(collectRawDomainsFromBody(body));
}
