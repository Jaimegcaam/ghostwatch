/**
 * Monitoring region configuration.
 *
 * Regions are defined by the deployer — not hardcoded to AWS names.
 *
 * Priority for the monitor UI (region picker + labels in the hub):
 *  1. MONITORING_REGIONS — comma-separated `id` or `id|Label`
 *  2. PROBE_ENDPOINTS — each entry may include a label:
 *     `id|https://probe-host|Label`
 *  3. Single-server self-hosted — PROBE_REGION + optional PROBE_REGION_LABEL
 *  4. Managed (Vercel Edge) — built-in edge region set
 *
 * DEFAULT_REGION picks which region is preselected for new monitors.
 */

import { shouldUseInProcessChecks } from "@/lib/self-hosted";
import {
  getProbeEndpointRegionIds,
  getProbeEndpoints,
  hasRemoteProbeEndpoints,
} from "@/lib/probe-endpoints";

export type Region = { id: string; label: string };

const KNOWN_LABELS: Record<string, string> = {
  local: "This server",
  "us-east-1": "US East",
  "us-west-1": "US West",
  "eu-west-1": "EU West",
  "eu-central-1": "EU Central",
  "eu-south-2": "Spain",
  "ap-southeast-1": "Asia Pacific",
  "sa-east-1": "South America",
};

const EDGE_REGIONS: Region[] = [
  { id: "us-east-1", label: "US East" },
  { id: "us-west-1", label: "US West" },
  { id: "eu-west-1", label: "EU West" },
  { id: "ap-southeast-1", label: "Asia Pacific" },
  { id: "sa-east-1", label: "South America" },
];

function fallbackLabel(id: string): string {
  return KNOWN_LABELS[id] ?? id;
}

function parseConfiguredRegions(): Region[] | null {
  const raw = process.env.MONITORING_REGIONS?.trim();
  if (!raw) return null;

  const regions: Region[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const [idPart, labelPart] = part.split("|");
    const id = idPart?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    regions.push({ id, label: labelPart?.trim() || fallbackLabel(id) });
  }
  return regions.length > 0 ? regions : null;
}

function probeRegionId(): string {
  return process.env.PROBE_REGION?.trim() || "local";
}

function regionsFromProbeEndpoints(): Region[] {
  return getProbeEndpoints().map((e) => ({
    id: e.regionId,
    label: e.label?.trim() || fallbackLabel(e.regionId),
  }));
}

/** All regions a user may pick from when creating/editing a monitor. */
export function getConfiguredRegions(): Region[] {
  const configured = parseConfiguredRegions();
  if (configured) return configured;

  if (hasRemoteProbeEndpoints()) {
    return regionsFromProbeEndpoints();
  }

  if (shouldUseInProcessChecks()) {
    const id = probeRegionId();
    const envLabel = process.env.PROBE_REGION_LABEL?.trim();
    return [{ id, label: envLabel || fallbackLabel(id) }];
  }

  return EDGE_REGIONS;
}

export function getRegionLabelMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const region of getConfiguredRegions()) {
    map[region.id] = region.label;
  }
  return map;
}

export function labelForRegion(id: string): string {
  return getRegionLabelMap()[id] ?? fallbackLabel(id);
}

/** True when probes run only from this server (no real multi-region choice). */
export function isSingleRegion(): boolean {
  return getConfiguredRegions().length <= 1;
}

export function getDefaultRegion(): string {
  const envDefault = process.env.DEFAULT_REGION?.trim();
  const regions = getConfiguredRegions();
  if (envDefault && regions.some((r) => r.id === envDefault)) return envDefault;
  return regions[0]?.id ?? "local";
}

export function getDefaultRegions(): string[] {
  return [getDefaultRegion()];
}

/** Keep only known/configured regions; fall back to the default if none match. */
export function normalizeRegions(regions: unknown): string[] {
  const allowed = new Set(getConfiguredRegions().map((r) => r.id));
  if (Array.isArray(regions)) {
    const valid = regions.filter(
      (r): r is string => typeof r === "string" && allowed.has(r),
    );
    if (valid.length > 0) return [...new Set(valid)];
  }
  return getDefaultRegions();
}

/** Region ids that have a remote worker configured (subset of configured regions). */
export function getProbeableRegionIds(): string[] {
  if (hasRemoteProbeEndpoints()) {
    return getProbeEndpointRegionIds();
  }
  if (shouldUseInProcessChecks()) {
    return [probeRegionId()];
  }
  return getConfiguredRegions().map((r) => r.id);
}
