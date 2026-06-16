"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { RegionPicker } from "@/components/checks/region-picker";
import type { ProbeStatus } from "@/lib/probe-health";
import {
  buildCheckUrl,
  urlHasUnresolvedPathParams,
} from "@/lib/openapi-url";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

export interface PathParamField {
  name: string;
  value: string;
  required: boolean;
}

export interface DiscoverEndpoint {
  method: string;
  path: string;
  name: string;
  description: string;
  baseUrl: string;
  url: string;
  expectedStatus: number;
  selected: boolean;
  expanded: boolean;
  pathParams: PathParamField[];
  headers: string;
  body: string;
  /** Empty = use the import default regions. */
  regions: string[];
}

export function recomputeEndpointUrl(ep: DiscoverEndpoint): string {
  const params = Object.fromEntries(
    ep.pathParams.map((p) => [p.name, p.value]),
  );
  return buildCheckUrl(ep.baseUrl, ep.path, params);
}

type Props = {
  endpoint: DiscoverEndpoint;
  index: number;
  methodColors: Record<string, string>;
  defaultRegions: string[];
  probes: ProbeStatus[];
  selectableRegions: Array<{ id: string; label: string }>;
  singleRegion: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<DiscoverEndpoint>) => void;
  onPathParamChange: (paramName: string, value: string) => void;
};

export function DiscoverEndpointRow({
  endpoint: ep,
  methodColors,
  defaultRegions,
  probes,
  selectableRegions,
  singleRegion,
  onToggleSelect,
  onToggleExpand,
  onUpdate,
  onPathParamChange,
}: Props) {
  const unresolved = urlHasUnresolvedPathParams(ep.url);
  const showBody = METHODS_WITH_BODY.has(ep.method.toUpperCase());
  const effectiveRegions =
    ep.regions.length > 0 ? ep.regions : defaultRegions;
  const hasCustomRegions = ep.regions.length > 0;

  function toggleEndpointRegion(id: string) {
    const current = ep.regions.length > 0 ? ep.regions : defaultRegions;
    const next = current.includes(id)
      ? current.filter((r) => r !== id)
      : [...current, id];
    onUpdate({ regions: next });
  }

  return (
    <li
      className={`border-b border-gw-border last:border-b-0 ${
        unresolved && ep.selected ? "bg-amber-50/50" : ""
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3 sm:px-6">
        <input
          type="checkbox"
          checked={ep.selected}
          onChange={onToggleSelect}
          className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          aria-label={`Select ${ep.method} ${ep.path}`}
        />
        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-0.5 shrink-0 text-gw-fg-subtle hover:text-gw-fg-muted"
          aria-expanded={ep.expanded}
          aria-label={ep.expanded ? "Collapse" : "Expand to edit"}
        >
          {ep.expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <span
          className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold ${
            methodColors[ep.method.toUpperCase()] ||
            "bg-gw-surface-2 text-gw-fg-muted"
          }`}
        >
          {ep.method.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-all font-mono text-sm font-medium text-gw-fg">
            {ep.path}
          </p>
          {ep.description ? (
            <p
              className="mt-1 line-clamp-2 text-xs leading-relaxed text-gw-fg-muted"
              title={ep.description}
            >
              {ep.description}
            </p>
          ) : (
            <p className="mt-1 truncate text-xs text-gw-fg-subtle" title={ep.url}>
              {ep.url}
            </p>
          )}
          {unresolved && ep.selected && (
            <p className="mt-1 text-xs font-medium text-amber-700">
              Fill path parameters before import
            </p>
          )}
          {!singleRegion && effectiveRegions.length > 0 && (
            <p className="mt-1 text-xs text-gw-fg-subtle">
              {effectiveRegions.length} region
              {effectiveRegions.length !== 1 ? "s" : ""}
              {hasCustomRegions ? " (custom)" : ""}
            </p>
          )}
        </div>
      </div>

      {ep.expanded && (
        <div className="space-y-4 border-t border-gw-border bg-gw-surface-2/40 px-4 py-4 sm:px-6 sm:pl-[4.25rem]">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-gw-fg-muted">
                Monitor name
              </span>
              <input
                type="text"
                value={ep.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="w-full rounded-lg border border-gw-border bg-gw-surface px-3 py-2 text-sm text-gw-fg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-gw-fg-muted">
                Request URL
              </span>
              <input
                type="url"
                value={ep.url}
                onChange={(e) => onUpdate({ url: e.target.value })}
                className="w-full rounded-lg border border-gw-border bg-gw-surface px-3 py-2 font-mono text-sm text-gw-fg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gw-fg-muted">
                Expected status
              </span>
              <input
                type="number"
                min={100}
                max={599}
                value={ep.expectedStatus}
                onChange={(e) =>
                  onUpdate({
                    expectedStatus: parseInt(e.target.value, 10) || 200,
                  })
                }
                className="w-full rounded-lg border border-gw-border bg-gw-surface px-3 py-2 text-sm text-gw-fg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </label>
          </div>

          {!singleRegion && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-gw-fg-muted">
                  Probe regions
                </p>
                {hasCustomRegions ? (
                  <button
                    type="button"
                    onClick={() => onUpdate({ regions: [] })}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    Use import default
                  </button>
                ) : null}
              </div>
              <RegionPicker
                probes={probes}
                selectableRegions={selectableRegions}
                selected={effectiveRegions}
                onToggle={toggleEndpointRegion}
              />
            </div>
          )}

          {ep.pathParams.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-gw-fg-muted">
                Path parameters
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {ep.pathParams.map((param) => (
                  <label key={param.name} className="block">
                    <span className="mb-1 flex items-center gap-1 font-mono text-xs text-gw-fg-muted">
                      {`{${param.name}}`}
                      {param.required && (
                        <span className="text-red-500">*</span>
                      )}
                    </span>
                    <input
                      type="text"
                      value={param.value}
                      placeholder={`Value for ${param.name}`}
                      onChange={(e) =>
                        onPathParamChange(param.name, e.target.value)
                      }
                      className="w-full rounded-lg border border-gw-border bg-gw-surface px-3 py-2 font-mono text-sm text-gw-fg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gw-fg-muted">
              Headers (JSON)
            </span>
            <textarea
              rows={3}
              value={ep.headers}
              onChange={(e) => onUpdate({ headers: e.target.value })}
              placeholder='{"Authorization": "Bearer YOUR_TOKEN"}'
              className="w-full rounded-lg border border-gw-border bg-gw-surface px-3 py-2 font-mono text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </label>

          {showBody && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gw-fg-muted">
                Request body
              </span>
              <textarea
                rows={4}
                value={ep.body}
                onChange={(e) => onUpdate({ body: e.target.value })}
                placeholder='{"key": "value"}'
                className="w-full rounded-lg border border-gw-border bg-gw-surface px-3 py-2 font-mono text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </label>
          )}
        </div>
      )}
    </li>
  );
}
