"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  PauseCircle,
  XCircle,
} from "lucide-react";

import { dashboardLinkClass, uptimePercentClass } from "@/lib/uptime-colors";
import { listDivide, listRow, panel } from "@/lib/theme-classes";

export type DashboardMonitorRow = {
  id: string;
  name: string;
  status: "passing" | "failing" | "paused" | "unknown";
  uptime: number | null;
  displayLatency: number | null;
  totalRuns: number;
  latestAt: string | null;
};

export type DashboardActivityRow = {
  id: string;
  checkId: string;
  checkName: string;
  success: boolean;
  status: string | null;
  regionLabel: string | null;
  responseTime: number | null;
  createdAt: string;
};

type Props = {
  monitors: DashboardMonitorRow[];
  activity: DashboardActivityRow[];
};

const ROW_CLASS = `flex items-center gap-3 px-5 py-3 ${listRow}`;
const BOTTOM_PADDING_PX = 32;

export function DashboardViewportLists({ monitors, activity }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const headerMeasureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.max(1, Math.min(6, Math.max(monitors.length, activity.length, 1))),
  );

  const monitorSample = monitors[0] ?? {
    id: "measure",
    name: "Sample monitor",
    status: "passing" as const,
    uptime: 99.9,
    displayLatency: 100,
    totalRuns: 1,
    latestAt: new Date().toISOString(),
  };

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const measureRow = measureRef.current;
    const headerMeasure = headerMeasureRef.current;
    if (!grid || !measureRow) return;

    const update = () => {
      const rowHeight = measureRow.getBoundingClientRect().height;
      const headerHeight = headerMeasure?.getBoundingClientRect().height ?? 0;
      if (rowHeight < 1) return;

      const gridTop = grid.getBoundingClientRect().top;
      const listAreaHeight =
        window.innerHeight - gridTop - headerHeight - BOTTOM_PADDING_PX;
      const maxData = Math.max(monitors.length, activity.length, 1);
      const count = Math.max(
        1,
        Math.min(Math.floor(listAreaHeight / rowHeight), maxData),
      );
      setVisibleCount(count);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(grid);
    ro.observe(measureRow);
    if (headerMeasure) ro.observe(headerMeasure);

    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [monitors.length, activity.length]);

  const visibleMonitors = monitors.slice(0, visibleCount);
  const visibleActivity = activity.slice(0, visibleCount);

  return (
    <div ref={gridRef} className="relative grid min-h-0 flex-1 gap-6 xl:grid-cols-5">
      <div
        ref={headerMeasureRef}
        className="pointer-events-none invisible absolute -left-[9999px] top-0 -z-10"
        aria-hidden
      >
        <div className="border-b border-gw-border px-5 py-4">
          <h2 className="text-sm font-semibold">Monitor status</h2>
          <p className="mt-0.5 text-xs">Subtitle</p>
        </div>
      </div>

      <div
        ref={measureRef}
        className="pointer-events-none invisible absolute -left-[9999px] top-0 -z-10 w-full max-w-3xl"
        aria-hidden
      >
        <div className={ROW_CLASS}>
          <MonitorRowContent row={monitorSample} />
        </div>
      </div>

      <div className={`${panel} flex min-h-0 flex-col xl:col-span-3`}>
        <div className="flex shrink-0 items-center justify-between border-b border-gw-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gw-fg">Monitor status</h2>
            <p className="mt-0.5 text-xs text-gw-fg-subtle">
              {monitors.length === 0
                ? "Live state of every monitor"
                : visibleMonitors.length < monitors.length
                  ? `Showing ${visibleMonitors.length} of ${monitors.length} monitors`
                  : `${monitors.length} monitor${monitors.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Link
            href="/checks"
            className={`inline-flex items-center gap-1 text-xs font-medium ${dashboardLinkClass}`}
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {monitors.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gw-fg-subtle">
            No monitors yet.{" "}
            <Link
              href="/checks/new"
              className={`${dashboardLinkClass} hover:underline`}
            >
              Create one
            </Link>
          </div>
        ) : (
          <div className={listDivide}>
            {visibleMonitors.map((row) => (
              <Link
                key={row.id}
                href={`/checks/${row.id}`}
                className={`${ROW_CLASS} transition-colors hover:bg-gw-surface-hover`}
              >
                <MonitorRowContent row={row} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className={`${panel} flex min-h-0 flex-col xl:col-span-2`}>
        <div className="shrink-0 border-b border-gw-border px-5 py-4">
          <h2 className="text-sm font-semibold text-gw-fg">Recent activity</h2>
          <p className="mt-0.5 text-xs text-gw-fg-subtle">
            {activity.length === 0
              ? "Latest probe results"
              : visibleActivity.length < activity.length
                ? `Showing ${visibleActivity.length} of ${activity.length} results`
                : `${visibleActivity.length} recent result${visibleActivity.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {activity.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gw-fg-subtle">
            No check runs yet.
          </div>
        ) : (
          <div className={listDivide}>
            {visibleActivity.map((row) => (
              <Link
                key={row.id}
                href={`/checks/${row.checkId}`}
                className={`${ROW_CLASS} transition-colors hover:bg-gw-surface-hover`}
              >
                <ActivityRowContent row={row} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MonitorRowContent({ row }: { row: DashboardMonitorRow }) {
  const latestAt = row.latestAt ? new Date(row.latestAt) : null;

  return (
    <>
      <StatusDot status={row.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gw-fg">{row.name}</p>
        <p className="mt-0.5 text-[11px] text-gw-fg-subtle">
          {latestAt
            ? `Last run ${formatDistanceToNow(latestAt, { addSuffix: true })}`
            : "No runs yet"}
          {row.totalRuns > 0
            ? ` · ${row.totalRuns.toLocaleString()} runs`
            : ""}
        </p>
      </div>
      {row.uptime !== null && (
        <span
          className={`shrink-0 text-xs font-semibold tabular-nums ${uptimePercentClass(row.uptime)}`}
        >
          {row.uptime}%
        </span>
      )}
      {row.displayLatency != null && (
        <span className="hidden w-14 shrink-0 text-right text-xs tabular-nums text-gw-fg-muted sm:block">
          {row.displayLatency}ms
        </span>
      )}
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gw-fg-subtle" />
    </>
  );
}

function ActivityRowContent({ row }: { row: DashboardActivityRow }) {
  const createdAt = new Date(row.createdAt);

  return (
    <>
      {row.success ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-red-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gw-fg">
          {row.checkName}
        </p>
        <p className="mt-0.5 text-[11px] text-gw-fg-subtle">
          {row.status ?? "—"}
          {row.regionLabel ? ` · ${row.regionLabel}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-gw-fg-muted">
        {row.responseTime != null ? `${row.responseTime}ms` : "—"}
      </span>
      <span className="w-16 shrink-0 text-right text-[11px] text-gw-fg-subtle">
        {formatDistanceToNow(createdAt, { addSuffix: true })}
      </span>
    </>
  );
}

function StatusDot({
  status,
}: {
  status: DashboardMonitorRow["status"];
}) {
  if (status === "paused") {
    return <PauseCircle className="h-4 w-4 shrink-0 text-amber-500" />;
  }
  if (status === "failing") {
    return <XCircle className="h-4 w-4 shrink-0 text-red-500" />;
  }
  if (status === "unknown") {
    return (
      <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-gray-300" />
    );
  }
  return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />;
}
