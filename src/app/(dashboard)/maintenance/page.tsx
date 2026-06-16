"use client";

import { useEffect, useState, useCallback } from "react";
import { useTeam } from "@/components/dashboard/team-context";
import { format } from "date-fns";
import {
  Wrench,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Clock,
  CheckCircle2,
} from "lucide-react";

type MaintenanceWindow = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";
  scheduledStart: string;
  scheduledEnd: string;
  checks: { id: string; check: { id: string; name: string; url: string } }[];
  createdAt: string;
  updatedAt: string;
};

type CheckInfo = {
  id: string;
  name: string;
  url: string;
};

const INPUT_CLS =
  "w-full bg-gw-surface border border-gw-border rounded-xl px-4 py-2.5 text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all";
const LABEL_CLS = "block text-sm font-medium text-gw-fg-muted mb-1.5";

const STATUS_STYLES: Record<
  MaintenanceWindow["status"],
  { bg: string; text: string; label: string }
> = {
  SCHEDULED: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    label: "Scheduled",
  },
  IN_PROGRESS: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "In Progress",
  },
  COMPLETED: {
    bg: "bg-gw-surface-2",
    text: "text-gw-fg-muted",
    label: "Completed",
  },
};

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MaintenancePage() {
  const { canEdit, teamId } = useTeam();
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [checks, setChecks] = useState<CheckInfo[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formCheckIds, setFormCheckIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchWindows = useCallback(async (pid: string) => {
    const res = await fetch(`/api/maintenance?projectId=${pid}`);
    if (!res.ok) throw new Error("Failed to load maintenance windows");
    return (await res.json()) as MaintenanceWindow[];
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const projRes = await fetch(`/api/projects?teamId=${teamId}`);
        if (!projRes.ok) throw new Error("Failed to load projects");
        const projects = await projRes.json();
        const pid = projects[0]?.id;
        if (!pid) {
          setLoading(false);
          return;
        }
        setProjectId(pid);

        // Fetch checks and maintenance independently so one failure doesn't block the other
        const checksPromise = fetch(`/api/checks?projectId=${pid}`)
          .then((r) => (r.ok ? (r.json() as Promise<CheckInfo[]>) : []))
          .catch(() => [] as CheckInfo[]);

        const maintenancePromise = fetchWindows(pid).catch(
          () => [] as MaintenanceWindow[],
        );

        const [ch, mw] = await Promise.all([checksPromise, maintenancePromise]);
        setChecks(ch);
        setWindows(mw);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchWindows]);

  function openCreateModal() {
    setEditingId(null);
    setFormTitle("");
    setFormDescription("");
    setFormStart("");
    setFormEnd("");
    setFormCheckIds(new Set());
    setModalOpen(true);
  }

  function openEditModal(mw: MaintenanceWindow) {
    setEditingId(mw.id);
    setFormTitle(mw.title);
    setFormDescription(mw.description ?? "");
    setFormStart(toLocalDatetime(mw.scheduledStart));
    setFormEnd(toLocalDatetime(mw.scheduledEnd));
    setFormCheckIds(new Set(mw.checks.map((c) => c.check.id)));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  function toggleCheck(id: string) {
    setFormCheckIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!projectId) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        projectId,
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        scheduledStart: new Date(formStart).toISOString(),
        scheduledEnd: new Date(formEnd).toISOString(),
        checkIds: Array.from(formCheckIds),
      };

      if (editingId) {
        const res = await fetch(`/api/maintenance/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ??
              "Failed to update maintenance window",
          );
        }
      } else {
        const res = await fetch("/api/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error ??
              "Failed to create maintenance window",
          );
        }
      }

      const updated = await fetchWindows(projectId);
      setWindows(updated);
      closeModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/maintenance/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete maintenance window");
      setWindows((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleComplete(mw: MaintenanceWindow) {
    if (!projectId) return;
    setCompletingId(mw.id);
    try {
      const res = await fetch(`/api/maintenance/${mw.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (!res.ok) throw new Error("Failed to complete maintenance window");
      setWindows((prev) =>
        prev.map((w) =>
          w.id === mw.id ? { ...w, status: "COMPLETED" as const } : w,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete");
    } finally {
      setCompletingId(null);
    }
  }

  const endBeforeStart =
    formStart.length > 0 &&
    formEnd.length > 0 &&
    new Date(formEnd) <= new Date(formStart);

  const formValid =
    formTitle.trim().length > 0 &&
    formStart.length > 0 &&
    formEnd.length > 0 &&
    !endBeforeStart;

  const activeWindows = windows.filter(
    (w) => w.status === "SCHEDULED" || w.status === "IN_PROGRESS",
  );
  const pastWindows = windows.filter((w) => w.status === "COMPLETED");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gw-fg">
            Maintenance
          </h1>
          <p className="mt-1 text-sm text-gw-fg-muted">
            Schedule maintenance windows to pause monitoring
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          Schedule Maintenance
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {windows.length === 0 ? (
        <div className="rounded-2xl border border-gw-border bg-gw-surface py-20 text-center shadow-sm">
          <Wrench className="mx-auto h-10 w-10 text-gray-300" />
          <h3 className="mt-4 text-base font-semibold text-gw-fg">
            No maintenance windows scheduled
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-gw-fg-muted">
            Schedule a maintenance window to pause monitoring during planned
            downtime.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Schedule Maintenance
          </button>
        </div>
      ) : (
        <>
          {activeWindows.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gw-fg-subtle">
                Active &amp; Upcoming
              </h2>
              {activeWindows.map((mw) => (
                <WindowCard
                  key={mw.id}
                  mw={mw}
                  deletingId={deletingId}
                  completingId={completingId}
                  onEdit={() => openEditModal(mw)}
                  onDelete={() => handleDelete(mw.id)}
                  onComplete={() => handleComplete(mw)}
                />
              ))}
            </div>
          )}

          {pastWindows.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gw-fg-subtle">
                Past
              </h2>
              {pastWindows.map((mw) => (
                <WindowCard
                  key={mw.id}
                  mw={mw}
                  deletingId={deletingId}
                  completingId={completingId}
                  onEdit={() => openEditModal(mw)}
                  onDelete={() => handleDelete(mw.id)}
                  onComplete={() => handleComplete(mw)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-gw-border bg-gw-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-gw-border px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-gw-fg">
                  {editingId
                    ? "Edit Maintenance Window"
                    : "Schedule Maintenance"}
                </h2>
                <p className="text-sm text-gw-fg-subtle">
                  {editingId
                    ? "Update the maintenance window details."
                    : "Create a new maintenance window."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gw-fg-subtle transition-colors hover:bg-gw-surface-hover hover:text-gw-fg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div>
                <label htmlFor="mw-title" className={LABEL_CLS}>
                  Title
                </label>
                <input
                  id="mw-title"
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Database migration"
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label htmlFor="mw-desc" className={LABEL_CLS}>
                  Description{" "}
                  <span className="font-normal text-gw-fg-subtle">(optional)</span>
                </label>
                <textarea
                  id="mw-desc"
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What work is being performed..."
                  className={INPUT_CLS}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mw-start" className={LABEL_CLS}>
                    Scheduled Start
                  </label>
                  <input
                    id="mw-start"
                    type="datetime-local"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label htmlFor="mw-end" className={LABEL_CLS}>
                    Scheduled End
                  </label>
                  <input
                    id="mw-end"
                    type="datetime-local"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
              </div>

              {endBeforeStart && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  The end date must be after the start date.
                </p>
              )}

              <div>
                <p className={LABEL_CLS}>Affected Checks</p>
                {checks.length === 0 ? (
                  <p className="text-sm text-gw-fg-subtle">
                    No checks available. Create a monitor first.
                  </p>
                ) : (
                  <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-gw-border p-3">
                    {checks.map((check) => (
                      <label
                        key={check.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-gw-surface-hover"
                      >
                        <input
                          type="checkbox"
                          checked={formCheckIds.has(check.id)}
                          onChange={() => toggleCheck(check.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-200"
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
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gw-border px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm font-medium text-gw-fg-muted shadow-sm transition-all hover:bg-gw-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!formValid || saving}
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WindowCard({
  mw,
  deletingId,
  completingId,
  onEdit,
  onDelete,
  onComplete,
}: {
  mw: MaintenanceWindow;
  deletingId: string | null;
  completingId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
}) {
  const style = STATUS_STYLES[mw.status];
  const isActive = mw.status !== "COMPLETED";

  return (
    <div className="rounded-2xl border border-gw-border bg-gw-surface px-5 py-4 shadow-sm transition-all hover:border-gray-300">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h3 className="truncate text-sm font-semibold text-gw-fg">
              {mw.title}
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}
            >
              {style.label}
            </span>
          </div>
          {mw.description && (
            <p className="mt-1 text-sm text-gw-fg-muted">{mw.description}</p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-gw-fg-subtle">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {format(new Date(mw.scheduledStart), "MMM d, yyyy HH:mm")}
            </span>
            <span>→</span>
            <span>
              {format(new Date(mw.scheduledEnd), "MMM d, yyyy HH:mm")}
            </span>
          </div>
          {mw.checks.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {mw.checks.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center rounded-full bg-gw-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-gw-fg-muted"
                >
                  {c.check.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isActive && (
            <button
              type="button"
              disabled={completingId === mw.id}
              onClick={onComplete}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              {completingId === mw.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Complete
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 text-gw-fg-subtle transition-colors hover:bg-gw-surface-hover hover:text-gw-fg-muted"
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={deletingId === mw.id}
            onClick={onDelete}
            className="rounded-lg p-2 text-gw-fg-subtle transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label="Delete"
          >
            {deletingId === mw.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
