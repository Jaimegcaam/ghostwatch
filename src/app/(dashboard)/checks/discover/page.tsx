"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Loader2,
  CheckCircle2,
  Import,
} from "lucide-react";
import { useTeam } from "@/components/dashboard/team-context";
import { RegionPicker } from "@/components/checks/region-picker";
import {
  DiscoverEndpointRow,
  recomputeEndpointUrl,
  type DiscoverEndpoint,
} from "@/components/checks/discover-endpoint-row";
import type { CheckSuggestion } from "@/lib/discovery";
import { normalizeFolder } from "@/lib/check-folders";
import { urlHasUnresolvedPathParams } from "@/lib/openapi-url";
import type { ProbeStatus } from "@/lib/probe-health";

type Region = { id: string; label: string };

function suggestionToEndpoint(s: CheckSuggestion): DiscoverEndpoint {
  const pathParams = (s.pathParams ?? []).map((p) => ({
    name: p.name,
    value: p.defaultValue ?? "",
    required: p.required,
  }));

  const ep: DiscoverEndpoint = {
    method: s.method,
    path: s.path,
    name: s.name,
    description: s.description ?? "",
    baseUrl: s.baseUrl,
    url: s.url,
    expectedStatus: s.expectedStatus ?? (s.method === "POST" ? 201 : 200),
    selected: true,
    expanded: false,
    pathParams,
    headers: "",
    body: "",
    regions: [],
  };
  return { ...ep, url: recomputeEndpointUrl(ep) };
}

function parseHeadersJson(raw: string): Record<string, string> | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = JSON.parse(trimmed) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Headers must be a JSON object");
  }
  return parsed as Record<string, string>;
}

export default function DiscoverPage() {
  const router = useRouter();
  const { teamId } = useTeam();

  const [specUrl, setSpecUrl] = useState("");
  const [endpoints, setEndpoints] = useState<DiscoverEndpoint[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importProgress, setImportProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [importComplete, setImportComplete] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [importFolder, setImportFolder] = useState("");
  const [importRegions, setImportRegions] = useState<string[]>([]);
  const [probes, setProbes] = useState<ProbeStatus[]>([]);
  const [selectableRegions, setSelectableRegions] = useState<Region[]>([]);
  const [singleRegion, setSingleRegion] = useState(false);

  useEffect(() => {
    fetch("/api/instance")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const selectable: Region[] = Array.isArray(data.selectableRegions)
          ? data.selectableRegions
          : Array.isArray(data.regions)
            ? data.regions
            : [];
        setSelectableRegions(selectable);
        setProbes(Array.isArray(data.probes) ? data.probes : []);
        setSingleRegion(Boolean(data.singleRegion));
        const fallback = selectable[0]?.id ?? "local";
        const preferred = data.defaultRegion ?? fallback;
        const defaultPick = selectable.some((r) => r.id === preferred)
          ? preferred
          : fallback;
        setImportRegions(defaultPick ? [defaultPick] : []);
      })
      .catch(() => {
        setSelectableRegions([{ id: "local", label: "This server" }]);
        setImportRegions(["local"]);
        setSingleRegion(true);
      });
  }, []);

  function toggleImportRegion(id: string) {
    setImportRegions((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  async function fetchProjectId(): Promise<string | null> {
    if (projectId) return projectId;
    try {
      const res = await fetch(`/api/projects?teamId=${teamId}`);
      const projects = await res.json();
      if (!projects.length) {
        setError("No project found. Please create a project first.");
        return null;
      }
      setProjectId(projects[0].id);
      return projects[0].id;
    } catch {
      setError("Failed to fetch projects");
      return null;
    }
  }

  function updateEndpoint(index: number, patch: Partial<DiscoverEndpoint>) {
    setEndpoints((prev) =>
      prev.map((ep, i) => {
        if (i !== index) return ep;
        const next = { ...ep, ...patch };
        if (patch.pathParams !== undefined) {
          return { ...next, url: recomputeEndpointUrl(next) };
        }
        return next;
      }),
    );
  }

  function updatePathParam(index: number, paramName: string, value: string) {
    setEndpoints((prev) =>
      prev.map((ep, i) => {
        if (i !== index) return ep;
        const pathParams = ep.pathParams.map((p) =>
          p.name === paramName ? { ...p, value } : p,
        );
        const next = { ...ep, pathParams };
        return { ...next, url: recomputeEndpointUrl(next) };
      }),
    );
  }

  async function handleDiscover() {
    if (!specUrl.trim()) {
      setError("Please enter a URL");
      return;
    }

    setDiscovering(true);
    setError("");
    setEndpoints([]);
    setImportComplete(false);

    try {
      const pid = await fetchProjectId();
      if (!pid) {
        setDiscovering(false);
        return;
      }

      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specUrl: specUrl.trim(), projectId: pid }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to discover endpoints");
        setDiscovering(false);
        return;
      }

      const data = await res.json();
      const suggestions: CheckSuggestion[] = data.suggestions || [];

      if (suggestions.length === 0) {
        setError("No endpoints found in the specification");
      }

      setEndpoints(suggestions.map(suggestionToEndpoint));
    } catch {
      setError("Failed to fetch the specification");
    } finally {
      setDiscovering(false);
    }
  }

  function toggleEndpoint(index: number) {
    setEndpoints((prev) =>
      prev.map((ep, i) =>
        i === index ? { ...ep, selected: !ep.selected } : ep,
      ),
    );
  }

  function toggleExpand(index: number) {
    setEndpoints((prev) =>
      prev.map((ep, i) =>
        i === index ? { ...ep, expanded: !ep.expanded } : ep,
      ),
    );
  }

  function toggleAll(selected: boolean) {
    setEndpoints((prev) => prev.map((ep) => ({ ...ep, selected })));
  }

  function expandAll() {
    setEndpoints((prev) => prev.map((ep) => ({ ...ep, expanded: true })));
  }

  async function handleImport() {
    const selected = endpoints.filter((ep) => ep.selected);
    if (selected.length === 0) return;

    if (importRegions.length === 0) {
      setError("Select at least one probe region before importing.");
      return;
    }

    const unresolved = selected.filter((ep) =>
      urlHasUnresolvedPathParams(ep.url),
    );
    if (unresolved.length > 0) {
      setError(
        `Resolve path parameters for ${unresolved.length} endpoint(s) before importing (expand and fill {param} values).`,
      );
      setEndpoints((prev) =>
        prev.map((ep) =>
          unresolved.some((u) => u.path === ep.path && u.method === ep.method)
            ? { ...ep, expanded: true, selected: true }
            : ep,
        ),
      );
      return;
    }

    setImporting(true);
    setError("");
    setImportProgress({ done: 0, total: selected.length });

    try {
      const pid = await fetchProjectId();
      if (!pid) {
        setImporting(false);
        return;
      }

      let failed = 0;
      const folder = normalizeFolder(importFolder);

      for (let i = 0; i < selected.length; i++) {
        const ep = selected[i];
        const regions =
          ep.regions.length > 0 ? ep.regions : importRegions;
        if (regions.length === 0) {
          setError(
            `Select at least one region for ${ep.method} ${ep.path} before importing.`,
          );
          setImporting(false);
          return;
        }

        let parsedHeaders: Record<string, string> | undefined;
        try {
          parsedHeaders = parseHeadersJson(ep.headers);
        } catch {
          setError(`Invalid headers JSON for ${ep.method} ${ep.path}`);
          setImporting(false);
          return;
        }

        const res = await fetch("/api/checks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: ep.name.trim() || `${ep.method} ${ep.path}`,
            url: ep.url.trim(),
            method: ep.method.toUpperCase(),
            expectedStatus: ep.expectedStatus,
            headers: parsedHeaders,
            body: ep.body.trim() || undefined,
            projectId: pid,
            folder,
            sortOrder: i,
            regions,
          }),
        });

        if (!res.ok) {
          failed += 1;
          const data = await res.json().catch(() => ({}));
          console.error(
            `Import failed for ${ep.method} ${ep.path}:`,
            data.error,
          );
        }

        setImportProgress({ done: i + 1, total: selected.length });
      }

      if (failed > 0) {
        setError(
          `Imported ${selected.length - failed} of ${selected.length} checks. ${failed} failed.`,
        );
      }

      setImportComplete(true);
    } catch {
      setError("Failed to import endpoints");
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = endpoints.filter((ep) => ep.selected).length;

  const methodColors: Record<string, string> = {
    GET: "bg-emerald-100 text-emerald-700",
    POST: "bg-blue-100 text-blue-700",
    PUT: "bg-amber-100 text-amber-700",
    PATCH: "bg-orange-100 text-orange-700",
    DELETE: "bg-red-100 text-red-700",
    HEAD: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <Link
          href="/checks"
          className="inline-flex items-center gap-1.5 text-sm text-gw-fg-muted hover:text-gw-fg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to checks
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gw-fg">
          Import from OpenAPI
        </h1>
        <p className="mt-1 text-sm text-gw-fg-muted">
          Discover endpoints, set path params, auth headers, probe regions, and
          body before importing — so monitors pass from the first run.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {importComplete ? (
        <div className="rounded-xl border border-gw-border bg-gw-surface p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h3 className="mt-4 text-lg font-semibold text-gw-fg">
            Import Complete
          </h3>
          <p className="mt-2 text-sm text-gw-fg-muted">
            Successfully imported {importProgress?.total} endpoint
            {(importProgress?.total ?? 0) !== 1 ? "s" : ""} as checks.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setImportComplete(false);
                setEndpoints([]);
                setSpecUrl("");
              }}
              className="rounded-lg border border-gray-300 bg-gw-surface px-4 py-2.5 text-sm font-medium text-gw-fg-muted shadow-sm hover:bg-gw-surface-hover"
            >
              Import More
            </button>
            <button
              onClick={() => router.push("/checks")}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              View Checks
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8 rounded-xl border border-gw-border bg-gw-surface p-6 shadow-sm">
            <label
              htmlFor="specUrl"
              className="mb-1.5 block text-sm font-medium text-gw-fg-muted"
            >
              OpenAPI Specification URL
            </label>
            <div className="flex gap-3">
              <input
                id="specUrl"
                type="url"
                placeholder="https://api.example.com/openapi.json"
                value={specUrl}
                onChange={(e) => setSpecUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDiscover();
                }}
                disabled={discovering}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleDiscover}
                disabled={discovering}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {discovering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Discover
              </button>
            </div>
          </div>

          {endpoints.length > 0 && (
            <div className="rounded-xl border border-gw-border bg-gw-surface shadow-sm">
              <div className="border-b border-gw-border px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gw-fg">
                      Discovered Endpoints
                    </h2>
                    <p className="mt-0.5 text-sm text-gw-fg-muted">
                      {endpoints.length} endpoint
                      {endpoints.length !== 1 ? "s" : ""} &middot; {selectedCount}{" "}
                      selected. Rows start collapsed — expand to edit URL, auth,
                      and body.
                    </p>
                  </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => toggleAll(true)}
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => toggleAll(false)}
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    Deselect all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={expandAll}
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    Expand all
                  </button>
                </div>
                </div>
                <label className="mt-4 block max-w-md">
                  <span className="mb-1 block text-xs font-medium text-gw-fg-muted">
                    Folder (optional)
                  </span>
                  <input
                    type="text"
                    value={importFolder}
                    onChange={(e) => setImportFolder(e.target.value)}
                    placeholder="e.g. httpbin, Petstore API"
                    className="w-full rounded-lg border border-gw-border bg-gw-surface px-3 py-2 text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="mt-1 block text-xs text-gw-fg-subtle">
                    Imported monitors are grouped in this folder on the Monitors
                    page.
                  </span>
                </label>
                <div className="mt-5">
                  <p className="mb-1 text-xs font-medium text-gw-fg-muted">
                    Probe regions
                  </p>
                  <p className="mb-3 text-xs text-gw-fg-subtle">
                    {singleRegion
                      ? "Checks run from this instance location."
                      : "Default regions for all imported monitors. Expand a row to override per endpoint."}
                  </p>
                  <RegionPicker
                    probes={probes}
                    selectableRegions={selectableRegions}
                    selected={importRegions}
                    onToggle={toggleImportRegion}
                    singleRegion={singleRegion}
                  />
                </div>
              </div>

              <ul>
                {endpoints.map((ep, index) => (
                  <DiscoverEndpointRow
                    key={`${ep.method}-${ep.path}-${index}`}
                    endpoint={ep}
                    index={index}
                    methodColors={methodColors}
                    defaultRegions={importRegions}
                    probes={probes}
                    selectableRegions={selectableRegions}
                    singleRegion={singleRegion}
                    onToggleSelect={() => toggleEndpoint(index)}
                    onToggleExpand={() => toggleExpand(index)}
                    onUpdate={(patch) => updateEndpoint(index, patch)}
                    onPathParamChange={(name, value) =>
                      updatePathParam(index, name, value)
                    }
                  />
                ))}
              </ul>

              <div className="flex items-center justify-between border-t border-gw-border px-4 py-4 sm:px-6">
                {importing && importProgress && (
                  <div className="flex items-center gap-2 text-sm text-gw-fg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing {importProgress.done} of {importProgress.total}...
                  </div>
                )}
                {!importing && <div />}
                <button
                  onClick={handleImport}
                  disabled={
                    importing ||
                    selectedCount === 0 ||
                    importRegions.length === 0
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Import className="h-4 w-4" />
                  )}
                  Import Selected ({selectedCount})
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
