"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Globe,
  Lock,
} from "lucide-react";
import { ResponseChartsPanel } from "@/components/checks/response-chart";
import { CompactPagination } from "@/components/ui/compact-pagination";
import { computeDisplayLatency } from "@/lib/display-latency";
import {
  dangerAlertBodyClass,
  dangerAlertClass,
  dangerAlertTitleClass,
  dangerFilledButtonClass,
  dangerIconClass,
  dangerOutlineButtonClass,
  uptimePercentClass,
  uptimeStrokeClass,
} from "@/lib/uptime-colors";

const RESULTS_PAGE_SIZE = 10;

interface CheckInfo {
  id: string;
  name: string;
  url: string;
  method: string;
  enabled: boolean;
  expectedStatus: number;
  timeout: number;
  interval: number;
  intervalLabel: string;
  headers: Record<string, string> | null;
  body: string | null;
  regions: string[];
  isPublic: boolean;
}

interface ResultRow {
  id: string;
  status: number | null;
  responseTime: number | null;
  success: boolean;
  error: string | null;
  region: string;
  isAnomaly: boolean;
  createdAt: string;
}

interface ChartPoint {
  chartKey: string;
  at: number;
  time: string;
  responseTime: number;
  success: boolean;
  region: string;
}

interface LatencyProbeRow {
  success: boolean;
  responseTime: number | null;
  createdAt: string;
  region: string;
}

interface CheckDetailClientProps {
  check: CheckInfo;
  uptime: number;
  chartData: ChartPoint[];
  latencyProbes: LatencyProbeRow[];
  results: ResultRow[];
  regionLabels: Record<string, string>;
}

export function CheckDetailClient({
  check,
  uptime,
  chartData,
  latencyProbes,
  results,
  regionLabels: initialRegionLabels,
}: CheckDetailClientProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [resultsPage, setResultsPage] = useState(0);
  const [regionLabels, setRegionLabels] =
    useState<Record<string, string>>(initialRegionLabels);

  const regionLabel = (id: string) => regionLabels[id] ?? id;

  useEffect(() => {
    fetch("/api/instance")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.regions)) return;
        const map: Record<string, string> = {};
        for (const region of data.regions as { id: string; label: string }[]) {
          map[region.id] = region.label;
        }
        setRegionLabels(map);
      })
      .catch(() => {});
  }, []);

  const allRegions = useMemo(() => {
    const set = new Set(check.regions);
    for (const r of results) set.add(r.region);
    return Array.from(set);
  }, [check.regions, results]);

  const filteredResults = useMemo(
    () =>
      activeRegion
        ? results.filter((r) => r.region === activeRegion)
        : results,
    [activeRegion, results],
  );

  useEffect(() => {
    setResultsPage(0);
  }, [activeRegion]);

  const resultsTotalPages = Math.max(
    1,
    Math.ceil(filteredResults.length / RESULTS_PAGE_SIZE),
  );

  const paginatedResults = useMemo(() => {
    const start = resultsPage * RESULTS_PAGE_SIZE;
    return filteredResults.slice(start, start + RESULTS_PAGE_SIZE);
  }, [filteredResults, resultsPage]);

  const resultsRangeStart =
    filteredResults.length === 0 ? 0 : resultsPage * RESULTS_PAGE_SIZE + 1;
  const resultsRangeEnd = Math.min(
    (resultsPage + 1) * RESULTS_PAGE_SIZE,
    filteredResults.length,
  );

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/checks/${check.id}`, { method: "DELETE" });
      if (res.ok) router.push("/checks");
    } catch {
      setDeleting(false);
    }
  }

  async function handleToggleEnabled() {
    await fetch(`/api/checks/${check.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !check.enabled }),
    });
    router.refresh();
  }

  const uptimeColor = uptimePercentClass(uptime);
  const uptimeRingColor = uptimeStrokeClass(uptime);

  const circumference = 2 * Math.PI * 20;
  const uptimeOffset = circumference - (uptime / 100) * circumference;

  const uptimeLabel =
    Number.isInteger(uptime) ? String(uptime) : uptime.toFixed(2);
  const uptimeTextClass =
    uptimeLabel.length >= 5
      ? "text-[10px] leading-none"
      : uptimeLabel.length >= 4
        ? "text-[11px] leading-none"
        : "text-sm";

  const avgResponseTime = useMemo(() => {
    const probes = activeRegion
      ? latencyProbes.filter((r) => r.region === activeRegion)
      : latencyProbes;
    const regions = activeRegion ? [activeRegion] : allRegions;
    return computeDisplayLatency(probes, regions);
  }, [latencyProbes, activeRegion, allRegions]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/checks"
        className="inline-flex items-center gap-1.5 text-sm text-gw-fg-subtle transition-colors hover:text-gw-fg-muted"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to monitors
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-gw-fg sm:text-2xl">
              {check.name}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                check.enabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gw-surface-2 text-gw-fg-muted"
              }`}
            >
              {check.enabled ? "Active" : "Paused"}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                check.isPublic
                  ? "bg-indigo-50 text-indigo-600"
                  : "bg-gw-surface-2 text-gw-fg-muted"
              }`}
            >
              {check.isPublic ? (
                <Globe className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {check.isPublic ? "Public" : "Private"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gw-fg-muted">
            <span className="inline-flex items-center rounded-md bg-gw-surface-2 px-2 py-0.5 text-[11px] font-medium text-gw-fg-muted">
              {check.method}
            </span>
            <a
              href={check.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-1 text-gw-fg-subtle transition-colors hover:text-indigo-600"
            >
              <span className="truncate">{check.url}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={handleToggleEnabled}
            className="rounded-lg border border-gw-border bg-gw-surface px-3 py-1.5 text-sm font-medium text-gw-fg-muted shadow-sm transition-all hover:bg-gw-surface-hover"
          >
            {check.enabled ? "Pause" : "Resume"}
          </button>
          <Link
            href={`/checks/${check.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gw-border bg-gw-surface px-3 py-1.5 text-sm font-medium text-gw-fg-muted shadow-sm transition-all hover:bg-gw-surface-hover"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm ${dangerOutlineButtonClass}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className={`rounded-2xl p-5 ${dangerAlertClass}`}>
          <div className="flex items-center gap-4">
            <AlertTriangle className={`h-5 w-5 shrink-0 ${dangerIconClass}`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${dangerAlertTitleClass}`}>
                Delete this monitor?
              </p>
              <p className={`mt-0.5 text-sm ${dangerAlertBodyClass}`}>
                All results and history will be permanently removed.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl border border-gw-border bg-gw-surface px-3 py-1.5 text-sm font-medium text-gw-fg-muted shadow-sm hover:bg-gw-surface-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium shadow-sm disabled:opacity-50 ${dangerFilledButtonClass}`}
              >
                {deleting && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="overflow-hidden rounded-xl border border-gw-border bg-gw-surface shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-gw-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="relative h-14 w-14 shrink-0">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  className="text-gw-border"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  className={uptimeRingColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={uptimeOffset}
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center px-1">
                <span
                  className={`font-semibold tabular-nums ${uptimeTextClass} ${uptimeColor}`}
                >
                  {uptimeLabel}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gw-fg-subtle">
                Uptime
              </p>
              <p className="text-xs text-gw-fg-muted">Overall availability</p>
            </div>
          </div>

          <div className="px-4 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gw-fg-subtle">
              Avg response
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-gw-fg">
              {avgResponseTime !== null ? `${avgResponseTime}ms` : "—"}
            </p>
          </div>

          <div className="px-4 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gw-fg-subtle">
              Interval
            </p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight text-gw-fg">
              {check.intervalLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Region filter */}
      {allRegions.length > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-gw-fg-subtle">
            Region
          </p>
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-gw-surface-2 p-1">
            <button
              type="button"
              onClick={() => setActiveRegion(null)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                activeRegion === null
                  ? "bg-gw-surface text-gw-fg shadow-sm"
                  : "text-gw-fg-muted hover:text-gw-fg"
              }`}
            >
              All
            </button>
            {allRegions.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setActiveRegion(region)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  activeRegion === region
                    ? "bg-gw-surface text-gw-fg shadow-sm"
                    : "text-gw-fg-muted hover:text-gw-fg"
                }`}
              >
                {regionLabel(region)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Response Time Chart */}
      <div className="rounded-xl border border-gw-border bg-gw-surface p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-gw-fg">Response time</h2>
          <span className="text-xs text-gw-fg-subtle">Last hour</span>
        </div>
        <ResponseChartsPanel
          data={chartData}
          regions={allRegions}
          regionLabels={regionLabels}
          activeRegion={activeRegion}
        />
      </div>

      {/* Results History */}
      <div className="rounded-xl border border-gw-border bg-gw-surface shadow-sm">
        <div className="border-b border-gw-border px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-semibold text-gw-fg">Results history</h2>
          <p className="mt-0.5 text-xs text-gw-fg-subtle">
            {filteredResults.length === 0
              ? "No results yet"
              : `Showing ${resultsRangeStart}–${resultsRangeEnd} of ${filteredResults.length}`}
            {activeRegion ? ` · ${regionLabel(activeRegion)}` : ""}
          </p>
        </div>
        {filteredResults.length === 0 ? (
          <div className="px-4 pb-6 pt-2 text-center text-sm text-gw-fg-subtle sm:px-5">
            No results yet. Results will appear here once the monitor runs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-gw-border text-left">
                  <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-gw-fg-subtle sm:px-5">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-gw-fg-subtle sm:px-5">
                    Code
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-gw-fg-subtle sm:px-5">
                    Response
                  </th>
                  {allRegions.length > 1 && (
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-gw-fg-subtle sm:px-5">
                      Region
                    </th>
                  )}
                  <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-gw-fg-subtle sm:px-5">
                    Time
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-gw-fg-subtle sm:px-5">
                    Flags
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gw-border/60">
                {paginatedResults.map((result) => (
                  <tr
                    key={result.id}
                    className="transition-colors hover:bg-gw-surface-hover"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 sm:px-5">
                      {result.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-gw-fg-muted sm:px-5">
                      {result.status ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-gw-fg-muted sm:px-5">
                      {result.responseTime != null
                        ? `${result.responseTime}ms`
                        : "—"}
                    </td>
                    {allRegions.length > 1 && (
                      <td className="whitespace-nowrap px-4 py-2.5 sm:px-5">
                        <span className="inline-flex items-center rounded-md bg-gw-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-gw-fg-muted">
                          {regionLabel(result.region)}
                        </span>
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gw-fg-subtle sm:px-5">
                      {formatDistanceToNow(new Date(result.createdAt), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 sm:px-5">
                      {result.isAnomaly && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          Anomaly
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filteredResults.length > RESULTS_PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-gw-border px-4 py-2.5 sm:px-5">
            <p className="text-[11px] text-gw-fg-subtle">
              Page {resultsPage + 1} of {resultsTotalPages}
            </p>
            <CompactPagination
              page={resultsPage}
              totalPages={resultsTotalPages}
              onPageChange={setResultsPage}
            />
          </div>
        )}
      </div>

      {/* Configuration */}
      <div className="rounded-xl border border-gw-border bg-gw-surface shadow-sm">
        <div className="border-b border-gw-border px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-semibold text-gw-fg">Configuration</h2>
        </div>
        <dl className="divide-y divide-gw-border/60">
          {[
            { label: "Method", value: check.method },
            { label: "URL", value: check.url, breakAll: true },
            { label: "Expected Status", value: String(check.expectedStatus) },
            { label: "Timeout", value: `${check.timeout / 1000}s` },
            { label: "Interval", value: check.intervalLabel },
            {
              label: "Regions",
              value: check.regions.map((r) => regionLabel(r)).join(", "),
            },
            {
              label: "Visibility",
              value: check.isPublic ? "Public" : "Private",
            },
          ].map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-3 sm:gap-4 sm:px-5"
            >
              <dt className="text-xs font-medium text-gw-fg-subtle sm:text-sm">
                {row.label}
              </dt>
              <dd
                className={`text-sm text-gw-fg sm:col-span-2 ${
                  row.breakAll ? "break-all" : ""
                }`}
              >
                {row.value}
              </dd>
            </div>
          ))}
          {check.headers && Object.keys(check.headers).length > 0 && (
            <div className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-3 sm:gap-4 sm:px-5">
              <dt className="text-xs font-medium text-gw-fg-subtle sm:text-sm">Headers</dt>
              <dd className="sm:col-span-2">
                <pre className="overflow-x-auto rounded-lg bg-gw-surface-2 p-3 text-xs text-gw-fg-muted">
                  {JSON.stringify(check.headers, null, 2)}
                </pre>
              </dd>
            </div>
          )}
          {check.body && (
            <div className="grid grid-cols-1 gap-1 px-4 py-2.5 sm:grid-cols-3 sm:gap-4 sm:px-5">
              <dt className="text-xs font-medium text-gw-fg-subtle sm:text-sm">Body</dt>
              <dd className="sm:col-span-2">
                <pre className="overflow-x-auto rounded-lg bg-gw-surface-2 p-3 text-xs text-gw-fg-muted">
                  {check.body}
                </pre>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
