/**
 * Check scheduling — minute-aligned slots for interval >= 60s so each monitor
 * runs once per interval (all regions together), without duplicate ticks.
 */

/** Floor to start of minute (UTC/local server time). */
export function floorToMinute(date: Date): Date {
  const d = new Date(date);
  d.setMilliseconds(0);
  d.setSeconds(0);
  return d;
}

/** When the check should run again after `lastCheckedAt`. */
export function getNextCheckRunAt(
  lastCheckedAt: Date | null,
  intervalSeconds: number,
): Date {
  if (!lastCheckedAt) {
    return floorToMinute(new Date());
  }

  const intervalMs = intervalSeconds * 1000;

  if (intervalSeconds >= 60) {
    const lastSlot = floorToMinute(lastCheckedAt);
    return new Date(lastSlot.getTime() + intervalMs);
  }

  return new Date(lastCheckedAt.getTime() + intervalMs);
}

export function isCheckDue(
  lastCheckedAt: Date | null,
  intervalSeconds: number,
  now: Date = new Date(),
): boolean {
  if (!lastCheckedAt) return true;
  return now.getTime() >= getNextCheckRunAt(lastCheckedAt, intervalSeconds).getTime();
}

/** Slot timestamp stored on the check when a run is claimed. */
export function currentCheckSlot(
  intervalSeconds: number,
  now: Date = new Date(),
): Date {
  if (intervalSeconds >= 60) {
    return floorToMinute(now);
  }
  return now;
}

/** End of the slot window (exclusive) for deduplicating results. */
export function checkSlotEnd(slot: Date, intervalSeconds: number): Date {
  const ms = intervalSeconds >= 60 ? 60_000 : intervalSeconds * 1000;
  return new Date(slot.getTime() + ms);
}
