"use client";

import type { ProbeStatus } from "@/lib/probe-health";

type RegionOption = {
  id: string;
  label: string;
  healthy: boolean;
  error?: string | null;
};

type RegionPickerProps = {
  probes: ProbeStatus[];
  selectableRegions: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  singleRegion?: boolean;
};

export function RegionPicker({
  probes,
  selectableRegions,
  selected,
  onToggle,
  singleRegion = false,
}: RegionPickerProps) {
  const options: RegionOption[] =
    probes.length > 0
      ? probes.map((p) => ({
          id: p.id,
          label: p.label,
          healthy: p.status === "healthy",
          error: p.error,
        }))
      : selectableRegions.map((r) => ({
          id: r.id,
          label: r.label,
          healthy: true,
          error: null,
        }));

  if (singleRegion && options[0]) {
    const region = options[0];
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gw-border bg-gw-surface-2 px-4 py-3 text-sm text-gw-fg-muted">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            region.healthy ? "bg-emerald-500" : "bg-red-500"
          }`}
        />
        Checks run from{" "}
        <span className="font-medium text-gw-fg">{region.label}</span>
        {!region.healthy && region.error ? (
          <span className="text-red-600 dark:text-red-400"> — {region.error}</span>
        ) : null}
      </div>
    );
  }

  const healthyCount = options.filter((o) => o.healthy).length;

  return (
    <div className="space-y-3">
      {healthyCount === 0 ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          No probe regions are available. Check workers and PROBE_ENDPOINTS on
          the hub, then refresh the dashboard.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((region) => {
          const isSelected = selected.includes(region.id);
          const disabled = !region.healthy;
          return (
            <button
              key={region.id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onToggle(region.id)}
              title={
                disabled
                  ? region.error ?? "Probe unavailable"
                  : undefined
              }
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                disabled
                  ? "cursor-not-allowed border-gw-border bg-gw-surface-2 text-gw-fg-subtle opacity-60"
                  : isSelected
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "border-gw-border bg-gw-surface text-gw-fg-muted hover:border-gray-300 hover:bg-gw-surface-hover"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                  disabled
                    ? "border-gray-300 bg-gw-surface-2"
                    : isSelected
                      ? "border-indigo-600 bg-indigo-600"
                      : "border-gray-300 bg-gw-surface"
                }`}
              >
                {isSelected && !disabled ? (
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${
                      region.healthy ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                  {region.label}
                </span>
                {disabled && region.error ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-red-600 dark:text-red-400">
                    Unavailable
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
