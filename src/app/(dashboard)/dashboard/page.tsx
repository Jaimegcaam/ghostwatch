import { format } from "date-fns";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Wrench,
} from "lucide-react";

import { RunChecksButton } from "@/components/dashboard/run-checks-button";
import { DashboardViewportLists } from "@/components/dashboard/dashboard-viewport-lists";
import { ProbeStatusPanel } from "@/components/dashboard/probe-status-panel";
import { ACTIVE_TEAM_COOKIE, resolveActiveMembership } from "@/lib/active-team";
import { getCurrentUser } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import {
  computeDisplayLatency,
  computeProjectAvgLatency,
  latencyResultsInclude,
} from "@/lib/display-latency";
import { dashboardLinkClass } from "@/lib/uptime-colors";
import { getProbeStatuses } from "@/lib/probe-health";
import { labelForRegion } from "@/lib/regions";
import {
  listDivide,
  listRow,
  pageSubtitle,
  pageTitle,
  panel,
} from "@/lib/theme-classes";
import type { CheckResult } from "@/generated/prisma/client";

const RECENT_ACTIVITY_FETCH_LIMIT = 100;

export default async function DashboardOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const cookieStore = await cookies();
  const savedTeamId = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;
  const membership = resolveActiveMembership(user.teamMemberships, savedTeamId);

  if (!membership) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-4 h-12 w-12 rounded-2xl bg-gw-surface-2" />
        <h1 className="text-lg font-semibold text-gw-fg">No team found</h1>
        <p className="mt-1 text-sm text-gw-fg-muted">
          Create or join a team to get started with monitoring.
        </p>
        <Link
          href="/teams/new"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Create a team
        </Link>
      </div>
    );
  }

  const projectId = membership.team.projects[0]?.id;
  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-4 h-12 w-12 rounded-2xl bg-gw-surface-2" />
        <h1 className="text-lg font-semibold text-gw-fg">No project found</h1>
        <p className="mt-1 text-sm text-gw-fg-muted">
          Create a project to get started with monitoring.
        </p>
      </div>
    );
  }

  const now = new Date();
  const probes = await getProbeStatuses();
  const probeCheckedAt = probes[0]?.lastChecked ?? null;

  const [
    checks,
    recentResults,
    resultCounts,
    resultGroups,
    activeMaintenances,
  ] = await Promise.all([
    db.check.findMany({
      where: { projectId },
      include: {
        results: latencyResultsInclude(),
        _count: { select: { results: true } },
      },
      orderBy: [{ enabled: "desc" }, { name: "asc" }],
    }),
    db.checkResult.findMany({
      where: { check: { projectId } },
      orderBy: { createdAt: "desc" },
      take: RECENT_ACTIVITY_FETCH_LIMIT,
      include: {
        check: { select: { id: true, name: true } },
      },
    }),
    Promise.all([
      db.checkResult.count({ where: { check: { projectId } } }),
      db.checkResult.count({
        where: { check: { projectId }, success: true },
      }),
    ]),
    db.checkResult.groupBy({
      by: ["checkId", "success"],
      where: { check: { projectId } },
      _count: { _all: true },
    }),
    db.maintenance.findMany({
      where: {
        projectId,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
        scheduledEnd: { gte: now },
      },
      include: {
        checks: {
          include: { check: { select: { name: true } } },
        },
      },
      orderBy: { scheduledStart: "asc" },
      take: 5,
    }),
  ]);

  const [totalResultCount, passedResultCount] = resultCounts;

  const uptimeByCheck = new Map<string, { total: number; passed: number }>();
  for (const row of resultGroups) {
    const existing = uptimeByCheck.get(row.checkId) ?? { total: 0, passed: 0 };
    existing.total += row._count._all;
    if (row.success) existing.passed += row._count._all;
    uptimeByCheck.set(row.checkId, existing);
  }

  const totalChecks = checks.length;
  const enabledChecks = checks.filter((c) => c.enabled);
  const pausedChecks = checks.filter((c) => !c.enabled);

  let passingChecks = 0;
  let failingChecks = 0;
  let unknownChecks = 0;

  const monitorRows = checks.map((check) => {
    const latest = check.results[0];
    let status: "passing" | "failing" | "paused" | "unknown";
    if (!check.enabled) status = "paused";
    else if (!latest) status = "unknown";
    else if (latest.success) status = "passing";
    else status = "failing";

    if (check.enabled) {
      if (!latest) unknownChecks += 1;
      else if (latest.success) passingChecks += 1;
      else failingChecks += 1;
    }

    const counts = uptimeByCheck.get(check.id);
    const uptime =
      !counts || counts.total === 0
        ? null
        : Math.round((counts.passed / counts.total) * 10000) / 100;

    return {
      id: check.id,
      name: check.name,
      enabled: check.enabled,
      status,
      uptime,
      totalRuns: counts?.total ?? 0,
      displayLatency: computeDisplayLatency(
        check.results,
        check.regions ?? [],
      ),
      latest,
    };
  });

  const uptimePercent =
    totalResultCount === 0
      ? null
      : Math.round((passedResultCount / totalResultCount) * 1000) / 10;

  const avgResponseMs = computeProjectAvgLatency(
    monitorRows.map((row) => row.displayLatency),
  );

  const firstName = user.name?.split(" ")[0] ?? "there";

  const health = getSystemHealth({
    totalEnabled: enabledChecks.length,
    failingChecks,
    unknownChecks,
    hasMaintenance: activeMaintenances.length > 0,
  });

  const stats = [
    {
      label: "Total Monitors",
      value: String(totalChecks),
      accent: "text-gw-fg",
      href: "/checks",
    },
    {
      label: "Passing",
      value: String(passingChecks),
      accent: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Failing",
      value: String(failingChecks),
      accent:
        failingChecks > 0
          ? "text-red-600 dark:text-red-400"
          : "text-gw-fg",
    },
    {
      label: "Paused",
      value: String(pausedChecks.length),
      accent:
        pausedChecks.length > 0
          ? "text-amber-600 dark:text-amber-400"
          : "text-gw-fg",
    },
    {
      label: "Avg Response",
      value: avgResponseMs === null ? "—" : `${avgResponseMs}ms`,
      accent: "text-gw-fg",
    },
    {
      label: "Uptime",
      value: uptimePercent === null ? "—" : `${uptimePercent}%`,
      accent:
        uptimePercent === null
          ? "text-gw-fg-subtle"
          : uptimePercent >= 99
            ? "text-emerald-600 dark:text-emerald-400"
            : uptimePercent >= 95
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400",
      sub:
        uptimePercent === null
          ? "No data yet"
          : `${passedResultCount.toLocaleString()} / ${totalResultCount.toLocaleString()} runs`,
    },
  ];

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col gap-6 lg:min-h-[calc(100dvh-4rem)]">
      <div className="shrink-0 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className={pageTitle}>
              Good {getGreetingTime()}, {firstName}
            </h1>
            <p className={pageSubtitle}>
              Overview of your team&apos;s monitoring infrastructure.
            </p>
          </div>
          <RunChecksButton />
        </div>

        <div
          className={`rounded-xl border px-4 py-3.5 sm:px-5 ${health.borderClass} ${health.bgClass}`}
        >
          <div className="flex items-start gap-3">
            <health.Icon
              className={`mt-0.5 h-5 w-5 shrink-0 ${health.iconClass}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${health.titleClass}`}>
                {health.title}
              </p>
              <p className={`mt-0.5 text-sm ${health.detailClass}`}>
                {health.detail}
              </p>
            </div>
            {failingChecks > 0 && (
              <Link
                href="/checks"
                className={`hidden shrink-0 items-center gap-1 text-xs font-medium sm:inline-flex ${dashboardLinkClass}`}
              >
                View failing
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {stats.map((stat) => {
            const content = (
              <>
                <p className="text-[11px] font-medium uppercase tracking-wide text-gw-fg-subtle">
                  {stat.label}
                </p>
                <p
                  className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${stat.accent}`}
                >
                  {stat.value}
                </p>
                {"sub" in stat && stat.sub ? (
                  <p className="mt-1 text-[11px] text-gw-fg-subtle">{stat.sub}</p>
                ) : null}
              </>
            );

            if ("href" in stat && stat.href) {
              return (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className={`${panel} block p-4 transition-colors hover:bg-gw-surface-hover`}
                >
                  {content}
                </Link>
              );
            }

            return (
              <div key={stat.label} className={`${panel} p-4`}>
                {content}
              </div>
            );
          })}
        </div>

        {probes.length > 0 ? (
          <ProbeStatusPanel
            initialProbes={probes}
            checkedAt={probeCheckedAt}
          />
        ) : null}

        {activeMaintenances.length > 0 && (
          <div className={`${panel} overflow-hidden`}>
            <div className="border-b border-gw-border px-5 py-4">
              <h2 className="text-sm font-semibold text-gw-fg">
                Scheduled maintenance
              </h2>
              <p className="mt-0.5 text-xs text-gw-fg-subtle">
                Upcoming or in-progress windows
              </p>
            </div>
            <div className={listDivide}>
              {activeMaintenances.map((m) => (
                <div key={m.id} className={`px-5 py-3.5 ${listRow}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gw-fg">{m.title}</p>
                      <p className="mt-0.5 text-xs text-gw-fg-subtle">
                        {format(m.scheduledStart, "MMM d, HH:mm")} →{" "}
                        {format(m.scheduledEnd, "MMM d, HH:mm")}
                      </p>
                      {m.checks.length > 0 && (
                        <p className="mt-1.5 text-[11px] text-gw-fg-muted">
                          {m.checks.map((mc) => mc.check.name).join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      {m.status === "IN_PROGRESS" ? "In progress" : "Scheduled"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <DashboardViewportLists
        monitors={monitorRows.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          uptime: row.uptime,
          displayLatency: row.displayLatency,
          totalRuns: row.totalRuns,
          latestAt: row.latest?.createdAt.toISOString() ?? null,
        }))}
        activity={recentResults.map(
          (
            row: CheckResult & {
              check: { id: string; name: string };
            },
          ) => ({
            id: row.id,
            checkId: row.check.id,
            checkName: row.check.name,
            success: row.success,
            status: row.status != null ? String(row.status) : null,
            regionLabel: row.region ? labelForRegion(row.region) : null,
            responseTime: row.responseTime,
            createdAt: row.createdAt.toISOString(),
          }),
        )}
      />
    </div>
  );
}

function getSystemHealth({
  totalEnabled,
  failingChecks,
  unknownChecks,
  hasMaintenance,
}: {
  totalEnabled: number;
  failingChecks: number;
  unknownChecks: number;
  hasMaintenance: boolean;
}) {
  if (totalEnabled === 0) {
    return {
      title: "No active monitors",
      detail: "Create a monitor to start tracking your services.",
      Icon: Activity,
      bgClass: "bg-gw-surface-2",
      borderClass: "border-gw-border",
      iconClass: "text-gw-fg-subtle",
      titleClass: "text-gw-fg",
      detailClass: "text-gw-fg-muted",
    };
  }

  if (failingChecks > 0) {
    const allDown = failingChecks === totalEnabled;
    return {
      title: allDown ? "Major outage" : "Partial outage",
      detail: allDown
        ? `All ${failingChecks} active monitor${failingChecks === 1 ? "" : "s"} are failing.`
        : `${failingChecks} of ${totalEnabled} active monitor${totalEnabled === 1 ? "" : "s"} failing.`,
      Icon: AlertTriangle,
      bgClass: "bg-red-50 dark:bg-red-950/30",
      borderClass: "border-red-200 dark:border-red-900/50",
      iconClass: "text-red-600",
      titleClass: "text-red-900 dark:text-red-200",
      detailClass: "text-red-700 dark:text-red-300",
    };
  }

  if (hasMaintenance) {
    return {
      title: "Maintenance scheduled",
      detail: "Some monitors have upcoming or active maintenance windows.",
      Icon: Wrench,
      bgClass: "bg-blue-50 dark:bg-blue-950/30",
      borderClass: "border-blue-200 dark:border-blue-900/50",
      iconClass: "text-blue-600",
      titleClass: "text-blue-900 dark:text-blue-200",
      detailClass: "text-blue-700 dark:text-blue-300",
    };
  }

  if (unknownChecks > 0) {
    return {
      title: "Waiting for first results",
      detail: `${unknownChecks} monitor${unknownChecks === 1 ? "" : "s"} enabled but not run yet.`,
      Icon: Activity,
      bgClass: "bg-amber-50 dark:bg-amber-950/30",
      borderClass: "border-amber-200 dark:border-amber-900/50",
      iconClass: "text-amber-600",
      titleClass: "text-amber-900 dark:text-amber-200",
      detailClass: "text-amber-700 dark:text-amber-300",
    };
  }

  return {
    title: "All systems operational",
    detail: `${totalEnabled} monitor${totalEnabled === 1 ? "" : "s"} passing across all regions.`,
    Icon: CheckCircle2,
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    borderClass: "border-emerald-200 dark:border-emerald-900/50",
    iconClass: "text-emerald-600",
    titleClass: "text-emerald-900 dark:text-emerald-200",
    detailClass: "text-emerald-700 dark:text-emerald-300",
  };
}

function getGreetingTime() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
