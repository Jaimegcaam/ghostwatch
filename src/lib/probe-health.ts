import {
  getProbeEndpoints,
  hasRemoteProbeEndpoints,
} from "@/lib/probe-endpoints";
import {
  getConfiguredRegions,
  getDefaultRegion,
  getRegionLabelMap,
  labelForRegion,
  type Region,
} from "@/lib/regions";
import { shouldUseInProcessChecks } from "@/lib/self-hosted";

export type ProbeHealthStatus = "healthy" | "unhealthy";

export type ProbeStatus = {
  id: string;
  label: string;
  status: ProbeHealthStatus;
  /** remote worker, in-process on hub, or Vercel edge */
  kind: "remote" | "local" | "edge" | "misconfigured";
  lastChecked: string;
  responseTimeMs: number | null;
  error: string | null;
};

const CACHE_TTL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 8_000;

let cache: { at: number; probes: ProbeStatus[] } | null = null;

export class RegionSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegionSelectionError";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

async function pingProbeBase(baseUrl: string): Promise<{
  healthy: boolean;
  responseTimeMs: number;
  error: string | null;
}> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/health`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    const responseTimeMs = Date.now() - start;
    if (!res.ok) {
      return {
        healthy: false,
        responseTimeMs,
        error: `Health check returned HTTP ${res.status}`,
      };
    }
    return { healthy: true, responseTimeMs, error: null };
  } catch (err) {
    return {
      healthy: false,
      responseTimeMs: Date.now() - start,
      error:
        err instanceof Error ? err.message : "Probe worker unreachable",
    };
  }
}

/** Regions that have a probe worker configured (not just a UI label). */
export function getInstalledProbeRegions(): Region[] {
  const labelMap = getRegionLabelMap();

  if (hasRemoteProbeEndpoints()) {
    return getProbeEndpoints().map((e) => ({
      id: e.regionId,
      label: labelMap[e.regionId] ?? e.label?.trim() ?? e.regionId,
    }));
  }

  if (shouldUseInProcessChecks()) {
    return getConfiguredRegions();
  }

  return getConfiguredRegions();
}

/** Configured in MONITORING_REGIONS but missing from PROBE_ENDPOINTS. */
function getMisconfiguredRegions(): Region[] {
  if (!hasRemoteProbeEndpoints()) return [];

  const deployed = new Set(getProbeEndpoints().map((e) => e.regionId));
  return getConfiguredRegions().filter((r) => !deployed.has(r.id));
}

export async function getProbeStatuses(options?: {
  force?: boolean;
}): Promise<ProbeStatus[]> {
  if (
    !options?.force &&
    cache &&
    Date.now() - cache.at < CACHE_TTL_MS
  ) {
    return cache.probes;
  }

  const labelMap = getRegionLabelMap();
  const probes: ProbeStatus[] = [];
  const checkedAt = nowIso();

  if (hasRemoteProbeEndpoints()) {
    const results = await Promise.all(
      getProbeEndpoints().map(async (endpoint) => {
        const ping = await pingProbeBase(endpoint.baseUrl);
        return {
          id: endpoint.regionId,
          label:
            labelMap[endpoint.regionId] ??
            endpoint.label?.trim() ??
            endpoint.regionId,
          status: (ping.healthy ? "healthy" : "unhealthy") as ProbeHealthStatus,
          kind: "remote" as const,
          lastChecked: checkedAt,
          responseTimeMs: ping.responseTimeMs,
          error: ping.error,
        };
      }),
    );
    probes.push(...results);

    for (const region of getMisconfiguredRegions()) {
      probes.push({
        id: region.id,
        label: region.label,
        status: "unhealthy",
        kind: "misconfigured",
        lastChecked: checkedAt,
        responseTimeMs: null,
        error: "No worker deployed — region is not in PROBE_ENDPOINTS",
      });
    }
  } else if (shouldUseInProcessChecks()) {
    for (const region of getInstalledProbeRegions()) {
      probes.push({
        id: region.id,
        label: region.label,
        status: "healthy",
        kind: "local",
        lastChecked: checkedAt,
        responseTimeMs: 0,
        error: null,
      });
    }
  } else {
    for (const region of getConfiguredRegions()) {
      probes.push({
        id: region.id,
        label: region.label,
        status: "healthy",
        kind: "edge",
        lastChecked: checkedAt,
        responseTimeMs: null,
        error: null,
      });
    }
  }

  cache = { at: Date.now(), probes };
  return probes;
}

export function getHealthyProbeRegions(probes: ProbeStatus[]): Region[] {
  return probes
    .filter((p) => p.status === "healthy")
    .map((p) => ({ id: p.id, label: p.label }));
}

export function invalidateProbeStatusCache(): void {
  cache = null;
}

/** Pick monitor regions — only healthy, deployed probes. */
export async function resolveMonitorRegions(
  regions: unknown,
): Promise<string[]> {
  const probes = await getProbeStatuses();
  const healthy = new Set(
    probes.filter((p) => p.status === "healthy").map((p) => p.id),
  );

  if (Array.isArray(regions)) {
    const requested = [
      ...new Set(
        regions.filter((r): r is string => typeof r === "string" && r.length > 0),
      ),
    ];
    const valid = requested.filter((id) => healthy.has(id));
    const rejected = requested.filter((id) => !healthy.has(id));

    if (valid.length > 0) return valid;

    if (rejected.length > 0) {
      const details = rejected
        .map((id) => {
          const probe = probes.find((p) => p.id === id);
          const reason = probe?.error ?? "probe unavailable";
          return `${labelForRegion(id)} (${reason})`;
        })
        .join("; ");
      throw new RegionSelectionError(
        `Cannot assign monitors to unavailable region(s): ${details}`,
      );
    }
  }

  const healthyList = [...healthy];
  if (healthyList.length > 0) {
    const preferred = getDefaultRegion();
    if (healthy.has(preferred)) return [preferred];
    return [healthyList[0]];
  }

  throw new RegionSelectionError(
    "No healthy probe regions are available. Check probe workers and PROBE_ENDPOINTS.",
  );
}
