import type { Check } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { detectAnomaly } from "@/lib/baseline";
import { sendAlertToChannel, sendRecoveryToChannel } from "@/lib/alerting";
import { performHttpCheck } from "@/lib/http-check";
import { shouldUseInProcessChecks } from "@/lib/self-hosted";
import { getProbeEndpointUrl } from "@/lib/probe-endpoints";
import {
  getInstalledProbeRegions,
} from "@/lib/probe-health";
import { getDefaultRegion } from "@/lib/regions";
import { getOutageThreshold } from "@/lib/uptime-status";
import { checkSlotEnd } from "@/lib/check-schedule";

interface CheckExecutionResult {
  status: number | null;
  responseTime: number;
  success: boolean;
  error: string | null;
}

const APP_URL = () => process.env.NEXTAUTH_URL || "http://localhost:3000";

function normalizeRegion(region: string): string {
  const allowed = new Set(getInstalledProbeRegions().map((r) => r.id));
  if (allowed.has(region)) return region;
  return shouldUseInProcessChecks()
    ? process.env.PROBE_REGION?.trim() || "local"
    : getDefaultRegion();
}

/** POST check payload to a probe URL (remote worker or Vercel edge route). */
async function executeCheckViaProbeUrl(
  check: Pick<
    Check,
    "url" | "method" | "headers" | "body" | "timeout" | "expectedStatus"
  >,
  probeUrl: string,
  region: string,
): Promise<CheckExecutionResult & { region: string }> {
  const probeRegion = normalizeRegion(region);

  try {
    const res = await fetch(probeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-probe-secret": process.env.CRON_SECRET || "",
      },
      body: JSON.stringify({
        url: check.url,
        method: check.method,
        headers: check.headers ?? {},
        body: check.body,
        timeout: check.timeout,
        expectedStatus: check.expectedStatus,
      }),
    });

    let data: CheckExecutionResult & { region?: string };
    try {
      data = await res.json();
    } catch {
      return {
        status: null,
        responseTime: 0,
        success: false,
        error: `Probe returned ${res.status} (invalid response)`,
        region: probeRegion,
      };
    }

    if (!res.ok && !data.error) {
      return {
        status: data.status ?? null,
        responseTime: data.responseTime ?? 0,
        success: false,
        error: data.error ?? `Probe HTTP ${res.status}`,
        region: data.region ?? probeRegion,
      };
    }

    return {
      status: data.status ?? null,
      responseTime: data.responseTime ?? 0,
      success: data.success ?? false,
      error: data.error ?? null,
      region: data.region ?? probeRegion,
    };
  } catch (err) {
    return {
      status: null,
      responseTime: 0,
      success: false,
      error:
        err instanceof Error ? `Probe error: ${err.message}` : "Probe unreachable",
      region: probeRegion,
    };
  }
}

/** Remote self-hosted worker configured via PROBE_ENDPOINTS. */
async function executeCheckViaRemoteProbe(
  check: Pick<
    Check,
    "url" | "method" | "headers" | "body" | "timeout" | "expectedStatus"
  >,
  region: string,
  probeUrl: string,
): Promise<CheckExecutionResult & { region: string }> {
  return executeCheckViaProbeUrl(check, probeUrl, region);
}

/** Vercel Edge: delegate the HTTP call to a regional /api/probe route. */
async function executeCheckViaEdgeProbe(
  check: Pick<
    Check,
    "url" | "method" | "headers" | "body" | "timeout" | "expectedStatus"
  >,
  region: string,
): Promise<CheckExecutionResult & { region: string }> {
  const probeRegion = normalizeRegion(region);
  const probeUrl = `${APP_URL()}/api/probe/${probeRegion}`;
  return executeCheckViaProbeUrl(check, probeUrl, region);
}

/** Self-hosted / local: run the HTTP check directly in this process. */
async function executeCheckInProcess(
  check: Pick<
    Check,
    "url" | "method" | "headers" | "body" | "timeout" | "expectedStatus"
  >,
  region: string,
): Promise<CheckExecutionResult & { region: string }> {
  const probeRegion = normalizeRegion(region);
  const result = await performHttpCheck({
    url: check.url,
    method: check.method,
    headers: check.headers as Record<string, string> | null,
    body: check.body,
    timeout: check.timeout,
    expectedStatus: check.expectedStatus,
  });
  return { ...result, region: probeRegion };
}

async function executeCheckForRegion(
  check: Pick<
    Check,
    "url" | "method" | "headers" | "body" | "timeout" | "expectedStatus"
  >,
  region: string,
): Promise<CheckExecutionResult & { region: string }> {
  const probeRegion = normalizeRegion(region);
  const remoteProbeUrl = getProbeEndpointUrl(probeRegion);
  if (remoteProbeUrl) {
    return executeCheckViaRemoteProbe(check, region, remoteProbeUrl);
  }
  if (shouldUseInProcessChecks()) {
    return executeCheckInProcess(check, region);
  }
  return executeCheckViaEdgeProbe(check, region);
}

/** @deprecated Use executeCheckForRegion — kept for manual test routes. */
export async function executeCheck(
  check: Pick<
    Check,
    "url" | "method" | "headers" | "body" | "timeout" | "expectedStatus"
  >,
): Promise<CheckExecutionResult> {
  const { region: _r, ...result } = await executeCheckInProcess(
    check,
    process.env.PROBE_REGION || "local",
  );
  return result;
}

export async function isCheckUnderMaintenance(checkId: string): Promise<boolean> {
  const now = new Date();
  const activeMaintenance = await db.maintenanceCheck.findFirst({
    where: {
      checkId,
      maintenance: {
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledStart: { lte: now },
        scheduledEnd: { gte: now },
      },
    },
  });
  return !!activeMaintenance;
}

export type RunCheckOptions = {
  /** When false, cron already claimed lastCheckedAt for this slot. Default true. */
  touchLastChecked?: boolean;
  /** Minute slot for deduplicating scheduled runs. */
  slot?: Date;
};

export async function runCheck(
  checkId: string,
  region?: string,
  options: RunCheckOptions = {},
) {
  region = region ?? getDefaultRegion();
  const check = await db.check.findUniqueOrThrow({
    where: { id: checkId },
    include: { project: true },
  });

  if (await isCheckUnderMaintenance(check.id)) {
    return null;
  }

  const probeRegion = normalizeRegion(region);

  if (options.slot) {
    const slotEnd = checkSlotEnd(options.slot, check.interval);
    const existing = await db.checkResult.findFirst({
      where: {
        checkId: check.id,
        region: probeRegion,
        createdAt: { gte: options.slot, lt: slotEnd },
      },
    });
    if (existing) {
      return existing;
    }
  }

  const result = await executeCheckForRegion(check, region);
  const anomaly = detectAnomaly(check, result.responseTime);

  const checkResult = await db.checkResult.create({
    data: {
      checkId: check.id,
      status: result.status,
      responseTime: result.responseTime,
      success: result.success,
      error: result.error,
      region: result.region,
      isAnomaly: anomaly.isAnomaly,
    },
  });

  if (result.success) {
    await handleSuccess(check);
  } else {
    await handleFailure(check, result);
  }

  if (options.touchLastChecked !== false) {
    await db.check.update({
      where: { id: check.id },
      data: { lastCheckedAt: options.slot ?? new Date() },
    });
  }

  await updateBaseline(check.id);

  return checkResult;
}

// Minimum minutes between alerts for the same check (escalating with flap count)
const BASE_COOLDOWN_MINUTES = 10;
const MAX_COOLDOWN_MINUTES = 120;
const FLAP_WINDOW_MINUTES = 60;
const FLAP_THRESHOLD = 3; // transitions in the window to be considered unstable

function isInCooldown(check: Check): boolean {
  if (!check.alertCooldownUntil) return false;
  return new Date() < check.alertCooldownUntil;
}

function getCooldownMinutes(flapCount: number): number {
  // Exponential backoff: 10, 20, 40, 80, 120 (capped)
  const minutes = BASE_COOLDOWN_MINUTES * Math.pow(2, Math.min(flapCount, 5));
  return Math.min(minutes, MAX_COOLDOWN_MINUTES);
}

/** True if we already sent an alert for the current ongoing incident. */
function hasNotifiedForCurrentIncident(
  check: Pick<Check, "lastAlertedAt">,
  incident: { startedAt: Date } | null,
): boolean {
  if (!incident || !check.lastAlertedAt) return false;
  return check.lastAlertedAt >= incident.startedAt;
}

async function handleSuccess(check: Check) {
  const wasFailingBefore = check.consecutiveFailures > 0;

  // Track flapping: if it was failing and now recovers, that's a state transition
  const newFlapCount = wasFailingBefore ? check.flapCount + 1 : check.flapCount;

  await db.check.update({
    where: { id: check.id },
    data: { consecutiveFailures: 0, flapCount: newFlapCount },
  });

  if (!wasFailingBefore) return;

  // Resolve any ongoing incidents
  const ongoingIncidents = await db.incident.findMany({
    where: { checkId: check.id, status: "ONGOING" },
  });

  for (const incident of ongoingIncidents) {
    await db.incident.update({
      where: { id: incident.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }

  // Don't send recovery if in cooldown (unstable/flapping)
  if (isInCooldown(check)) {
    console.log(`[ALERT] Skipping recovery for "${check.name}" — in cooldown (flapping)`);
    return;
  }

  // Check if this is a flapping check: many transitions recently
  if (newFlapCount >= FLAP_THRESHOLD) {
    const cooldownMinutes = getCooldownMinutes(newFlapCount);
    const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);
    await db.check.update({
      where: { id: check.id },
      data: { alertCooldownUntil: cooldownUntil },
    });
    console.log(
      `[ALERT] Check "${check.name}" is unstable (${newFlapCount} transitions). Cooldown ${cooldownMinutes}m until ${cooldownUntil.toISOString()}`,
    );
    // Still send one "unstable" recovery notification
    const rules = await db.alertRule.findMany({
      where: { checkId: check.id, enabled: true, notifyOnRecovery: true },
      include: { alertChannel: true },
    });
    const message = `Check "${check.name}" recovered but is unstable (${newFlapCount} state changes recently). Alerts paused for ${cooldownMinutes} minutes.`;
    await Promise.allSettled(
      rules.map((rule) =>
        sendRecoveryToChannel(rule.alertChannelId, message, {
          checkId: check.id,
          checkName: check.name,
          url: check.url,
          recovered: true,
        }),
      ),
    );
    return;
  }

  // Normal recovery notification
  const rules = await db.alertRule.findMany({
    where: { checkId: check.id, enabled: true, notifyOnRecovery: true },
    include: { alertChannel: true },
  });

  const message = `Check "${check.name}" has recovered and is now operational.`;
  const metadata = {
    checkId: check.id,
    checkName: check.name,
    url: check.url,
  };

  await Promise.allSettled(
    rules.map((rule) =>
      sendRecoveryToChannel(rule.alertChannelId, message, metadata),
    ),
  );

  // Reset flap count after a clean recovery
  await db.check.update({
    where: { id: check.id },
    data: { lastAlertedAt: new Date(), flapCount: 0, alertCooldownUntil: null },
  });
}

async function handleFailure(
  check: Check,
  result: {
    status: number | null;
    responseTime: number;
    error: string | null;
    region: string;
  },
) {
  const newCount = check.consecutiveFailures + 1;

  await db.check.update({
    where: { id: check.id },
    data: { consecutiveFailures: newCount },
  });

  // An outage (and therefore an incident on the status page) is only declared
  // once failures are sustained. A single transient failure is not an incident.
  const outageThreshold = getOutageThreshold();

  // Check if there's already an ongoing incident; create one as soon as the
  // sustained-outage threshold is reached, regardless of alert-rule config, so
  // the status page "Past Incidents" stays consistent with the bars.
  let ongoingIncident = await db.incident.findFirst({
    where: { checkId: check.id, status: "ONGOING" },
  });

  if (!ongoingIncident && newCount >= outageThreshold) {
    ongoingIncident = await db.incident.create({
      data: {
        checkId: check.id,
        title: `${check.name} is down`,
        status: "ONGOING",
      },
    });
  }

  // If in cooldown, skip alerting entirely (incident tracking already handled).
  if (isInCooldown(check)) {
    return;
  }

  // Load alert rules for this check
  const rules = await db.alertRule.findMany({
    where: { checkId: check.id, enabled: true },
    include: { alertChannel: true },
  });

  const alertMetadata = {
    checkId: check.id,
    checkName: check.name,
    url: check.url,
    status: result.status,
    responseTime: result.responseTime,
    error: result.error,
    region: result.region,
  };

  // For each rule, check if the threshold is met
  for (const rule of rules) {
    if (newCount >= rule.consecutiveFailures) {
      let incident = ongoingIncident;
      if (!incident) {
        incident = await db.incident.create({
          data: {
            checkId: check.id,
            title: `${check.name} is down`,
            status: "ONGOING",
          },
        });
      }

      if (!hasNotifiedForCurrentIncident(check, incident)) {
        const message = `Check "${check.name}" has failed ${newCount} consecutive times in ${result.region}: ${result.error}`;
        await sendAlertToChannel(rule.alertChannelId, message, alertMetadata);

        await db.check.update({
          where: { id: check.id },
          data: { lastAlertedAt: new Date() },
        });
      }

      break;
    }
  }

  // Fallback: no rules configured, alert all project channels after 5 consecutive failures
  if (rules.length === 0 && newCount >= 5) {
    const { sendAlerts } = await import("@/lib/alerting");
    let incident =
      ongoingIncident ??
      (await db.incident.findFirst({
        where: { checkId: check.id, status: "ONGOING" },
      }));

    if (!incident) {
      incident = await db.incident.create({
        data: {
          checkId: check.id,
          title: `${check.name} is down`,
          status: "ONGOING",
        },
      });
    }

    if (!hasNotifiedForCurrentIncident(check, incident)) {
      const message = `Check "${check.name}" has failed ${newCount} consecutive times: ${result.error}`;
      await sendAlerts(check.projectId, message, alertMetadata);

      await db.check.update({
        where: { id: check.id },
        data: { lastAlertedAt: new Date() },
      });
    }
  }
}

export async function updateBaseline(checkId: string) {
  const recentResults = await db.checkResult.findMany({
    where: { checkId, success: true, responseTime: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { responseTime: true },
  });

  if (recentResults.length < 5) return;

  const times = recentResults.map(
    (r: { responseTime: number | null }) => r.responseTime!,
  );
  const avg = times.reduce((sum: number, t: number) => sum + t, 0) / times.length;
  const variance =
    times.reduce((sum: number, t: number) => sum + (t - avg) ** 2, 0) / times.length;
  const std = Math.sqrt(variance);

  await db.check.update({
    where: { id: checkId },
    data: { baselineAvg: avg, baselineStd: std },
  });
}
