import { NextResponse } from "next/server";
import {
  getHealthyProbeRegions,
  getProbeStatuses,
  invalidateProbeStatusCache,
} from "@/lib/probe-health";

export const dynamic = "force-dynamic";

/** Live probe worker health (hub polls each PROBE_ENDPOINTS worker). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("refresh") === "true") {
    invalidateProbeStatusCache();
  }

  const probes = await getProbeStatuses({ force: true });
  const selectableRegions = getHealthyProbeRegions(probes);

  return NextResponse.json({
    probes,
    selectableRegions,
    checkedAt: probes[0]?.lastChecked ?? new Date().toISOString(),
  });
}
