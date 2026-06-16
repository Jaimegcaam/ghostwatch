/** Matches the response-time chart window in check detail. */
export const LATENCY_WINDOW_MS = 60 * 60 * 1000;

export type LatencyProbe = {
  success: boolean;
  responseTime: number | null;
  createdAt: Date | string;
  region?: string | null;
};

export const latencyResultSelect = {
  success: true,
  responseTime: true,
  createdAt: true,
  region: true,
} as const;

export function latencyWindowStart(now = Date.now()): Date {
  return new Date(now - LATENCY_WINDOW_MS);
}

/** Prisma fragment: all probes in the chart/latency window (no arbitrary take cap). */
export function latencyResultsInclude(now = Date.now()) {
  return {
    where: { createdAt: { gte: latencyWindowStart(now) } },
    orderBy: { createdAt: "desc" as const },
    select: latencyResultSelect,
  };
}

function probeTime(r: LatencyProbe): number {
  return new Date(r.createdAt).getTime();
}

/**
 * Canonical latency for UI: average of successful probes in the last hour
 * (all regions). Aligns with the response-time chart. Falls back to the mean
 * of the latest successful probe per region, then the latest successful probe.
 */
export function computeDisplayLatency(
  results: LatencyProbe[],
  regions: string[] = [],
  now = Date.now(),
): number | null {
  if (results.length === 0) return null;

  const sorted = [...results].sort((a, b) => probeTime(b) - probeTime(a));
  const cutoff = now - LATENCY_WINDOW_MS;

  const inWindow = sorted.filter(
    (r) => r.success && r.responseTime != null && probeTime(r) >= cutoff,
  );

  if (inWindow.length > 0) {
    return Math.round(
      inWindow.reduce((sum, r) => sum + (r.responseTime ?? 0), 0) /
        inWindow.length,
    );
  }

  const effectiveRegions =
    regions.length > 0
      ? regions
      : ([...new Set(sorted.map((r) => r.region).filter(Boolean))] as string[]);

  if (effectiveRegions.length > 0) {
    const perRegion: number[] = [];
    for (const region of effectiveRegions) {
      const latest = sorted.find(
        (r) => r.region === region && r.success && r.responseTime != null,
      );
      if (latest?.responseTime != null) perRegion.push(latest.responseTime);
    }
    if (perRegion.length > 0) {
      return Math.round(perRegion.reduce((a, b) => a + b, 0) / perRegion.length);
    }
  }

  const latest = sorted.find((r) => r.success && r.responseTime != null);
  return latest?.responseTime != null ? Math.round(latest.responseTime) : null;
}

export function computeProjectAvgLatency(
  latencies: Array<number | null | undefined>,
): number | null {
  const values = latencies.filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
