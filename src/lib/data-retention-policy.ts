/**
 * Retention policy helpers — pure functions with no database dependency.
 */

const DEFAULT_RETENTION_DAYS = 90;

export function getCheckResultRetentionDays(): number {
  const raw = process.env.CHECK_RESULT_RETENTION_DAYS?.trim();
  if (raw === "0" || raw?.toLowerCase() === "false") {
    return 0;
  }
  if (!raw) {
    return DEFAULT_RETENTION_DAYS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_RETENTION_DAYS;
  }

  return parsed;
}

/** Run retention at the top of each UTC hour to avoid doing it on every cron tick. */
export function shouldRunRetentionJob(now: Date = new Date()): boolean {
  return now.getUTCMinutes() === 0;
}
