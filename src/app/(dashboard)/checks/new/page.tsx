"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  FlaskConical,
  Loader2,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useTeam } from "@/components/dashboard/team-context";
import { RegionPicker } from "@/components/checks/region-picker";
import type { ProbeStatus } from "@/lib/probe-health";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"] as const;
const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

const INTERVALS = [
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "5 minutes", value: 300 },
  { label: "15 minutes", value: 900 },
  { label: "30 minutes", value: 1800 },
  { label: "1 hour", value: 3600 },
];

type Region = { id: string; label: string };

interface FormErrors {
  name?: string;
  url?: string;
  headers?: string;
  general?: string;
}

export default function NewCheckPage() {
  const router = useRouter();
  const { teamId } = useTeam();

  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<string>("GET");
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [timeout, setTimeout] = useState(30);
  const [interval, setInterval] = useState(60);
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [probes, setProbes] = useState<ProbeStatus[]>([]);
  const [selectableRegions, setSelectableRegions] = useState<Region[]>([]);
  const [singleRegion, setSingleRegion] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetch("/api/instance")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
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
        setRegions(defaultPick ? [defaultPick] : []);
      })
      .catch(() => {
        setSelectableRegions([{ id: "local", label: "This server" }]);
        setRegions(["local"]);
        setSingleRegion(true);
      });
  }, []);

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status?: number;
    responseTime?: number;
    error?: string;
  } | null>(null);

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!url.trim()) newErrors.url = "URL is required";
    try {
      new URL(url);
    } catch {
      if (url.trim()) newErrors.url = "Enter a valid URL";
    }
    if (headers.trim()) {
      try {
        JSON.parse(headers);
      } catch {
        newErrors.headers = "Headers must be valid JSON";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function toggleRegion(id: string) {
    setRegions((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  function buildPayload(projectId: string, enabled = true) {
    return {
      name: name.trim(),
      url: url.trim(),
      method,
      expectedStatus,
      timeout: timeout * 1000,
      interval,
      headers: headers.trim() ? JSON.parse(headers) : undefined,
      body:
        METHODS_WITH_BODY.has(method) && body.trim()
          ? body.trim()
          : undefined,
      projectId,
      regions,
      isPublic,
      enabled,
      folder: folder.trim() || undefined,
    };
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setErrors({});

    try {
      const projectRes = await fetch(`/api/projects?teamId=${teamId}`);
      const projects = await projectRes.json();
      if (!projects.length) {
        setErrors({
          general: "No project found. Please create a project first.",
        });
        setSaving(false);
        return;
      }

      const res = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(projects[0].id)),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrors({ general: data.error || "Failed to create check" });
        setSaving(false);
        return;
      }

      router.push("/checks");
    } catch {
      setErrors({ general: "An unexpected error occurred" });
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!validate()) return;
    setTesting(true);
    setTestResult(null);

    try {
      const projectRes = await fetch(`/api/projects?teamId=${teamId}`);
      const projects = await projectRes.json();
      if (!projects.length) {
        setTestResult({ success: false, error: "No project found" });
        setTesting(false);
        return;
      }

      const createRes = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(projects[0].id, false)),
      });

      if (!createRes.ok) {
        setTestResult({
          success: false,
          error: "Failed to create temporary check",
        });
        setTesting(false);
        return;
      }

      const check = await createRes.json();
      const testRes = await fetch(`/api/checks/${check.id}/test`, {
        method: "POST",
      });
      const result = await testRes.json();

      await fetch(`/api/checks/${check.id}`, { method: "DELETE" });

      setTestResult(result);
    } catch {
      setTestResult({ success: false, error: "Test request failed" });
    } finally {
      setTesting(false);
    }
  }

  const inputCls =
    "w-full bg-gw-surface border border-gw-border rounded-xl px-4 py-2.5 text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all";
  const labelCls = "block text-sm font-medium text-gw-fg-muted mb-1.5";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link
          href="/checks"
          className="inline-flex items-center gap-1.5 text-sm text-gw-fg-subtle transition-colors hover:text-gw-fg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to monitors
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gw-fg">
          Create Monitor
        </h1>
        <p className="mt-1 text-sm text-gw-fg-muted">
          Set up a new endpoint to monitor continuously.
        </p>
      </div>

      {errors.general && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.general}
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Basic Info */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gw-fg">Basic Info</h2>
          <p className="mb-5 text-sm text-gw-fg-subtle">
            Name your monitor and specify the target URL.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className={labelCls}>
                Name
              </label>
              <input
                id="name"
                type="text"
                placeholder="e.g. API Health Check"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
              />
              {errors.name && (
                <p className="mt-1.5 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="folder" className={labelCls}>
                Folder <span className="font-normal text-gw-fg-subtle">(optional)</span>
              </label>
              <input
                id="folder"
                type="text"
                placeholder="e.g. Production API, httpbin"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="url" className={labelCls}>
                URL
              </label>
              <input
                id="url"
                type="url"
                placeholder="https://api.example.com/health"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={inputCls}
              />
              {errors.url && (
                <p className="mt-1.5 text-sm text-red-600">{errors.url}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Method</label>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                      method === m
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-gw-surface-2 text-gw-fg-muted hover:bg-gray-200"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Configuration */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gw-fg">
            Configuration
          </h2>
          <p className="mb-5 text-sm text-gw-fg-subtle">
            Timing and expected response settings.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="expectedStatus" className={labelCls}>
                Expected Status
              </label>
              <input
                id="expectedStatus"
                type="number"
                min={100}
                max={599}
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="timeout" className={labelCls}>
                Timeout (sec)
              </label>
              <input
                id="timeout"
                type="number"
                min={1}
                max={120}
                value={timeout}
                onChange={(e) => setTimeout(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="interval" className={labelCls}>
                Check Interval
              </label>
              <select
                id="interval"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className={inputCls}
              >
                {INTERVALS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Section 3: Regions */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gw-fg">Regions</h2>
          <p className="mb-5 text-sm text-gw-fg-subtle">
            {singleRegion
              ? "This instance runs checks from a single location."
              : "Select where to run health checks from."}
          </p>

          <RegionPicker
            probes={probes}
            selectableRegions={selectableRegions}
            selected={regions}
            onToggle={toggleRegion}
            singleRegion={singleRegion}
          />
          {singleRegion ? (
            <p className="mt-3 text-sm text-gw-fg-subtle">
              Configure <code>PROBE_ENDPOINTS</code> or{" "}
              <code>MONITORING_REGIONS</code> on the hub to add more regions.
            </p>
          ) : null}
        </section>

        {/* Section 4: Visibility */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gw-fg">
                Visibility
              </h2>
              <p className="text-sm text-gw-fg-subtle">
                Public monitors can appear on status pages.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                isPublic ? "bg-indigo-600" : "bg-gray-200"
              }`}
              role="switch"
              aria-checked={isPublic}
              aria-label="Toggle public visibility"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-gw-surface shadow ring-0 transition-transform duration-200 ${
                  isPublic ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <p className="mt-2 text-xs text-gw-fg-subtle">
            {isPublic
              ? "This monitor is public and can be added to status pages."
              : "This monitor is private and hidden from status pages."}
          </p>
        </section>

        {/* Section 5: Advanced (collapsible) */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface shadow-sm">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between p-6 text-left"
          >
            <div>
              <h2 className="text-base font-semibold text-gw-fg">
                Advanced
              </h2>
              <p className="text-sm text-gw-fg-subtle">
                Custom headers and request body.
              </p>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-gw-fg-subtle transition-transform duration-200 ${
                showAdvanced ? "rotate-180" : ""
              }`}
            />
          </button>

          {showAdvanced && (
            <div className="space-y-4 border-t border-gw-border px-6 pb-6 pt-4">
              <div>
                <label htmlFor="headers" className={labelCls}>
                  Headers{" "}
                  <span className="font-normal text-gw-fg-subtle">(JSON)</span>
                </label>
                <textarea
                  id="headers"
                  rows={3}
                  placeholder='{"Authorization": "Bearer token"}'
                  value={headers}
                  onChange={(e) => setHeaders(e.target.value)}
                  className={inputCls}
                />
                {errors.headers && (
                  <p className="mt-1.5 text-sm text-red-600">
                    {errors.headers}
                  </p>
                )}
              </div>

              {METHODS_WITH_BODY.has(method) && (
                <div>
                  <label htmlFor="body" className={labelCls}>
                    Body
                  </label>
                  <textarea
                    id="body"
                    rows={4}
                    placeholder='{"key": "value"}'
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {testResult && (
        <div
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            testResult.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <p className="font-medium">
            {testResult.success ? "Test passed" : "Test failed"}
          </p>
          {testResult.status != null && <p>Status: {testResult.status}</p>}
          {testResult.responseTime != null && (
            <p>Response time: {testResult.responseTime}ms</p>
          )}
          {testResult.error && <p>Error: {testResult.error}</p>}
        </div>
      )}

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || saving}
          className="inline-flex items-center gap-2 rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm font-medium text-gw-fg-muted shadow-sm transition-all hover:bg-gw-surface-hover disabled:opacity-50"
        >
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FlaskConical className="h-4 w-4" />
          )}
          Test
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || testing}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Create Monitor
        </button>
      </div>
    </div>
  );
}
