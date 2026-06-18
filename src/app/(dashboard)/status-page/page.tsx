"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Globe,
  X,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
} from "lucide-react";
import { useTeam } from "@/components/dashboard/team-context";
import { CustomDomainSetup } from "@/components/status/custom-domain-setup";
import { generateSlug } from "@/lib/utils";
import { normalizeStoredUploadUrl, publicUploadSrc } from "@/lib/upload-url";
import type { StatusPageThemeMode } from "@/lib/status-page-theme";
import {
  dangerAlertClass,
  dangerOutlineButtonClass,
} from "@/lib/uptime-colors";

type CheckInfo = {
  id: string;
  name: string;
  url: string;
  isPublic: boolean;
};

type StatusPageCheck = {
  id: string;
  checkId: string;
  check: CheckInfo;
};

type StatusPageDomain = {
  id: string;
  domain: string;
  verified?: boolean;
  createdAt: string;
};

type StatusPageDomainDetail = {
  domain: string;
  verified: boolean;
  verifiedAt: string | null;
};

type StatusPage = {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  theme: StatusPageThemeMode;
  customDomain: string | null;
  domains?: string[];
  customDomains?: StatusPageDomain[];
  domainDetails?: StatusPageDomainDetail[];
  logoUrl: string | null;
  checks: StatusPageCheck[];
  createdAt: string;
  updatedAt: string;
  urls?: {
    defaultUrl: string;
    customUrl: string | null;
    customUrls?: string[];
    primaryUrl: string;
  };
};

type Project = {
  id: string;
  name: string;
  slug: string;
};

type FormData = {
  title: string;
  slug: string;
  description: string;
  customDomains: string[];
  logoUrl: string;
  isPublic: boolean;
  theme: StatusPageThemeMode;
  selectedCheckIds: Set<string>;
};

const emptyForm: FormData = {
  title: "",
  slug: "",
  description: "",
  customDomains: [],
  logoUrl: "",
  isPublic: true,
  theme: "light",
  selectedCheckIds: new Set(),
};

export default function StatusPagesManager() {
  const { canEdit, teamId } = useTeam();
  const [project, setProject] = useState<Project | null>(null);
  const [statusPages, setStatusPages] = useState<StatusPage[]>([]);
  const [allChecks, setAllChecks] = useState<CheckInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [slugTouched, setSlugTouched] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [appOrigin, setAppOrigin] = useState(
    typeof window !== "undefined" ? window.location.origin : "",
  );

  const loadData = useCallback(async () => {
    try {
      const projRes = await fetch(`/api/projects?teamId=${teamId}`);
      if (!projRes.ok) throw new Error("Failed to load projects");
      const projects = await projRes.json();
      const proj = projects[0];
      if (!proj) {
        setLoading(false);
        return;
      }
      setProject(proj);

      const [spRes, checksRes] = await Promise.all([
        fetch(`/api/status-page?projectId=${proj.id}`),
        fetch(`/api/checks?projectId=${proj.id}`),
      ]);

      if (!spRes.ok) throw new Error("Failed to load status pages");
      if (!checksRes.ok) throw new Error("Failed to load checks");

      const sp: StatusPage[] = await spRes.json();
      const checks: CheckInfo[] = await checksRes.json();

      setStatusPages(sp);
      setAllChecks(checks.filter((c) => c.isPublic));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetch("/api/status-page/domain-setup")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.appOrigin) setAppOrigin(data.appOrigin);
      })
      .catch(() => {});
  }, []);

  function openCreateForm() {
    setEditingId(null);
    setForm({ ...emptyForm, selectedCheckIds: new Set() });
    setSlugTouched(false);
    setError(null);
    setShowForm(true);
  }

  function openEditForm(page: StatusPage) {
    setEditingId(page.id);
    setForm({
      title: page.title,
      slug: page.slug,
      description: page.description ?? "",
      customDomains:
        page.domains ??
        page.customDomains?.map((d) => d.domain) ??
        (page.customDomain ? [page.customDomain] : []),
      logoUrl: page.logoUrl ?? "",
      isPublic: page.isPublic,
      theme: page.theme ?? "light",
      selectedCheckIds: new Set(page.checks.map((c) => c.check.id)),
    });
    setSlugTouched(true);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm, selectedCheckIds: new Set() });
    setError(null);
  }

  function handleTitleChange(value: string) {
    setForm((prev) => ({
      ...prev,
      title: value,
      ...(!slugTouched && { slug: generateSlug(value) }),
    }));
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setForm((prev) => ({
      ...prev,
      slug: value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
    }));
  }

  function toggleCheck(checkId: string) {
    setForm((prev) => {
      const next = new Set(prev.selectedCheckIds);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return { ...prev, selectedCheckIds: next };
    });
  }

  async function handleSave() {
    if (!project || !form.title.trim() || !form.slug.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...(editingId ? { id: editingId } : { projectId: project.id }),
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        customDomains: form.customDomains,
        logoUrl: normalizeStoredUploadUrl(form.logoUrl.trim()) || null,
        isPublic: form.isPublic,
        theme: form.theme,
        checkIds: Array.from(form.selectedCheckIds),
      };

      const res = await fetch("/api/status-page", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      closeForm();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this status page?")) return;
    setDeleting(id);

    try {
      const res = await fetch(`/api/status-page?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete");
      }

      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gw-fg-subtle" />
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gw-fg">Status Pages</h1>
        <p className="mt-2 text-gw-fg-muted">
          No project found. Create a project first.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gw-fg">Status Pages</h1>
          <p className="mt-1 text-sm text-gw-fg-muted">
            Create and manage public status pages for your monitors
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Create Status Page
          </button>
        )}
      </div>

      {error && !showForm && (
        <div className={`mb-6 rounded-xl px-4 py-3 text-sm ${dangerAlertClass}`}>
          {error}
        </div>
      )}

      {/* Status pages list */}
      {statusPages.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-gw-border bg-gw-surface py-16 text-center shadow-sm">
          <Globe className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gw-fg-muted">No status pages yet</p>
          <p className="mt-1 text-sm text-gw-fg-subtle">
            {canEdit ? "Create one to share your uptime with the world" : "No status pages have been created for this team yet"}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Create Status Page
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {statusPages.map((page) => (
            <div
              key={page.id}
              className="rounded-2xl border border-gw-border bg-gw-surface p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="text-base font-semibold text-gw-fg">
                      {page.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        page.isPublic
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-gw-surface-2 text-gw-fg-muted"
                      }`}
                    >
                      {page.isPublic ? "Public" : "Private"}
                    </span>
                    <span className="shrink-0 rounded-full bg-gw-surface-2 px-2 py-0.5 text-xs font-medium capitalize text-gw-fg-muted">
                      {page.theme ?? "light"}
                    </span>
                  </div>
                  {page.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-gw-fg-muted">
                      {page.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {(page.urls?.customUrls?.length
                  ? page.urls.customUrls
                  : page.domains?.map((d) => `https://${d}`) ?? []
                ).length > 0 ? (
                  <ul className="space-y-1">
                    {(page.urls?.customUrls ??
                      page.domains?.map((d) => `https://${d}`) ??
                      []
                    ).map((url) => (
                      <li
                        key={url}
                        className="flex items-start gap-2 text-sm text-gw-fg-muted"
                      >
                        <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 break-all font-mono text-xs text-gw-fg">
                          {url.replace(/^https:\/\//, "")}
                        </span>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-gw-fg-subtle transition-colors hover:text-indigo-400"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-gw-fg-muted">
                    <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 break-all font-mono text-xs">
                      {page.urls?.defaultUrl ?? `${appOrigin}/s/${page.slug}`}
                    </span>
                    <a
                      href={page.urls?.defaultUrl ?? `/s/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-gw-fg-subtle hover:text-indigo-400"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
                {(page.urls?.customUrls?.length ?? page.domains?.length ?? 0) >
                  0 && (
                  <p className="break-all text-[11px] text-gw-fg-subtle">
                    Also at{" "}
                    {page.urls?.defaultUrl ?? `${appOrigin}/s/${page.slug}`}
                  </p>
                )}
                <p className="text-xs text-gw-fg-subtle">
                  {page.checks.length} monitor
                  {page.checks.length !== 1 ? "s" : ""} assigned
                </p>
              </div>

              {canEdit && (
                <div className="mt-4 flex gap-2 border-t border-gw-border pt-4">
                  <button
                    type="button"
                    onClick={() => openEditForm(page)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gw-border bg-gw-surface px-3 py-1.5 text-sm font-medium text-gw-fg-muted transition-all hover:bg-gw-surface-hover"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deleting === page.id}
                    onClick={() => handleDelete(page.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${dangerOutlineButtonClass}`}
                  >
                    {deleting === page.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-0 sm:items-start sm:p-4 sm:pt-[10vh]">
          <div
            className="max-h-[100dvh] w-full overflow-y-auto rounded-t-2xl border border-gw-border bg-gw-surface p-4 shadow-xl sm:max-h-none sm:max-w-lg sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gw-fg">
                {editingId ? "Edit Status Page" : "Create Status Page"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-1.5 text-gw-fg-subtle transition-colors hover:bg-gw-surface-hover hover:text-gw-fg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${dangerAlertClass}`}>
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label
                  htmlFor="sp-title"
                  className="mb-1.5 block text-sm font-medium text-gw-fg-muted"
                >
                  Title
                </label>
                <input
                  id="sp-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="My Service Status"
                  className="w-full rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm text-gw-fg placeholder:text-gw-fg-subtle transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {/* Slug */}
              <div>
                <label
                  htmlFor="sp-slug"
                  className="mb-1.5 block text-sm font-medium text-gw-fg-muted"
                >
                  Slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gw-fg-subtle">/s/</span>
                  <input
                    id="sp-slug"
                    type="text"
                    value={form.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="my-service-status"
                    className="w-full rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 font-mono text-sm text-gw-fg placeholder:text-gw-fg-subtle transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="sp-desc"
                  className="mb-1.5 block text-sm font-medium text-gw-fg-muted"
                >
                  Description
                </label>
                <textarea
                  id="sp-desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="Current status of our services"
                  className="w-full rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm text-gw-fg placeholder:text-gw-fg-subtle transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <CustomDomainSetup
                statusPageId={editingId ?? undefined}
                domains={form.customDomains}
                verifiedDomains={
                  statusPages
                    .find((p) => p.id === editingId)
                    ?.domainDetails?.filter((d) => d.verified)
                    .map((d) => d.domain) ?? []
                }
                isPublic={form.isPublic}
                onDomainsChange={(customDomains) =>
                  setForm((prev) => ({ ...prev, customDomains }))
                }
                defaultPublicUrl={
                  form.slug.trim()
                    ? `${appOrigin}/s/${form.slug.trim()}`
                    : `${appOrigin}/s/…`
                }
              />

              {/* Logo Upload */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gw-fg-muted">
                  Logo
                  <span className="ml-1 font-normal text-gw-fg-subtle">
                    (optional)
                  </span>
                </label>

                {form.logoUrl ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-gw-border bg-gw-surface-2 px-4 py-3 sm:flex-row sm:items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        publicUploadSrc(form.logoUrl, appOrigin || undefined) ??
                        ""
                      }
                      alt="Logo preview"
                      className="h-16 w-auto max-w-full object-contain object-left sm:h-24 sm:max-w-[320px]"
                    />
                    <span className="min-w-0 flex-1 break-all text-xs text-gw-fg-muted">
                      {form.logoUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, logoUrl: "" }))
                      }
                      className="shrink-0 rounded-lg p-1 text-gw-fg-subtle transition-colors hover:bg-gray-200 hover:text-gw-fg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
                      logoUploading
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-gw-border bg-gw-surface hover:border-indigo-400 hover:bg-indigo-50/50"
                    }`}
                  >
                    {logoUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                    ) : (
                      <>
                        <svg
                          className="mb-2 h-6 w-6 text-gw-fg-subtle"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                          />
                        </svg>
                        <span className="text-sm font-medium text-gw-fg-muted">
                          Click to upload logo
                        </span>
                        <span className="mt-0.5 text-xs text-gw-fg-subtle">
                          PNG, JPG or WebP — max 2 MB
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/pjpeg,image/webp,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                      disabled={logoUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setLogoUploading(true);
                        try {
                          const fd = new window.FormData();
                          fd.append("file", file);
                          const res = await fetch("/api/upload", {
                            method: "POST",
                            body: fd,
                          });
                          if (!res.ok) {
                            const data = await res.json().catch(() => ({}));
                            throw new Error(
                              (data as { error?: string }).error ??
                                "Upload failed",
                            );
                          }
                          const { url } = (await res.json()) as {
                            url: string;
                          };
                          setForm((prev) => ({ ...prev, logoUrl: url }));
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Upload failed",
                          );
                        } finally {
                          setLogoUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                )}
                <p className="mt-1 text-xs text-gw-fg-subtle">
                  Displayed in the status page header. PNG or JPG, max 2 MB.
                </p>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-medium text-gw-fg-muted">
                    Or paste image URL
                  </span>
                  <input
                    type="url"
                    value={
                      form.logoUrl.startsWith("http") ? form.logoUrl : ""
                    }
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        logoUrl: e.target.value.trim(),
                      }))
                    }
                    placeholder="https://example.com/logo.png"
                    className="w-full rounded-lg border border-gw-border bg-gw-surface px-3 py-2 text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </label>
              </div>

              {/* Public toggle */}
              <div className="flex items-center justify-between rounded-xl border border-gw-border px-4 py-3">
                <div className="flex items-center gap-3">
                  {form.isPublic ? (
                    <Eye className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <EyeOff className="h-5 w-5 text-gw-fg-subtle" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gw-fg">
                      {form.isPublic ? "Public" : "Private"}
                    </p>
                    <p className="text-xs text-gw-fg-muted">
                      {form.isPublic
                        ? "Anyone with the link can view"
                        : "Only you can see this page"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      isPublic: !prev.isPublic,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    form.isPublic ? "bg-indigo-600" : "bg-gray-200"
                  }`}
                  aria-label={form.isPublic ? "Make private" : "Make public"}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-gw-surface shadow ring-0 transition-transform duration-200 ease-in-out ${
                      form.isPublic ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Theme */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gw-fg-muted">
                  Appearance
                </label>
                <div className="inline-flex rounded-xl border border-gw-border bg-gw-surface-2 p-1">
                  {(["light", "dark"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, theme: mode }))
                      }
                      className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                        form.theme === mode
                          ? "bg-gw-surface text-gw-fg shadow-sm"
                          : "text-gw-fg-muted hover:text-gw-fg"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gw-fg-subtle">
                  How the public status page looks to visitors
                </p>
              </div>

              {/* Check selector */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gw-fg-muted">
                  Monitors
                </label>
                {allChecks.length === 0 ? (
                  <p className="rounded-xl border border-gw-border bg-gw-surface-2 px-4 py-3 text-sm text-gw-fg-muted">
                    No public monitors available
                  </p>
                ) : (
                  <div className="max-h-48 divide-y divide-gw-border overflow-y-auto rounded-xl border border-gw-border">
                    {allChecks.map((check) => (
                      <label
                        key={check.id}
                        className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gw-surface-hover"
                      >
                        <input
                          type="checkbox"
                          checked={form.selectedCheckIds.has(check.id)}
                          onChange={() => toggleCheck(check.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gw-fg">
                            {check.name}
                          </p>
                          <p className="truncate text-xs text-gw-fg-subtle">
                            {check.url}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-gw-fg-subtle">
                  {form.selectedCheckIds.size} monitor
                  {form.selectedCheckIds.size !== 1 ? "s" : ""} selected
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="w-full rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm font-medium text-gw-fg-muted transition-all hover:bg-gw-surface-hover sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !form.title.trim() || !form.slug.trim()}
                  onClick={handleSave}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Save Changes" : "Create Status Page"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
