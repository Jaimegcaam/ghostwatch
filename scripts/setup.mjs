#!/usr/bin/env node

/**
 * Interactive setup for Ghostwatch — creates a sane .env file in seconds.
 *
 * Usage:
 *   npm run setup
 *
 * The script:
 *  - copies .env.example → .env if it doesn't exist
 *  - generates AUTH_SECRET and CRON_SECRET
 *  - asks for the DATABASE_URL (or suggests a Docker default)
 *  - asks whether you want SELF_HOSTED mode (default: yes)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");
const TEMPLATE_PATH = resolve(process.cwd(), ".env.example");

function gen(bytes = 32) {
  return randomBytes(bytes).toString("base64").replace(/=+$/, "");
}

async function prompt(rl, label, def) {
  const suffix = def ? ` [${def}]` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || def || "";
}

async function main() {
  if (existsSync(ENV_PATH)) {
    console.log("\n.env already exists — aborting to avoid overwriting it.");
    console.log("Delete it manually if you want a fresh setup.\n");
    process.exit(0);
  }
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(".env.example not found. Run this from the repo root.");
    process.exit(1);
  }

  console.log("\nGhostwatch — interactive setup\n");

  const rl = createInterface({ input: stdin, output: stdout });

  const dbUrl = await prompt(
    rl,
    "Database URL",
    "postgresql://ghostwatch:ghostwatch@localhost:5432/ghostwatch?schema=public",
  );
  const appUrl = await prompt(rl, "App URL", "http://localhost:3000");
  const appHost = new URL(appUrl).host.split(":")[0];

  const selfHosted = (
    await prompt(rl, "Self-hosted private mode? (yes/no)", "yes")
  )
    .toLowerCase()
    .startsWith("y");

  const ownerEmail = selfHosted
    ? await prompt(rl, "Owner email (optional, leave blank to use first signup)", "")
    : "";

  rl.close();

  let env = readFileSync(TEMPLATE_PATH, "utf-8");

  env = env
    .replace(/^DATABASE_URL=.*/m, `DATABASE_URL="${dbUrl}"`)
    .replace(/^NEXTAUTH_URL=.*/m, `NEXTAUTH_URL="${appUrl}"`)
    .replace(/^AUTH_SECRET=.*/m, `AUTH_SECRET="${gen(32)}"`)
    .replace(/^CRON_SECRET=.*/m, `CRON_SECRET="${gen(32)}"`);

  if (!env.includes("APP_HOST=")) {
    env += `\nAPP_HOST="${appHost}"\n`;
  } else {
    env = env.replace(/^APP_HOST=.*/m, `APP_HOST="${appHost}"`);
  }

  if (!env.includes("SELF_HOSTED=")) {
    env += `\n# Private instance (invitation-only access)\nSELF_HOSTED="${selfHosted}"\nOWNER_EMAIL="${ownerEmail}"\n`;
  }

  writeFileSync(ENV_PATH, env, "utf-8");

  console.log("\n✓ .env created");
  console.log("\nNext steps:");
  console.log("  1. (optional) docker compose -f docker-compose.dev.yml up -d   # start Postgres");
  console.log("  2. npx prisma migrate deploy                                    # apply schema");
  console.log("  3. npm run dev                                                  # start app");
  console.log("  4. npm run cron                                                 # in another shell — run scheduled checks");
  console.log("  5. open http://localhost:3000 and create your account.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
