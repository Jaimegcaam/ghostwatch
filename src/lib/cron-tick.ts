/**
 * Core scheduled monitoring tick — runs maintenance transitions and due checks.
 * Used by /api/cron/execute and the optional built-in scheduler (self-hosted).
 */

import { db } from "@/lib/db";
import { runCheck } from "@/lib/checker";
import { purgeExpiredCheckResults } from "@/lib/data-retention";
import {
  currentCheckSlot,
  isCheckDue,
} from "@/lib/check-schedule";

export type CronTickSummary = {
  checksEvaluated: number;
  checksRun: number;
  regionsExecuted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  retentionDeleted: number;
};

async function claimCheckSlot(checkId: string, slot: Date): Promise<boolean> {
  const result = await db.check.updateMany({
    where: {
      id: checkId,
      enabled: true,
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: slot } }],
    },
    data: { lastCheckedAt: slot },
  });

  return result.count > 0;
}

export async function runCronTick(): Promise<CronTickSummary> {
  const now = new Date();
  const retention = await purgeExpiredCheckResults(now);

  await db.maintenance.updateMany({
    where: { status: "SCHEDULED", scheduledStart: { lte: now } },
    data: { status: "IN_PROGRESS" },
  });
  await db.maintenance.updateMany({
    where: { status: "IN_PROGRESS", scheduledEnd: { lte: now } },
    data: { status: "COMPLETED" },
  });

  await db.check.updateMany({
    where: { alertCooldownUntil: { lte: now }, flapCount: { gt: 0 } },
    data: { alertCooldownUntil: null, flapCount: 0 },
  });

  const maintenanceCheckIds = await db.maintenanceCheck.findMany({
    where: {
      maintenance: {
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledStart: { lte: now },
        scheduledEnd: { gte: now },
      },
    },
    select: { checkId: true },
  });
  const underMaintenance = new Set(maintenanceCheckIds.map((mc) => mc.checkId));

  const enabledChecks = await db.check.findMany({
    where: { enabled: true },
  });

  const dueChecks = enabledChecks.filter((check) => {
    if (underMaintenance.has(check.id)) return false;
    return isCheckDue(check.lastCheckedAt, check.interval, now);
  });

  let regionsExecuted = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let checksRun = 0;

  for (const check of dueChecks) {
    const slot = currentCheckSlot(check.interval, now);
    const claimed = await claimCheckSlot(check.id, slot);
    if (!claimed) {
      skipped++;
      continue;
    }

    checksRun++;

    const results = await Promise.allSettled(
      check.regions.map((region) =>
        runCheck(check.id, region, {
          touchLastChecked: false,
          slot,
        }),
      ),
    );

    regionsExecuted += results.length;
    succeeded += results.filter((r) => r.status === "fulfilled").length;
    failed += results.filter((r) => r.status === "rejected").length;
  }

  return {
    checksEvaluated: enabledChecks.length,
    checksRun,
    regionsExecuted,
    succeeded,
    failed,
    skipped,
    retentionDeleted: retention.deleted,
  };
}
