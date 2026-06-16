import { db } from "@/lib/db";
import {
  DOMAIN_RE,
  normalizeDomainListStrict,
} from "@/lib/status-domain-utils";
import {
  getAppPublicOrigin,
  getMainAppHosts,
  getStatusCnameTarget,
} from "@/lib/status-domain-hosts";

export {
  collectDomainsFromBody,
  collectRawDomainsFromBody,
  normalizeCustomDomain,
  normalizeDomainList,
  normalizeDomainListStrict,
} from "@/lib/status-domain-utils";

export {
  getAppPublicOrigin,
  getMainAppHosts,
  getStatusCnameTarget,
} from "@/lib/status-domain-hosts";

export { verifyCustomDomainDns, type DomainDnsStatus } from "@/lib/status-domain-dns";

export function validateCustomDomain(host: string): string | null {
  if (!DOMAIN_RE.test(host)) {
    return "Enter a valid domain like status.example.com (subdomain recommended).";
  }
  if (host.length > 253) {
    return "Domain is too long.";
  }
  if (getMainAppHosts().has(host)) {
    return "This hostname is reserved for the Ghostwatch dashboard. Use a different subdomain (e.g. status.yourcompany.com).";
  }
  return null;
}

async function isDomainOwnedByStatusPage(
  host: string,
  statusPageId: string,
): Promise<boolean> {
  const row = await db.statusPageCustomDomain.findFirst({
    where: {
      domain: { equals: host, mode: "insensitive" },
      statusPageId,
    },
    select: { id: true },
  });
  return Boolean(row);
}

/** Compare domain lists ignoring order and casing. */
export function domainListsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const norm = (list: string[]) =>
    [...list].map((d) => d.toLowerCase()).sort();
  const left = norm(a);
  const right = norm(b);
  return left.every((d, i) => d === right[i]);
}

export async function assertCustomDomainAvailable(
  host: string,
  excludeStatusPageId?: string,
): Promise<string | null> {
  // Re-saving an existing binding must not fail (e.g. host also appears in
  // VERCEL_PROJECT_PRODUCTION_URL when the domain is added to Vercel).
  if (excludeStatusPageId && (await isDomainOwnedByStatusPage(host, excludeStatusPageId))) {
    if (!DOMAIN_RE.test(host)) {
      return "Enter a valid domain like status.example.com (subdomain recommended).";
    }
    if (host.length > 253) {
      return "Domain is too long.";
    }
    return null;
  }

  const validation = validateCustomDomain(host);
  if (validation) return validation;

  const taken = await db.statusPageCustomDomain.findFirst({
    where: {
      domain: { equals: host, mode: "insensitive" },
      ...(excludeStatusPageId
        ? { NOT: { statusPageId: excludeStatusPageId } }
        : {}),
    },
    select: {
      statusPage: { select: { id: true, title: true } },
    },
  });

  if (taken) {
    return `This domain is already used by the status page "${taken.statusPage.title}".`;
  }

  return null;
}

export async function assertDomainsAvailable(
  domains: string[],
  excludeStatusPageId?: string,
): Promise<string | null> {
  const seen = new Set<string>();
  for (const host of domains) {
    if (seen.has(host)) {
      return `Duplicate domain "${host}" in this list.`;
    }
    seen.add(host);
    const err = await assertCustomDomainAvailable(host, excludeStatusPageId);
    if (err) return err;
  }
  return null;
}

/** Resolve a public status page by custom hostname. */
export async function resolvePublicStatusPageByHost(host: string) {
  const normalized = host.trim().toLowerCase().split(":")[0];
  const binding = await db.statusPageCustomDomain.findFirst({
    where: {
      domain: { equals: normalized, mode: "insensitive" },
      statusPage: { isPublic: true },
    },
    select: { statusPage: { select: { slug: true } } },
  });
  return binding?.statusPage ?? null;
}

/**
 * Validate raw domain inputs for a status page without writing anything.
 * Throws a user-facing Error if any input is invalid, duplicated, or already
 * taken by another page. Returns the normalized, deduped hostnames.
 */
export async function validateDomainsForSync(
  rawInputs: (string | null | undefined)[],
  statusPageId?: string,
): Promise<string[]> {
  const { domains, invalid } = normalizeDomainListStrict(rawInputs);
  if (invalid.length > 0) {
    throw new Error(
      `"${invalid[0]}" is not a valid domain. Use a hostname like status.example.com.`,
    );
  }
  const domainError = await assertDomainsAvailable(domains, statusPageId);
  if (domainError) {
    throw new Error(domainError);
  }
  return domains;
}

type DomainTxClient = {
  statusPageCustomDomain: {
    findMany: (args: {
      where: { statusPageId: string };
      select: { id: true; domain: true };
    }) => Promise<{ id: string; domain: string }[]>;
    deleteMany: (args: {
      where: { statusPageId?: string; id?: { in: string[] } };
    }) => Promise<unknown>;
    createMany: (args: {
      data: { statusPageId: string; domain: string }[];
    }) => Promise<unknown>;
  };
};

/**
 * Sync custom domains for a status page using the provided transaction client.
 * Preserves DNS verification for domains that stay in the list.
 * `domains` must already be validated (see {@link validateDomainsForSync}).
 */
export async function replaceStatusPageDomains(
  tx: DomainTxClient,
  statusPageId: string,
  domains: string[],
) {
  const existing = await tx.statusPageCustomDomain.findMany({
    where: { statusPageId },
    select: { id: true, domain: true },
  });

  const nextSet = new Set(domains.map((d) => d.toLowerCase()));
  const toRemove = existing.filter(
    (row) => !nextSet.has(row.domain.toLowerCase()),
  );

  if (toRemove.length > 0) {
    await tx.statusPageCustomDomain.deleteMany({
      where: { id: { in: toRemove.map((row) => row.id) } },
    });
  }

  const existingSet = new Set(existing.map((row) => row.domain.toLowerCase()));
  const toAdd = domains.filter((d) => !existingSet.has(d.toLowerCase()));

  if (toAdd.length > 0) {
    await tx.statusPageCustomDomain.createMany({
      data: toAdd.map((domain) => ({ statusPageId, domain })),
    });
  }
}

/** Validate and replace all custom domains for a status page. */
export async function syncStatusPageDomains(
  statusPageId: string,
  rawInputs: (string | null | undefined)[],
) {
  const domains = await validateDomainsForSync(rawInputs, statusPageId);
  await db.$transaction((tx) =>
    replaceStatusPageDomains(tx, statusPageId, domains),
  );
  return domains;
}

export function getStatusPagePublicUrls(slug: string, domains: string[]) {
  const origin = getAppPublicOrigin();
  const defaultUrl = `${origin}/s/${slug}`;
  const customUrls = domains.map((d) => `https://${d}`);
  const primaryUrl = customUrls[0] ?? defaultUrl;
  return {
    defaultUrl,
    customUrls,
    /** @deprecated use customUrls */
    customUrl: customUrls[0] ?? null,
    primaryUrl,
  };
}

const statusPageInclude = {
  checks: {
    include: {
      check: { select: { id: true, name: true, url: true, isPublic: true } },
    },
  },
  customDomains: { orderBy: { createdAt: "asc" as const } },
};

export function formatStatusPageResponse<
  T extends {
    slug: string;
    customDomains: {
      id: string;
      domain: string;
      verified?: boolean;
      verifiedAt?: Date | null;
      createdAt: Date;
    }[];
  },
>(page: T) {
  const domains = page.customDomains.map((d) => d.domain);
  const domainDetails = page.customDomains.map((d) => ({
    domain: d.domain,
    verified: d.verified ?? false,
    verifiedAt: d.verifiedAt ?? null,
  }));
  return {
    ...page,
    domains,
    domainDetails,
    customDomain: domains[0] ?? null,
    urls: getStatusPagePublicUrls(page.slug, domains),
  };
}

export { statusPageInclude };

export function getDomainSetupInfo() {
  const cnameTarget = getStatusCnameTarget();
  const mainHost = getAppPublicOrigin().replace(/^https?:\/\//, "");
  return {
    cnameTarget,
    mainHost,
    appOrigin: getAppPublicOrigin(),
    instructions: {
      cname: {
        type: "CNAME",
        name: "status",
        host: "status.yourdomain.com",
        value: cnameTarget,
      },
      note:
        "Each status page can have one or more custom domains (e.g. status.product-a.com and status.product-b.com). Every domain must point to the same Ghostwatch server via CNAME or A record.",
      reverseProxy:
        "Your reverse proxy / Ingress must accept HTTPS for every custom hostname you add (one Ingress rule per domain in Kubernetes, or multiple server_name blocks in nginx).",
    },
  };
}
