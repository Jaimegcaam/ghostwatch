"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Loader2, X } from "lucide-react";
import Link from "next/link";
import { resolveUploadUrl } from "@/lib/upload-url";
import {
  dangerAlertClass,
  dangerOutlineButtonClass,
  dangerFilledButtonClass,
  dangerZoneBorderClass,
  dangerZoneTitleClass,
} from "@/lib/uptime-colors";

type Team = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
};

export default function TeamSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetch(`/api/teams/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTeam(data);
        setName(data.name);
        setSlug(data.slug);
        setImageUrl(resolveUploadUrl(data.imageUrl) ?? "");
      })
      .catch(console.error);
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), imageUrl: imageUrl.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update team");
      setTeam(data);
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete team");
      }
      router.push("/teams");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
    }
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/teams" className="inline-flex items-center gap-1.5 text-sm text-gw-fg-muted hover:text-gw-fg-muted mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to teams
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gw-fg">Team Settings</h1>
        <p className="mt-1 text-sm text-gw-fg-muted">Manage your team configuration.</p>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl border border-gw-border bg-gw-surface p-4 shadow-sm space-y-4 sm:p-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gw-fg-muted mb-1">Team Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gw-fg focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gw-fg-muted mb-1">Team Slug</label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gw-fg font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gw-fg-muted mb-1">
            Team Image <span className="font-normal text-gw-fg-subtle">(optional)</span>
          </label>
          {imageUrl ? (
            <div className="flex flex-col gap-3 rounded-xl border border-gw-border bg-gw-surface-2 px-4 py-3 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveUploadUrl(imageUrl) ?? ""}
                alt="Team"
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
              <span className="min-w-0 flex-1 break-all text-xs text-gw-fg-muted">{imageUrl}</span>
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className="shrink-0 rounded-lg p-1 text-gw-fg-subtle transition-colors hover:bg-gray-200 hover:text-gw-fg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 transition-colors ${
                imageUploading
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-gw-border bg-gw-surface hover:border-indigo-400 hover:bg-indigo-50/50"
              }`}
            >
              {imageUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              ) : (
                <>
                  <svg className="mb-1.5 h-5 w-5 text-gw-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-sm font-medium text-gw-fg-muted">Upload image</span>
                  <span className="mt-0.5 text-xs text-gw-fg-subtle">PNG, JPG or WebP — max 2 MB</span>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={imageUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImageUploading(true);
                  try {
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/api/upload", { method: "POST", body: fd });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error((data as { error?: string }).error ?? "Upload failed");
                    }
                    const { url } = (await res.json()) as { url: string };
                    setImageUrl(url);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    setImageUploading(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          )}
        </div>

        {error && <p className={`rounded-lg px-3 py-2 text-sm ${dangerAlertClass}`}>{error}</p>}
        {success && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">Settings saved successfully.</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <div className={`rounded-2xl bg-gw-surface p-6 shadow-sm space-y-4 ${dangerZoneBorderClass} border`}>
        <h2 className={`text-sm font-semibold ${dangerZoneTitleClass}`}>Danger Zone</h2>
        <p className="text-sm text-gw-fg-muted">
          Deleting a team will permanently remove all its projects, checks, and data. This cannot be undone.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${dangerOutlineButtonClass}`}
          >
            <Trash2 className="h-4 w-4" />
            Delete Team
          </button>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50 sm:w-auto ${dangerFilledButtonClass}`}
            >
              {deleting ? "Deleting..." : "Yes, delete this team"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-sm text-gw-fg-muted hover:text-gw-fg-muted"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
