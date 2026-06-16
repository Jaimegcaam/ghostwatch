"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type { ProbeStatus } from "@/lib/probe-health";
import { panel } from "@/lib/theme-classes";

type Props = {
  initialProbes: ProbeStatus[];
  checkedAt: string | null;
  compact?: boolean;
};

export function ProbeStatusPanel({
  initialProbes,
  checkedAt,
  compact = false,
}: Props) {
  const [probes, setProbes] = useState(initialProbes);
  const [lastChecked, setLastChecked] = useState(checkedAt);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/probes/status?refresh=true");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.probes)) {
        setProbes(data.probes);
        setLastChecked(data.checkedAt ?? null);
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => refresh(true), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (probes.length === 0) return null;

  if (compact) {
    return (
      <div className={`${panel} flex h-full flex-col`}>
        <div className="flex items-center justify-between gap-2 border-b border-gw-border px-3 py-2">
          <h2 className="text-xs font-semibold text-gw-fg">Probe regions</h2>
          <button
            type="button"
            onClick={() => refresh(false)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-gw-border px-1.5 py-0.5 text-[10px] font-medium text-gw-fg-muted hover:bg-gw-surface-hover disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </button>
        </div>
        <ul className="flex flex-1 flex-col justify-center divide-y divide-gw-border">
          {probes.map((probe) => (
            <li
              key={probe.id}
              className="flex items-center gap-2 px-3 py-2"
            >
              <ProbeIcon status={probe.status} kind={probe.kind} compact />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-gw-fg">
                  {probe.label}
                </p>
                <p className="truncate text-[10px] text-gw-fg-subtle">
                  {probe.error
                    ? probe.error
                    : probe.responseTimeMs != null && probe.kind === "remote"
                      ? `${probe.responseTimeMs}ms`
                      : probe.id}
                </p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-medium capitalize ${
                  probe.status === "healthy"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {probe.status}
              </span>
            </li>
          ))}
        </ul>
        {lastChecked ? (
          <p className="border-t border-gw-border px-3 py-1 text-[10px] text-gw-fg-subtle">
            {formatDistanceToNow(new Date(lastChecked), { addSuffix: true })}
          </p>
        ) : null}
      </div>
    );
  }

  const healthyCount = probes.filter((p) => p.status === "healthy").length;
  const allHealthy = healthyCount === probes.length;

  return (
    <div className={panel}>
      <div className="flex items-start justify-between gap-3 border-b border-gw-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gw-fg">Probe regions</h2>
          <p className="mt-0.5 text-xs text-gw-fg-subtle">
            {allHealthy
              ? `${probes.length} region${probes.length === 1 ? "" : "s"} healthy`
              : `${healthyCount} of ${probes.length} healthy`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh(false)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gw-border bg-gw-surface px-2.5 py-1.5 text-xs font-medium text-gw-fg-muted transition-colors hover:bg-gw-surface-hover disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      <ul className="divide-y divide-gw-border">
        {probes.map((probe) => (
          <li
            key={probe.id}
            className="flex items-start gap-3 px-5 py-3.5"
          >
            <ProbeIcon status={probe.status} kind={probe.kind} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-gw-fg">{probe.label}</p>
                <span className="rounded-full bg-gw-surface-2 px-2 py-0.5 font-mono text-[10px] text-gw-fg-subtle">
                  {probe.id}
                </span>
              </div>
              {probe.error ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {probe.error}
                </p>
              ) : probe.responseTimeMs != null && probe.kind === "remote" ? (
                <p className="mt-1 text-xs text-gw-fg-subtle">
                  Health check {probe.responseTimeMs}ms
                </p>
              ) : null}
            </div>
            <span
              className={`shrink-0 text-xs font-medium capitalize ${
                probe.status === "healthy"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {probe.status}
            </span>
          </li>
        ))}
      </ul>

      {lastChecked && (
        <p className="border-t border-gw-border px-5 py-2 text-[11px] text-gw-fg-subtle">
          Last checked{" "}
          {formatDistanceToNow(new Date(lastChecked), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

function ProbeIcon({
  status,
  kind,
  compact = false,
}: {
  status: ProbeStatus["status"];
  kind: ProbeStatus["kind"];
  compact?: boolean;
}) {
  const size = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  if (kind === "misconfigured") {
    return (
      <AlertTriangle className={`${size} shrink-0 text-amber-500`} />
    );
  }
  if (status === "healthy") {
    return (
      <CheckCircle2 className={`${size} shrink-0 text-emerald-500`} />
    );
  }
  return <XCircle className={`${size} shrink-0 text-red-500`} />;
}
