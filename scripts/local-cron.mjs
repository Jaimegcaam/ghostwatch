#!/usr/bin/env node

/**
 * Check scheduler — calls /api/cron/execute every 60s.
 *
 * On self-hosted, checks run in-process inside the Next.js server.
 * Env: CRON_BASE_URL (Docker: http://127.0.0.1:3000), NEXTAUTH_URL (browser/auth).
 *
 *   npm run dev    # terminal 1
 *   npm run cron   # terminal 2
 */

const BASE_URL =
  process.env.CRON_BASE_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const INTERVAL_MS = Math.max(
  15_000,
  parseInt(process.env.CRON_INTERVAL_MS || "60000", 10) || 60_000,
);

if (!CRON_SECRET) {
  console.error("CRON_SECRET not set");
  process.exit(1);
}

async function waitForApp(maxAttempts = 30) {
  const healthUrl = `${BASE_URL.replace(/\/$/, "")}/api/health`;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        console.log(`[cron] App ready at ${BASE_URL}`);
        return;
      }
    } catch {
      /* server still starting */
    }
    if (i < maxAttempts) {
      console.log(`[cron] Waiting for app (${i}/${maxAttempts})…`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.warn("[cron] App not reachable yet — will keep retrying on each tick");
}

async function tick() {
  const now = new Date().toLocaleTimeString();
  try {
    const res = await fetch(`${BASE_URL}/api/cron/execute`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const s = data.summary;
      console.log(
        `[${now}] ✓ ${s.checksRun}/${s.checksEvaluated} checks, ${s.regionsExecuted} regions, ${s.skipped ?? 0} skipped, ${s.succeeded} ok, ${s.failed} failed`,
      );
    } else {
      console.log(`[${now}] ✗ ${res.status}: ${data.error ?? "error"}`);
    }
  } catch (err) {
    console.log(`[${now}] ✗ ${err.message}`);
  }
}

await waitForApp();

console.log(
  `[cron] Scheduler started — ${BASE_URL}/api/cron/execute every ${INTERVAL_MS / 1000}s`,
);
console.log("Press Ctrl+C to stop.\n");

tick();
setInterval(tick, INTERVAL_MS);
