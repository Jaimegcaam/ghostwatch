import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { requiresEmailVerification } from "@/lib/auth-email";
import {
  getHealthyProbeRegions,
  getInstalledProbeRegions,
  getProbeStatuses,
} from "@/lib/probe-health";
import {
  getConfiguredRegions,
  getDefaultRegion,
  isSingleRegion,
} from "@/lib/regions";
import { hasRemoteProbeEndpoints } from "@/lib/probe-endpoints";
import {
  isGitHubOAuthEnabled,
  isGoogleOAuthEnabled,
  isOAuthEnabled,
} from "@/lib/auth-providers";
import {
  isOpenRegistrationEnabled,
  isProbeWorker,
  isSelfHosted,
  shouldEnableBuiltinScheduler,
  shouldUseInProcessChecks,
} from "@/lib/self-hosted";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forceProbeRefresh = url.searchParams.get("refreshProbes") === "true";

  const userCount = await db.user.count().catch(() => -1);
  const selfHosted = isSelfHosted();
  const openRegistration = isOpenRegistrationEnabled();
  const probes = await getProbeStatuses({ force: forceProbeRefresh });
  const selectableRegions = getHealthyProbeRegions(probes);
  const installedRegions = getInstalledProbeRegions();

  return NextResponse.json({
    selfHosted,
    openRegistration,
    bootstrap: selfHosted && userCount === 0,
    userCount: userCount === -1 ? null : userCount,
    /** HTTP checks run inside this process (not via remote or edge probes). */
    inProcessChecks: shouldUseInProcessChecks(),
    builtinScheduler: shouldEnableBuiltinScheduler(),
    probeWorker: isProbeWorker(),
    remoteProbes: hasRemoteProbeEndpoints(),
    probeRegion: process.env.PROBE_REGION || (selfHosted ? "local" : null),
    /** All configured region labels (may include undeployed ids). */
    regions: getConfiguredRegions(),
    /** Regions with a probe worker defined in PROBE_ENDPOINTS (or local/edge). */
    installedRegions,
    /** Regions that passed the latest health check — use for new monitors. */
    selectableRegions,
    /** Per-probe health for the dashboard. */
    probes,
    defaultRegion: getDefaultRegion(),
    singleRegion: isSingleRegion(),
    emailConfigured: isEmailConfigured(),
    requiresEmailVerification: requiresEmailVerification(),
    oauthEnabled: isOAuthEnabled(),
    googleOAuth: isGoogleOAuthEnabled(),
    githubOAuth: isGitHubOAuthEnabled(),
  });
}
