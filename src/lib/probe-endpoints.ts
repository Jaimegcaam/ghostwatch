/**
 * Remote probe workers for self-hosted multi-region deployments.
 *
 * The central hub (dashboard + scheduler + database) calls lightweight probe
 * workers over HTTPS. Each worker runs the same Ghostwatch image with
 * PROBE_WORKER=true and exposes POST /api/probe/<region>.
 *
 * Configure on the hub (comma-separated):
 *   regionId|baseUrl
 *   regionId|baseUrl|Label shown in the dashboard
 *
 * Examples:
 *   PROBE_ENDPOINTS=us-east-1|https://probe-va.corp.com|North Virginia,eu-south-2|https://probe-madrid.corp.com|Spain
 *
 * Base URLs must not include a trailing slash. The hub POSTs to
 *   <base>/api/probe/<region-id>
 * with header x-probe-secret: CRON_SECRET (shared with workers).
 */

export type ProbeEndpoint = { regionId: string; baseUrl: string; label?: string };

let cached: ProbeEndpoint[] | null = null;

function parseProbeEndpoints(): ProbeEndpoint[] {
  // Edge / Vercel mode — ignore remote workers even if PROBE_ENDPOINTS is set
  // (e.g. leftover from Docker or a shared team env var).
  if (process.env.USE_EDGE_PROBES === "true") return [];

  const raw = process.env.PROBE_ENDPOINTS?.trim();
  if (!raw) return [];

  const endpoints: ProbeEndpoint[] = [];
  const seen = new Set<string>();

  for (const part of raw.split(",")) {
    const segments = part.split("|").map((s) => s.trim());
    if (segments.length < 2) continue;

    const regionId = segments[0];
    const baseUrl =
      segments.length >= 3
        ? segments.slice(1, -1).join("|").replace(/\/$/, "")
        : segments[1].replace(/\/$/, "");
    const label =
      segments.length >= 3 ? segments[segments.length - 1] : undefined;

    if (!regionId || !baseUrl || seen.has(regionId)) continue;

    seen.add(regionId);
    endpoints.push({ regionId, baseUrl, label: label || undefined });
  }

  return endpoints;
}

export function getProbeEndpoints(): ProbeEndpoint[] {
  if (cached === null) cached = parseProbeEndpoints();
  return cached;
}

/** Full URL the hub POSTs to for a given region, or null if not configured. */
export function getProbeEndpointUrl(regionId: string): string | null {
  const entry = getProbeEndpoints().find((e) => e.regionId === regionId);
  if (!entry) return null;

  const suffix = `/api/probe/${regionId}`;
  if (entry.baseUrl.endsWith(suffix)) return entry.baseUrl;
  return `${entry.baseUrl}${suffix}`;
}

export function hasRemoteProbeEndpoints(): boolean {
  return getProbeEndpoints().length > 0;
}

/** Region ids declared in PROBE_ENDPOINTS. */
export function getProbeEndpointRegionIds(): string[] {
  return getProbeEndpoints().map((e) => e.regionId);
}

/** Reset cached parse (tests). */
export function resetProbeEndpointsCache(): void {
  cached = null;
}
