"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { RegionPicker } from "@/components/checks/region-picker";
import type { ProbeStatus } from "@/lib/probe-health";
import {
  dangerAlertClass,
  dangerFilledButtonClass,
  dangerOutlineButtonClass,
  dangerTextClass,
} from "@/lib/uptime-colors";

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

export default function EditCheckPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
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
  const [enabled, setEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetch(`/api/checks/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          setErrors({ general: "Check not found" });
          setLoading(false);
          return;
        }
        const check = await res.json();
        setName(check.name);
        setFolder(check.folder ?? "");
        setUrl(check.url);
        setMethod(check.method);
        setExpectedStatus(check.expectedStatus);
        setTimeout(Math.round(check.timeout / 1000));
        setInterval(check.interval);
        setRegions(check.regions ?? []);
        setIsPublic(check.isPublic ?? true);
        setEnabled(check.enabled ?? true);
        if (check.headers && Object.keys(check.headers).length > 0) {
          setHeaders(JSON.stringify(check.headers, null, 2));
          setShowAdvanced(true);
        }
        if (check.body) {
          setBody(check.body);
          setShowAdvanced(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setErrors({ general: "Failed to load check" });
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    fetch("/api/instance")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (!data) return;
        setSelectableRegions(
          Array.isArray(data.selectableRegions)
            ? data.selectableRegions
            : Array.isArray(data.regions)
              ? data.regions
              : [],
        );
        setProbes(Array.isArray(data.probes) ? data.probes : []);
        setSingleRegion(Boolean(data.singleRegion));
      })
      .catch(() => {});
  }, []);

  const displayProbes: ProbeStatus[] = (() => {
    const byId = new Map(probes.map((p) => [p.id, p]));
    for (const id of regions) {
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          label: id,
          status: "unhealthy",
          kind: "remote",
          lastChecked: new Date().toISOString(),
          responseTimeMs: null,
          error: "Previously assigned — probe no longer available",
        });
      }
    }
    return [...byId.values()];
  })();

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

  function toggleRegion(regionId: string) {
    setRegions((prev) =>
      prev.includes(regionId)
        ? prev.filter((r) => r !== regionId)
        : [...prev, regionId]
    );
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setErrors({});

    try {
      const res = await fetch(`/api/checks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          folder: folder.trim() || null,
          url: url.trim(),
          method,
          expectedStatus,
          timeout: timeout * 1000,
          interval,
          headers: headers.trim() ? JSON.parse(headers) : {},
          body: METHODS_WITH_BODY.has(method) && body.trim() ? body.trim() : null,
          regions,
          isPublic,
          enabled,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrors({ general: data.error || "Failed to update check" });
        setSaving(false);
        return;
      }

      router.push(`/checks/${id}`);
      router.refresh();
    } catch {
      setErrors({ general: "An unexpected error occurred" });
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/checks/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/checks");
        router.refresh();
      } else {
        setErrors({ general: "Failed to delete check" });
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch {
      setErrors({ general: "Failed to delete check" });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const inputCls =
    "w-full bg-gw-surface border border-gw-border rounded-xl px-4 py-2.5 text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all";
  const labelCls = "block text-sm font-medium text-gw-fg-muted mb-1.5";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-gw-fg-subtle" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/checks/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gw-fg-subtle transition-colors hover:text-gw-fg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to monitor
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gw-fg">
          Edit Monitor
        </h1>
        <p className="mt-1 text-sm text-gw-fg-muted">
          Update the configuration for this monitor.
        </p>
      </div>

      {errors.general && (
        <div className={`mb-6 rounded-xl px-4 py-3 text-sm ${dangerAlertClass}`}>
          {errors.general}
        </div>
      )}

      <div className="space-y-6">
        {/* Enabled toggle */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gw-fg">Status</h2>
              <p className="text-sm text-gw-fg-subtle">
                {enabled ? "Monitor is active and running checks." : "Monitor is paused."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                enabled ? "bg-emerald-500" : "bg-gray-200"
              }`}
              role="switch"
              aria-checked={enabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-gw-surface shadow ring-0 transition-transform duration-200 ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>

        {/* Basic Info */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gw-fg">Basic Info</h2>
          <p className="mb-5 text-sm text-gw-fg-subtle">Name and target URL.</p>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className={labelCls}>Name</label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              {errors.name && <p className={`mt-1.5 text-sm ${dangerTextClass}`}>{errors.name}</p>}
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
              <label htmlFor="url" className={labelCls}>URL</label>
              <input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} />
              {errors.url && <p className={`mt-1.5 text-sm ${dangerTextClass}`}>{errors.url}</p>}
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

        {/* Configuration */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gw-fg">Configuration</h2>
          <p className="mb-5 text-sm text-gw-fg-subtle">Timing and expected response settings.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="expectedStatus" className={labelCls}>Expected Status</label>
              <input id="expectedStatus" type="number" min={100} max={599} value={expectedStatus} onChange={(e) => setExpectedStatus(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label htmlFor="timeout" className={labelCls}>Timeout (sec)</label>
              <input id="timeout" type="number" min={1} max={120} value={timeout} onChange={(e) => setTimeout(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label htmlFor="interval" className={labelCls}>Check Interval</label>
              <select id="interval" value={interval} onChange={(e) => setInterval(Number(e.target.value))} className={inputCls}>
                {INTERVALS.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Regions */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gw-fg">Regions</h2>
          <p className="mb-5 text-sm text-gw-fg-subtle">
            {singleRegion
              ? "This instance runs checks from a single location."
              : "Where to run health checks from."}
          </p>
          <RegionPicker
            probes={displayProbes}
            selectableRegions={selectableRegions}
            selected={regions}
            onToggle={toggleRegion}
            singleRegion={singleRegion}
          />
        </section>

        {/* Visibility */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gw-fg">Visibility</h2>
              <p className="text-sm text-gw-fg-subtle">Public monitors can appear on status pages.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isPublic ? "bg-indigo-600" : "bg-gray-200"}`}
              role="switch"
              aria-checked={isPublic}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-gw-surface shadow ring-0 transition-transform duration-200 ${isPublic ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </section>

        {/* Advanced */}
        <section className="rounded-2xl border border-gw-border bg-gw-surface shadow-sm">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex w-full items-center justify-between p-6 text-left"
          >
            <div>
              <h2 className="text-base font-semibold text-gw-fg">Advanced</h2>
              <p className="text-sm text-gw-fg-subtle">Custom headers and request body.</p>
            </div>
            <ChevronDown className={`h-5 w-5 text-gw-fg-subtle transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
          {showAdvanced && (
            <div className="space-y-4 border-t border-gw-border px-6 pb-6 pt-4">
              <div>
                <label htmlFor="headers" className={labelCls}>
                  Headers <span className="font-normal text-gw-fg-subtle">(JSON)</span>
                </label>
                <textarea id="headers" rows={3} placeholder='{"Authorization": "Bearer token"}' value={headers} onChange={(e) => setHeaders(e.target.value)} className={inputCls} />
                {errors.headers && <p className={`mt-1.5 text-sm ${dangerTextClass}`}>{errors.headers}</p>}
              </div>
              {METHODS_WITH_BODY.has(method) && (
                <div>
                  <label htmlFor="body" className={labelCls}>Body</label>
                  <textarea id="body" rows={4} placeholder='{"key": "value"}' value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} />
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Actions */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${dangerOutlineButtonClass}`}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-gw-surface p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gw-fg">Delete monitor?</h3>
            <p className="mt-2 text-sm text-gw-fg-muted">
              This will permanently delete <strong>{name}</strong> and all its check results. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl border border-gw-border px-4 py-2 text-sm font-medium text-gw-fg-muted hover:bg-gw-surface-hover"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${dangerFilledButtonClass}`}
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
