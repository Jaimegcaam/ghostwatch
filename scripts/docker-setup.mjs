#!/usr/bin/env node

/**
 * Interactive Docker setup — creates .env with generated secrets.
 * Usage: npm run docker:setup
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");
const TEMPLATE_PATH = resolve(process.cwd(), ".env.docker.example");

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
    console.log("\n.env already exists — nothing changed.");
    console.log("Delete it first if you want a fresh setup.\n");
    process.exit(0);
  }
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(".env.docker.example not found. Run this from the repo root.");
    process.exit(1);
  }

  console.log("\nGhostwatch — Docker setup\n");
  console.log("Press Enter to accept the defaults.\n");

  const rl = createInterface({ input: stdin, output: stdout });

  const appUrl = await prompt(rl, "Dashboard URL", "http://localhost:3000");
  let appHost;
  try {
    appHost = new URL(appUrl).hostname;
  } catch {
    appHost = "localhost";
  }
  const ownerEmail = await prompt(
    rl,
    "Owner email (optional — leave blank to use first signup)",
    "",
  );

  rl.close();

  let env = readFileSync(TEMPLATE_PATH, "utf-8");

  env = env
    .replace(/^NEXTAUTH_URL=.*/m, `NEXTAUTH_URL=${appUrl}`)
    .replace(/^APP_HOST=.*/m, `APP_HOST=${appHost}`)
    .replace(/^AUTH_SECRET=.*/m, `AUTH_SECRET=${gen(32)}`)
    .replace(/^CRON_SECRET=.*/m, `CRON_SECRET=${gen(32)}`)
    .replace(/^POSTGRES_PASSWORD=.*/m, `POSTGRES_PASSWORD=${gen(24)}`)
    .replace(/^OWNER_EMAIL=.*/m, `OWNER_EMAIL=${ownerEmail}`);

  writeFileSync(ENV_PATH, env);

  console.log("\n✓ Created .env");
  console.log("\nNext:");
  console.log("  docker compose up -d");
  console.log(`  open ${appUrl}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
