import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Wrench } from "lucide-react";
import { format } from "date-fns";

import { db } from "@/lib/db";
import { resolvePublicStatusPageByHost } from "@/lib/status-domains";
import { getMainAppHosts } from "@/lib/status-domain-hosts";
import { UptimeBars } from "@/components/status/uptime-bars";
import type { DayData } from "@/components/status/uptime-bars";
import { PastIncidents } from "@/components/status/past-incidents";
import {
  computeLiveStatusForRegions,
  computeOutageDaysForRegions,
  computeStatusEventsForRegions,
  getOutageThreshold,
  groupStatusEvents,
  filterPublicStatusEvents,
  statusEventCopy,
  toLocalDateStr,
} from "@/lib/uptime-status";
import { labelForRegion } from "@/lib/regions";
import { publicUploadSrc } from "@/lib/upload-url";
import { computeDisplayLatency } from "@/lib/display-latency";
import {
  getMonitorBadgeStyles,
  getStatusPagePalette,
  getStatusPageBarColors,
  parseStatusPageTheme,
  uptimeDisplayColor,
} from "@/lib/status-page-theme";
import { GhostwatchLogo } from "@/components/brand/ghostwatch-logo";

function processDailyUptime(
  results: { success: boolean; createdAt: Date }[],
  maintenanceDates: Set<string>,
  maintenanceRanges: { start: Date; end: Date }[],
  outageDays: Set<string>,
): DayData[] {
  const dailyMap = new Map<string, { total: number; successful: number }>();

  for (const result of results) {
    if (isTimeDuringMaintenance(result.createdAt, maintenanceRanges)) continue;
    const date = toLocalDateStr(result.createdAt);
    const existing = dailyMap.get(date) || { total: 0, successful: 0 };
    existing.total++;
    if (result.success) existing.successful++;
    dailyMap.set(date, existing);
  }

  const days: DayData[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = toLocalDateStr(d);
    const dayData = dailyMap.get(dateStr);
    const isMaintenance = maintenanceDates.has(dateStr);
    const percentage = dayData
      ? Math.round((dayData.successful / dayData.total) * 10000) / 100
      : null;

    let status: DayData["status"];
    if (isMaintenance) status = "maintenance";
    else if (!dayData) status = "nodata";
    else if (outageDays.has(dateStr)) status = "outage";
    else if (dayData.successful < dayData.total) status = "degraded";
    else status = "operational";

    days.push({ date: dateStr, percentage, isMaintenance, status });
  }

  return days;
}

type MaintenanceWithChecks = {
  scheduledStart: Date;
  scheduledEnd: Date;
  checks: { check: { id: string; name: string } }[];
};

function getMaintenanceDatesForCheck(
  maintenances: MaintenanceWithChecks[],
  checkId: string,
): Set<string> {
  const dates = new Set<string>();
  for (const m of maintenances) {
    if (!m.checks.some((mc) => mc.check.id === checkId)) continue;
    const start = new Date(m.scheduledStart);
    const end = new Date(m.scheduledEnd);
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      dates.add(toLocalDateStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return dates;
}

function getMaintenanceRangesForCheck(
  maintenances: MaintenanceWithChecks[],
  checkId: string,
): { start: Date; end: Date }[] {
  return maintenances
    .filter((m) => m.checks.some((mc) => mc.check.id === checkId))
    .map((m) => ({
      start: new Date(m.scheduledStart),
      end: new Date(m.scheduledEnd),
    }));
}

function isTimeDuringMaintenance(
  time: Date,
  ranges: { start: Date; end: Date }[],
): boolean {
  return ranges.some((r) => time >= r.start && time <= r.end);
}

export default async function PublicStatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const h = await headers();
  const requestHost =
    h.get("x-ghostwatch-host") ||
    h.get("host")?.split(":")[0].toLowerCase() ||
    "";
  const onCustomDomain =
    requestHost.length > 0 && !getMainAppHosts().has(requestHost);

  const requestProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const requestOrigin = requestHost
    ? `${requestProto}://${requestHost.split(":")[0]}`
    : null;

  if (onCustomDomain) {
    const bound = await resolvePublicStatusPageByHost(requestHost);
    // Custom host with no domain binding, or wrong page for this host.
    if (!bound || bound.slug !== slug) notFound();
    // Direct visit to /s/<slug> — canonical URL is the domain root.
    if (!h.get("x-ghostwatch-host")) {
      redirect("/");
    }
  }

  const statusPage = await db.statusPage.findUnique({
    where: { slug },
    include: {
      project: true,
      checks: {
        include: {
          check: {
            include: {
              results: {
                where: { createdAt: { gte: ninetyDaysAgo } },
                orderBy: { createdAt: "asc" },
                select: {
                  success: true,
                  createdAt: true,
                  responseTime: true,
                  region: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!statusPage || !statusPage.isPublic) notFound();

  const theme = parseStatusPageTheme(statusPage.theme);
  const colors = getStatusPagePalette(theme);
  const barColors = getStatusPageBarColors(theme);
  const logoSrc = publicUploadSrc(statusPage.logoUrl, requestOrigin);

  const statusPageCheckIds = statusPage.checks
    .filter((spc) => spc.check.isPublic && spc.check.enabled)
    .map((spc) => spc.check.id);

  const maintenances =
    statusPageCheckIds.length === 0
      ? []
      : await db.maintenance.findMany({
          where: {
            projectId: statusPage.projectId,
            scheduledStart: { gte: ninetyDaysAgo },
            checks: {
              some: { checkId: { in: statusPageCheckIds } },
            },
          },
          include: {
            checks: {
              where: { checkId: { in: statusPageCheckIds } },
              include: {
                check: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { scheduledStart: "desc" },
        });

  const outageThreshold = getOutageThreshold();

  const checksWithData = statusPage.checks
    .filter((spc) => spc.check.isPublic && spc.check.enabled)
    .map((spc) => {
      const { check } = spc;
      const maintenanceDates = getMaintenanceDatesForCheck(
        maintenances,
        check.id,
      );
      const maintenanceRanges = getMaintenanceRangesForCheck(
        maintenances,
        check.id,
      );
      const probesOutsideMaintenance = check.results.filter(
        (r) => !isTimeDuringMaintenance(r.createdAt, maintenanceRanges),
      );
      const monitorRegions = check.regions?.length ? check.regions : [];
      const outageDays = computeOutageDaysForRegions(
        probesOutsideMaintenance,
        monitorRegions,
        outageThreshold,
      );
      const liveStatus = computeLiveStatusForRegions(
        probesOutsideMaintenance,
        monitorRegions,
        outageThreshold,
      );
      const days = processDailyUptime(
        check.results,
        maintenanceDates,
        maintenanceRanges,
        outageDays,
      );

      const overallUptime =
        probesOutsideMaintenance.length > 0
          ? Math.round(
              (probesOutsideMaintenance.filter((r) => r.success).length /
                probesOutsideMaintenance.length) *
                10000,
            ) / 100
          : null;

      const latencyProbes = check.results.filter(
        (r) => !isTimeDuringMaintenance(r.createdAt, maintenanceRanges),
      );
      const avgLatency = computeDisplayLatency(latencyProbes, monitorRegions);

      const now = new Date();
      const isUnderMaintenance = maintenanceRanges.some(
        (r) => now >= r.start && now <= r.end,
      );

      return {
        id: check.id,
        name: check.name,
        regions: monitorRegions,
        days,
        overallUptime,
        avgLatency,
        liveStatus,
        isUnderMaintenance,
        statusEvents: groupStatusEvents(
          filterPublicStatusEvents(
            computeStatusEventsForRegions(
              probesOutsideMaintenance,
              monitorRegions,
              outageThreshold,
            ),
          ),
        ),
      };
    });

  const monitorChecks = checksWithData.filter((c) => !c.isUnderMaintenance);
  const outageCount = monitorChecks.filter(
    (c) => c.liveStatus === "outage",
  ).length;
  const degradedCount = monitorChecks.filter(
    (c) => c.liveStatus === "degraded",
  ).length;
  const allOperational = outageCount === 0 && degradedCount === 0;
  const allDown =
    monitorChecks.length > 0 && outageCount === monitorChecks.length;

  const activeMaintenances = maintenances.filter(
    (m) => m.status === "IN_PROGRESS" || m.status === "SCHEDULED",
  );
  const pastMaintenances = maintenances.filter(
    (m) => m.status === "COMPLETED",
  );

  const allIncidents = checksWithData
    .flatMap((c) =>
      c.statusEvents.map((evt) => {
        const regionLabel = evt.region ? labelForRegion(evt.region) : null;
        const copy = statusEventCopy(c.name, evt, regionLabel);
        return {
          id: evt.id,
          monitorName: c.name,
          headline: copy.headline,
          detail: copy.detail,
          severity: evt.severity,
          status: evt.status,
          startedAt: evt.startedAt,
          resolvedAt: evt.resolvedAt,
          region: evt.region ?? null,
          regionLabel,
          groupedCount: evt.groupedCount ?? 1,
        };
      }),
    )
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const incidentsByDateMap = new Map<string, typeof allIncidents>();
  for (const inc of allIncidents) {
    const dateKey = format(inc.startedAt, "yyyy-MM-dd");
    const existing = incidentsByDateMap.get(dateKey) || [];
    existing.push(inc);
    incidentsByDateMap.set(dateKey, existing);
  }

  const incidentsByDate = Object.fromEntries(
    [...incidentsByDateMap.entries()].map(([dateKey, incidents]) => [
      dateKey,
      incidents.map((inc) => ({
        id: inc.id,
        headline: inc.headline,
        detail: inc.detail,
        status: inc.status,
        startedAt: inc.startedAt.toISOString(),
        resolvedAt: inc.resolvedAt?.toISOString() ?? null,
        regionLabel: inc.regionLabel,
      })),
    ]),
  );

  const hasActiveMaintenance = activeMaintenances.length > 0;
  const hasOutage = outageCount > 0;
  const statusLabel = hasActiveMaintenance
    ? "Scheduled Maintenance"
    : allOperational
      ? "All Systems Operational"
      : allDown
        ? "Major Outage"
        : hasOutage
          ? "Partial System Outage"
          : "Degraded Performance";

  const dotColor = hasActiveMaintenance
    ? "#3b82f6"
    : allOperational
      ? "#22c55e"
      : allDown
        ? "#ef4444"
        : hasOutage
          ? "#f97316"
          : "#f59e0b";

  const now = new Date();
  const lastUpdated = format(now, "MMM d, yyyy, hh:mm a");

  return (
    <div
      className="min-h-screen"
      data-status-theme={theme}
      style={{
        backgroundColor: colors.pageBg,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Status hero */}
      <div className="relative" style={{ backgroundColor: colors.heroBg }}>
        {logoSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt={`${statusPage.title} logo`}
              className="absolute left-6 top-6 z-10 h-24 w-auto max-w-[320px] object-contain object-left sm:left-8 sm:top-8"
            />
          </>
        ) : null}
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-12">
          {/* Animated dot */}
          <span className="relative mb-5 flex h-4 w-4">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
              style={{ backgroundColor: dotColor }}
            />
            <span
              className="relative inline-flex h-4 w-4 rounded-full"
              style={{
                backgroundColor: dotColor,
                boxShadow: `0 0 12px 2px ${dotColor}60`,
              }}
            />
          </span>
          <h2 className="text-xl font-semibold text-white">
            {statusLabel}
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: colors.heroSubtext }}>
            Last updated: {lastUpdated}
          </p>
        </div>
      </div>

      {/* Header */}
      <div
        style={{
          backgroundColor: colors.headerBg,
          borderBottom: `1px solid ${colors.headerBorder}`,
        }}
      >
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div>
            <h1
              className="text-lg font-semibold leading-tight"
              style={{ color: colors.textPrimary }}
            >
              {statusPage.title}
            </h1>
            {statusPage.description && (
              <p
                className="mt-0.5 text-sm leading-snug"
                style={{ color: colors.textMuted }}
              >
                {statusPage.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Active Maintenance Banner */}
        {activeMaintenances.length > 0 && (
          <div className="mb-6 space-y-3">
            {activeMaintenances.map((m) => {
              const affectedNames = m.checks.map((mc) => mc.check.name);
              return (
                <div
                  key={m.id}
                  className="rounded-xl px-5 py-4"
                  style={{
                    backgroundColor: colors.maintenance.bg,
                    border: `1px solid ${colors.maintenance.border}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <Wrench
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ color: colors.maintenance.icon }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: colors.maintenance.title }}
                      >
                        {m.title}
                        {m.status === "SCHEDULED" && (
                          <span
                            className="ml-2 text-[11px] font-medium"
                            style={{ color: colors.maintenance.meta }}
                          >
                            Upcoming
                          </span>
                        )}
                      </p>
                      {m.description && (
                        <p
                          className="mt-1 text-sm"
                          style={{ color: colors.maintenance.body }}
                        >
                          {m.description}
                        </p>
                      )}
                      <p
                        className="mt-1.5 text-xs"
                        style={{ color: colors.maintenance.meta }}
                      >
                        {format(m.scheduledStart, "MMM d, HH:mm")} &rarr;{" "}
                        {format(m.scheduledEnd, "MMM d, HH:mm")}
                      </p>
                      {affectedNames.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {affectedNames.map((name) => (
                            <span
                              key={name}
                              className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor: colors.maintenance.tagBg,
                                color: colors.maintenance.tagText,
                              }}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Monitors */}
        <div className="space-y-4">
          {checksWithData.length === 0 ? (
            <div
              className="rounded-xl py-16 text-center"
              style={{
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
              }}
            >
              <p className="text-sm" style={{ color: colors.textSubtle }}>
                No monitors configured yet.
              </p>
            </div>
          ) : (
            checksWithData.map((check) => {
              const effectiveStatus = check.isUnderMaintenance
                ? "maintenance"
                : check.liveStatus;
              const badgeStyles = getMonitorBadgeStyles(effectiveStatus, theme);
              const badgeLabel = badgeStyles.label;
              const badgeDot = badgeStyles.dot;
              const badgeBg = badgeStyles.bg;
              const badgeBorder = badgeStyles.border;
              const badgeText = badgeStyles.text;

              return (
                <div
                  key={check.id}
                  className="rounded-xl"
                  style={{
                    backgroundColor: colors.cardBg,
                    border: `1px solid ${colors.cardBorder}`,
                  }}
                >
                  {/* Check header — stacks on mobile */}
                  <div className="px-5 pt-4 pb-1">
                    {/* Top row: badge + name */}
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{
                          backgroundColor: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          color: badgeText,
                        }}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: badgeDot }}
                        />
                        {badgeLabel}
                      </span>
                      <span
                        className="min-w-0 truncate text-sm font-semibold"
                        style={{ color: colors.textPrimary }}
                        title={check.name}
                      >
                        {check.name}
                      </span>
                    </div>
                    {/* Stats row — always below on mobile, inline on desktop */}
                    <div className="mt-1.5 flex items-center gap-4 sm:float-right sm:-mt-7">
                      {check.avgLatency !== null && (
                        <div>
                          <span
                            className="text-sm font-semibold tabular-nums"
                            style={{ color: colors.textSecondary }}
                          >
                            {check.avgLatency}
                          </span>
                          <span
                            className="ml-0.5 text-[11px]"
                            style={{ color: colors.textSubtle }}
                          >
                            ms
                          </span>
                        </div>
                      )}
                      {check.overallUptime !== null && (
                        <div>
                          <span
                            className="text-sm font-bold tabular-nums"
                            style={{
                              color: uptimeDisplayColor(
                                check.overallUptime,
                                theme,
                              ),
                            }}
                          >
                            {check.overallUptime.toFixed(2)}%
                          </span>
                          <span
                            className="ml-1 text-[11px]"
                            style={{ color: colors.textSubtle }}
                          >
                            uptime
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Uptime bars */}
                  <div className="px-5 pb-4 pt-2 clear-both">
                    <UptimeBars
                      days={check.days}
                      height={28}
                      showLabels
                      gap={1.5}
                      responsive
                      labelColor={colors.textSubtle}
                      barColors={barColors}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Legend */}
        {checksWithData.length > 0 && (
          <div className="mt-3 flex items-center justify-center gap-5">
            <span
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: colors.textSubtle }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: "#22c55e" }}
              />
              Operational
            </span>
            <span
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: colors.textSubtle }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: "#f59e0b" }}
              />
              Degraded
            </span>
            <span
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: colors.textSubtle }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: barColors.outage }}
              />
              Downtime
            </span>
            <span
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: colors.textSubtle }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: barColors.maintenance }}
              />
              Maintenance
            </span>
            <span
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: colors.textSubtle }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: barColors.nodata }}
              />
              No data
            </span>
          </div>
        )}

        {/* Past Incidents */}
        {allIncidents.length > 0 && (
          <PastIncidents
            incidentsByDate={incidentsByDate}
            colors={colors.incident}
          />
        )}

        {/* No incidents */}
        {allIncidents.length === 0 && checksWithData.length > 0 && (
          <section className="mt-10">
            <h2
              className="mb-4 text-sm font-semibold"
              style={{ color: colors.textPrimary }}
            >
              Past Incidents
            </h2>
            <div
              className="rounded-xl py-8 text-center"
              style={{
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
              }}
            >
              <CheckCircle
                className="mx-auto mb-2 h-5 w-5"
                style={{ color: "#22c55e" }}
              />
              <p className="text-sm" style={{ color: colors.textMuted }}>
                No incidents reported in the last 90 days
              </p>
            </div>
          </section>
        )}

        {/* Past Maintenance */}
        {pastMaintenances.length > 0 && (
          <section className="mt-10">
            <h2
              className="mb-4 text-sm font-semibold"
              style={{ color: colors.textPrimary }}
            >
              Past Maintenance
            </h2>
            <div
              className="rounded-xl"
              style={{
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.cardBorder}`,
              }}
            >
              {pastMaintenances.map((m, i) => (
                <div
                  key={m.id}
                  className="px-5 py-3.5"
                  style={{
                    borderTop: i > 0 ? `1px solid ${colors.divider}` : undefined,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <Wrench
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      style={{ color: colors.maintenance.icon }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p
                          className="text-sm font-medium"
                          style={{ color: colors.textPrimary }}
                        >
                          {m.title}
                        </p>
                        <span
                          className="shrink-0 text-xs tabular-nums"
                          style={{ color: colors.textSubtle }}
                        >
                          {format(m.scheduledStart, "MMM d, HH:mm")} →{" "}
                          {format(m.scheduledEnd, "MMM d, HH:mm")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {m.checks.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
                      {m.checks.map((mc) => (
                        <span
                          key={mc.check.id}
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: colors.tagBg,
                            color: colors.tagText,
                          }}
                        >
                          {mc.check.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${colors.footerBorder}` }}>
        <div className="mx-auto max-w-3xl px-6 py-6 text-center">
          <Link
            href="/"
            className="group inline-flex items-center justify-center gap-2 text-xs transition-opacity hover:opacity-80"
            style={{ color: colors.footerText }}
          >
            <span>Powered by Ghostwatch</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
