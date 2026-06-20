/**
 * Purges old check results to prevent unbounded database growth.
 */

import {
  getCheckResultRetentionDays,
  shouldRunRetentionJob,
} from "@/lib/data-retention-policy";

const BATCH_SIZE = 1000;

export type RetentionSummary = {
  deleted: number;
  retentionDays: number;
  skipped: boolean;
};

export async function purgeExpiredCheckResults(
  now: Date = new Date(),
): Promise<RetentionSummary> {
  const retentionDays = getCheckResultRetentionDays();
  if (retentionDays <= 0) {
    return { deleted: 0, retentionDays: 0, skipped: true };
  }

  if (!shouldRunRetentionJob(now)) {
    return { deleted: 0, retentionDays, skipped: true };
  }

  const { db } = await import("@/lib/db");
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  let deleted = 0;

  for (;;) {
    const batch = await db.checkResult.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const result = await db.checkResult.deleteMany({
      where: { id: { in: batch.map((row) => row.id) } },
    });

    deleted += result.count;
    if (batch.length < BATCH_SIZE) break;
  }

  if (deleted > 0) {
    console.info(
      `[retention] Purged ${deleted} check result(s) older than ${retentionDays} days`,
    );
  }

  return { deleted, retentionDays, skipped: false };
}

export { getCheckResultRetentionDays, shouldRunRetentionJob } from "@/lib/data-retention-policy";
