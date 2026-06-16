/**
 * Shared uptime/outage classification.
 *
 * A single transient failure should never paint a monitor as "down". An
 * outage is only declared once a check has failed for a sustained number of
 * consecutive probes. The same threshold drives the status-page bar colors and
 * consecutive probes. Degraded periods (< threshold) also appear in Past
 * Incidents, derived from the same probe history as the bars.
 *
 * Configure with STATUS_OUTAGE_THRESHOLD (number of consecutive failed probes,
 * default 3).
 */

export type DayStatus =
  | "operational"
  | "degraded"
  | "outage"
  | "maintenance"
  | "nodata";

export type CheckLiveStatus = "operational" | "degraded" | "outage" | "unknown";

const DEFAULT_OUTAGE_THRESHOLD = 3;

export function getOutageThreshold(): number {
  const raw = Number(process.env.STATUS_OUTAGE_THRESHOLD);
  if (Number.isFinite(raw) && raw >= 1) return Math.floor(raw);
  return DEFAULT_OUTAGE_THRESHOLD;
}

export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type SimpleResult = { success: boolean; createdAt: Date; region?: string };

export type StatusEvent = {
  id: string;
  severity: "degraded" | "outage";
  status: "ONGOING" | "RESOLVED";
  startedAt: Date;
  resolvedAt: Date | null;
  failureCount: number;
  /** Probe region id when monitors run from multiple locations. */
  region?: string | null;
  /** >1 when nearby brief incidents were collapsed into one row. */
  groupedCount?: number;
};

/**
 * Returns the set of local-date strings that are part of a sustained outage
 * (a run of >= `threshold` consecutive failed probes). Runs may span midnight,
 * in which case every day they touch is flagged.
 *
 * `results` must be ordered ascending by time and already filtered to exclude
 * maintenance windows.
 */
export function computeOutageDays(
  results: SimpleResult[],
  threshold = getOutageThreshold(),
): Set<string> {
  const outageDays = new Set<string>();
  let runStart = -1;
  let runLen = 0;

  const flushRun = (endIdxExclusive: number) => {
    if (runLen >= threshold) {
      for (let k = runStart; k < endIdxExclusive; k++) {
        outageDays.add(toLocalDateStr(results[k].createdAt));
      }
    }
    runLen = 0;
    runStart = -1;
  };

  for (let i = 0; i < results.length; i++) {
    if (!results[i].success) {
      if (runLen === 0) runStart = i;
      runLen++;
    } else {
      flushRun(i);
    }
  }
  flushRun(results.length);

  return outageDays;
}

/** Union outage days across regions (each region evaluated independently). */
export function computeOutageDaysForRegions(
  results: SimpleResult[],
  regions: string[],
  threshold = getOutageThreshold(),
): Set<string> {
  if (regions.length <= 1) {
    return computeOutageDays(results, threshold);
  }

  const days = new Set<string>();
  for (const region of regions) {
    const regional = results.filter((r) => r.region === region);
    for (const day of computeOutageDays(regional, threshold)) {
      days.add(day);
    }
  }
  return days;
}

/**
 * Derive display incidents from probe results. Every failure run becomes an
 * event: short runs (< threshold) are "degraded", sustained runs are "outage".
 * This keeps the Past Incidents list consistent with the uptime bars.
 */
export function computeStatusEvents(
  results: SimpleResult[],
  threshold = getOutageThreshold(),
): StatusEvent[] {
  if (results.length === 0) return [];

  const events: StatusEvent[] = [];
  let runStart = -1;
  let runLen = 0;

  const flush = (resolvedAt: Date | null) => {
    if (runLen === 0 || runStart < 0) return;
    const severity = runLen >= threshold ? "outage" : "degraded";
    events.push({
      id: `evt-${results[runStart].createdAt.getTime()}-${severity}`,
      severity,
      status: resolvedAt ? "RESOLVED" : "ONGOING",
      startedAt: results[runStart].createdAt,
      resolvedAt,
      failureCount: runLen,
    });
    runLen = 0;
    runStart = -1;
  };

  for (let i = 0; i < results.length; i++) {
    if (!results[i].success) {
      if (runLen === 0) runStart = i;
      runLen++;
    } else if (runLen > 0) {
      flush(results[i].createdAt);
    }
  }
  flush(null);

  return events;
}

/**
 * Build status events per probe region so multi-region monitors show where
 * issues occurred. Falls back to a single stream when results lack region tags.
 */
export function computeStatusEventsForRegions(
  results: SimpleResult[],
  regions: string[],
  threshold = getOutageThreshold(),
): StatusEvent[] {
  const tagged = results.some((r) => r.region);
  if (!tagged || regions.length <= 1) {
    return computeStatusEvents(results, threshold).map((e) => ({
      ...e,
      region: regions.length === 1 ? (regions[0] ?? null) : null,
    }));
  }

  const events: StatusEvent[] = [];
  for (const region of regions) {
    const regional = results.filter((r) => r.region === region);
    if (regional.length === 0) continue;
    events.push(
      ...computeStatusEvents(regional, threshold).map((e) => ({ ...e, region })),
    );
  }
  return events;
}

const GROUP_GAP_MS = 30 * 60 * 1000;

/** Only sustained outages belong on the public Past Incidents list. */
export function filterPublicStatusEvents(events: StatusEvent[]): StatusEvent[] {
  return events.filter((e) => e.severity === "outage");
}

/**
 * Collapse nearby resolved incidents (same region, same calendar day) so
 * flapping does not flood the Past Incidents list.
 */
export function groupStatusEvents(events: StatusEvent[]): StatusEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  const out: StatusEvent[] = [];

  for (const evt of sorted) {
    const prev = out[out.length - 1];
    const canMerge =
      prev &&
      prev.severity === evt.severity &&
      prev.status === "RESOLVED" &&
      evt.status === "RESOLVED" &&
      prev.region === evt.region &&
      prev.resolvedAt &&
      evt.resolvedAt &&
      evt.startedAt.getTime() - prev.resolvedAt.getTime() <= GROUP_GAP_MS &&
      toLocalDateStr(prev.startedAt) === toLocalDateStr(evt.startedAt);

    if (canMerge && prev.resolvedAt && evt.resolvedAt) {
      prev.groupedCount = (prev.groupedCount ?? 1) + 1;
      prev.resolvedAt =
        prev.resolvedAt.getTime() > evt.resolvedAt.getTime()
          ? prev.resolvedAt
          : evt.resolvedAt;
      prev.startedAt =
        prev.startedAt.getTime() < evt.startedAt.getTime()
          ? prev.startedAt
          : evt.startedAt;
      prev.failureCount += evt.failureCount;
      prev.id = `grp-${prev.startedAt.getTime()}-${evt.startedAt.getTime()}`;
    } else {
      out.push({ ...evt, groupedCount: evt.groupedCount ?? 1 });
    }
  }

  return out.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

export type StatusEventCopy = {
  headline: string;
  detail: string;
};

/**
 * Turn technical monitor names (e.g. "GET /api/v1/Books") into readable labels
 * for public status pages.
 */
export function displayMonitorName(name: string): string {
  const trimmed = name.trim();
  const methodPath = trimmed.match(
    /^(?:GET|POST|PUT|DELETE|PATCH|HEAD)\s+(\S+)/i,
  );
  if (methodPath) {
    const segments = methodPath[1].split("/").filter(Boolean);
    const resource = segments[segments.length - 1];
    if (resource && !resource.includes("{")) {
      return resource.charAt(0).toUpperCase() + resource.slice(1);
    }
    return methodPath[1].replace(/^\//, "") || trimmed;
  }
  return trimmed;
}

/** User-facing copy for a status-page incident row. */
export function statusEventCopy(
  checkName: string,
  event: StatusEvent,
  regionLabel?: string | null,
): StatusEventCopy {
  const service = displayMonitorName(checkName);
  const where = regionLabel ? ` in ${regionLabel}` : "";

  if (event.groupedCount && event.groupedCount > 1) {
    return {
      headline: `${service} had repeated outages${where}`,
      detail:
        "Multiple disruptions occurred on this day. Service has been restored.",
    };
  }

  if (event.severity === "outage") {
    if (event.status === "ONGOING") {
      return {
        headline: `${service} is currently unavailable${where}`,
        detail:
          "We detected a sustained disruption and are working to restore service.",
      };
    }
    return {
      headline: `${service} was temporarily unavailable${where}`,
      detail:
        "This incident has been resolved. Service is operating normally.",
    };
  }

  if (event.status === "ONGOING") {
    return {
      headline: `${service} is experiencing intermittent issues${where}`,
      detail: "Some requests may fail or respond slower than usual.",
    };
  }

  return {
    headline: `${service} had a brief interruption${where}`,
    detail: "The issue was short-lived. Service is back to normal.",
  };
}

/** @deprecated Use statusEventCopy — kept for callers that only need a title string. */
export function statusEventTitle(checkName: string, event: StatusEvent): string {
  return statusEventCopy(checkName, event).headline;
}

/**
 * Classify the current live status of a check from its results
 * (ordered ascending). A check is only "outage" once the trailing run of
 * failures reaches the threshold; one or two recent failures are "degraded".
 */
export function computeLiveStatus(
  results: SimpleResult[],
  threshold = getOutageThreshold(),
): CheckLiveStatus {
  if (results.length === 0) return "unknown";
  const latest = results[results.length - 1];
  if (latest.success) return "operational";

  let trailingFailures = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].success) break;
    trailingFailures++;
  }
  return trailingFailures >= threshold ? "outage" : "degraded";
}

/** Worst status across all configured regions for a multi-region monitor. */
export function computeLiveStatusForRegions(
  results: SimpleResult[],
  regions: string[],
  threshold = getOutageThreshold(),
): CheckLiveStatus {
  if (regions.length <= 1) {
    return computeLiveStatus(results, threshold);
  }

  const rank: Record<CheckLiveStatus, number> = {
    unknown: 0,
    operational: 1,
    degraded: 2,
    outage: 3,
  };

  let worst: CheckLiveStatus = "unknown";
  for (const region of regions) {
    const regional = results.filter((r) => r.region === region);
    const status = computeLiveStatus(regional, threshold);
    if (rank[status] > rank[worst]) worst = status;
  }
  return worst === "unknown" ? computeLiveStatus(results, threshold) : worst;
}
