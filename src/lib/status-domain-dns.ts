import { resolve4, resolveCname } from "node:dns/promises";

import { getStatusCnameTarget } from "@/lib/status-domain-hosts";

export type DomainDnsStatus = {
  verified: boolean;
  message: string;
  cnameTarget: string;
  observedRecords: string[];
};

/** Check whether DNS points the custom domain at this Ghostwatch instance. */
export async function verifyCustomDomainDns(
  domain: string,
): Promise<DomainDnsStatus> {
  const cnameTarget = getStatusCnameTarget();
  const observedRecords: string[] = [];

  try {
    const targetIps = await resolve4(cnameTarget);
    for (const ip of targetIps) observedRecords.push(`${cnameTarget} A ${ip}`);
  } catch {
    // Target may not resolve in dev; HTTP check can still work locally.
  }

  try {
    const chain = await resolveCname(domain);
    for (const hop of chain) {
      const hopNorm = hop.toLowerCase().replace(/\.$/, "");
      observedRecords.push(`CNAME → ${hopNorm}`);
      if (hopNorm === cnameTarget || hopNorm.endsWith(`.${cnameTarget}`)) {
        return {
          verified: true,
          message: `CNAME points to ${hopNorm}.`,
          cnameTarget,
          observedRecords,
        };
      }
    }
  } catch {
    // No CNAME — try A record comparison below.
  }

  try {
    const domainIps = await resolve4(domain);
    const targetIps = await resolve4(cnameTarget).catch(() => [] as string[]);
    for (const ip of domainIps) observedRecords.push(`${domain} A ${ip}`);
    if (domainIps.some((ip) => targetIps.includes(ip))) {
      return {
        verified: true,
        message: "A record points to the same server as this Ghostwatch instance.",
        cnameTarget,
        observedRecords,
      };
    }
  } catch {
    // fall through
  }

  return {
    verified: false,
    message: `Create a CNAME record: ${domain} → ${cnameTarget}. Then ensure your reverse proxy accepts HTTPS for ${domain}.`,
    cnameTarget,
    observedRecords,
  };
}
