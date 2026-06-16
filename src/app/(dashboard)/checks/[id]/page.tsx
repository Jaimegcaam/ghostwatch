import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireAuth } from "@/lib/auth-utils";
import { LATENCY_WINDOW_MS, latencyWindowStart } from "@/lib/display-latency";
import { getRegionLabelMap } from "@/lib/regions";
import { db } from "@/lib/db";
import { CheckDetailClient } from "./check-detail-client";
import type { CheckResult } from "@/generated/prisma/client";

interface CheckDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CheckDetailPage({
  params,
}: CheckDetailPageProps) {
  const user = await requireAuth();
  const { id } = await params;
  const latencySince = latencyWindowStart();

  const [check, latencyProbeRows] = await Promise.all([
    db.check.findUnique({
      where: { id },
      include: {
        project: { select: { teamId: true } },
        results: {
          orderBy: { createdAt: "desc" },
          take: 200,
        },
      },
    }),
    db.checkResult.findMany({
      where: { checkId: id, createdAt: { gte: latencySince } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        responseTime: true,
        success: true,
        error: true,
        region: true,
        isAnomaly: true,
        createdAt: true,
      },
    }),
  ]);

  if (!check) notFound();

  const isMember = user.teamMemberships.some(
    (m) => m.team.id === check.project.teamId,
  );
  if (!isMember) notFound();

  const successCount = await db.checkResult.count({
    where: { checkId: id, success: true },
  });
  const totalCount = await db.checkResult.count({
    where: { checkId: id },
  });
  const uptime =
    totalCount === 0
      ? 100
      : Math.round((successCount / totalCount) * 10000) / 100;

  const oneHourAgo = Date.now() - LATENCY_WINDOW_MS;
  const recentFromTable = check.results.filter(
    (r: CheckResult) => new Date(r.createdAt).getTime() >= oneHourAgo,
  );
  const chartSource =
    latencyProbeRows.length > 0
      ? latencyProbeRows
      : recentFromTable.length > 0
        ? recentFromTable
        : check.results.slice(0, 60);

  const chartData = chartSource.map((r) => ({
    chartKey: r.id,
    at: new Date(r.createdAt).getTime(),
    time: format(new Date(r.createdAt), "HH:mm"),
    responseTime: r.responseTime ?? 0,
    success: r.success,
    region: r.region,
  }));

  const latencyProbes = latencyProbeRows.map((r) => ({
    success: r.success,
    responseTime: r.responseTime,
    createdAt: r.createdAt.toISOString(),
    region: r.region,
  }));

  const resultsData = check.results.map((r: CheckResult) => ({
    id: r.id,
    status: r.status,
    responseTime: r.responseTime,
    success: r.success,
    error: r.error,
    region: r.region,
    isAnomaly: r.isAnomaly,
    createdAt: r.createdAt.toISOString(),
  }));

  const intervalLabel = formatInterval(check.interval);

  return (
    <CheckDetailClient
      check={{
        id: check.id,
        name: check.name,
        url: check.url,
        method: check.method,
        enabled: check.enabled,
        expectedStatus: check.expectedStatus,
        timeout: check.timeout,
        interval: check.interval,
        intervalLabel,
        headers: check.headers as Record<string, string> | null,
        body: check.body,
        regions: check.regions,
        isPublic: check.isPublic,
      }}
      uptime={uptime}
      chartData={chartData}
      latencyProbes={latencyProbes}
      results={resultsData}
      regionLabels={getRegionLabelMap()}
    />
  );
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}min`;
  return `${seconds / 3600}hr`;
}
