"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderInput,
  GripVertical,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import {
  folderKeyFromCheck,
  groupChecksByFolder,
  normalizeFolder,
  UNCATEGORIZED_FOLDER,
} from "@/lib/check-folders";
import { dangerTextClass, uptimePercentClass } from "@/lib/uptime-colors";

export type CheckListItem = {
  id: string;
  name: string;
  url: string;
  method: string;
  isPublic: boolean;
  regions: string[];
  folder: string | null;
  uptime: number;
  displayLatency: number | null;
  results: Array<{
    success: boolean;
    responseTime: number | null;
    createdAt: string | Date;
  }>;
};

type Props = {
  checks: CheckListItem[];
  userCanEdit: boolean;
  existingFolders: string[];
  regionLabels: Record<string, string>;
};

export function ChecksList({
  checks,
  userCanEdit,
  existingFolders,
  regionLabels,
}: Props) {
  const regionLabel = (id: string) => regionLabels[id] ?? id;
  const groups = useMemo(() => groupChecksByFolder(checks), [checks]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.key, false])),
  );
  const [moveTarget, setMoveTarget] = useState<CheckListItem | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  function isCollapsed(key: string) {
    return collapsed[key] === true;
  }

  function toggleFolder(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !isCollapsed(key) }));
  }

  function expandAll() {
    setCollapsed(Object.fromEntries(groups.map((g) => [g.key, false])));
  }

  function collapseAll() {
    setCollapsed(Object.fromEntries(groups.map((g) => [g.key, true])));
  }

  const folderOptions = useMemo(() => {
    const fromChecks = checks
      .map((c) => normalizeFolder(c.folder))
      .filter((f): f is string => !!f);
    return [...new Set([...existingFolders, ...fromChecks])].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [checks, existingFolders]);

  async function moveToFolder(checkId: string, folderRaw: string | null) {
    setMovingId(checkId);
    setMoveError(null);
    try {
      const res = await fetch(`/api/checks/${checkId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: normalizeFolder(folderRaw) }),
      });
      if (!res.ok) throw new Error("Failed to move monitor");
      window.location.reload();
    } catch {
      setMoveError("Could not move the monitor. Please try again.");
      setMovingId(null);
    }
  }

  function folderKeyToValue(key: string): string | null {
    return key === UNCATEGORIZED_FOLDER ? null : key;
  }

  function handleDragStart(e: React.DragEvent, checkId: string) {
    e.dataTransfer.setData("text/plain", checkId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(checkId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleFolderDragOver(e: React.DragEvent, folderKey: string) {
    if (!userCanEdit || !draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(folderKey);
  }

  function handleFolderDrop(e: React.DragEvent, folderKey: string) {
    e.preventDefault();
    if (!userCanEdit) return;

    const checkId = e.dataTransfer.getData("text/plain") || draggingId;
    if (!checkId) return;

    const check = checks.find((c) => c.id === checkId);
    if (check && folderKeyFromCheck(check.folder) === folderKey) {
      handleDragEnd();
      return;
    }

    void moveToFolder(checkId, folderKeyToValue(folderKey));
    handleDragEnd();
  }

  return (
    <div className="space-y-4">
      {userCanEdit && (
        <p className="text-xs text-gw-fg-subtle">
          Drag monitors onto a folder to move them, or use the Move button.
        </p>
      )}

      {groups.length > 1 && (
        <div className="flex justify-end gap-3 text-sm">
          <button
            type="button"
            onClick={expandAll}
            className="text-indigo-600 hover:text-indigo-700"
          >
            Expand all
          </button>
          <span className="text-gw-fg-subtle">|</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-indigo-600 hover:text-indigo-700"
          >
            Collapse all
          </button>
        </div>
      )}

      {groups.map((group) => {
        const folded = isCollapsed(group.key);
        const downCount = group.checks.filter(
          (c) => c.results[0] && !c.results[0].success,
        ).length;

        return (
          <section
            key={group.key}
            onDragOver={(e) => handleFolderDragOver(e, group.key)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropTarget((prev) => (prev === group.key ? null : prev));
              }
            }}
            onDrop={(e) => handleFolderDrop(e, group.key)}
            className={`overflow-hidden rounded-2xl border bg-gw-surface shadow-sm transition-colors ${
              dropTarget === group.key
                ? "border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-200"
                : "border-gw-border"
            }`}
          >
            <div
              className="flex w-full flex-wrap items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-gw-surface-hover sm:gap-3 sm:px-5 sm:py-3.5"
            >
              <button
                type="button"
                onClick={() => toggleFolder(group.key)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-3"
              >
                {folded ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-gw-fg-subtle" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-gw-fg-subtle" />
                )}
                <Folder className="h-4 w-4 shrink-0 text-indigo-500" />
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gw-fg">
                    {group.label}
                  </span>
                  <span className="text-xs text-gw-fg-muted sm:hidden">
                    {group.checks.length} monitor
                    {group.checks.length !== 1 ? "s" : ""}
                    {downCount > 0 && (
                      <span className={`ml-2 font-medium ${dangerTextClass}`}>
                        · {downCount} down
                      </span>
                    )}
                  </span>
                </div>
                <span className="hidden text-xs text-gw-fg-muted sm:inline sm:shrink-0">
                  {group.checks.length} monitor
                  {group.checks.length !== 1 ? "s" : ""}
                  {downCount > 0 && (
                    <span className={`ml-2 font-medium ${dangerTextClass}`}>
                      · {downCount} down
                    </span>
                  )}
                </span>
              </button>
            </div>

            {!folded && (
              <ul className="divide-y divide-gw-border border-t border-gw-border">
                {group.checks.map((check) => {
                  const lastResult = check.results[0] ?? null;
                  const isUp = lastResult?.success ?? null;

                  return (
                    <li
                      key={check.id}
                      className={`group flex items-stretch transition-opacity ${
                        draggingId === check.id ? "opacity-40" : ""
                      } ${movingId === check.id ? "pointer-events-none" : ""}`}
                    >
                      <div className="flex min-w-0 flex-1 items-stretch">
                      {userCanEdit && (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, check.id)}
                          onDragEnd={handleDragEnd}
                          title="Drag to a folder"
                          className="flex cursor-grab items-center px-1.5 text-gw-fg-subtle transition-colors hover:text-gw-fg-muted active:cursor-grabbing sm:px-2"
                        >
                          <GripVertical className="h-4 w-4" aria-hidden />
                        </div>
                      )}
                      <Link
                        href={`/checks/${check.id}`}
                        draggable={false}
                        className="block min-w-0 flex-1 px-3 py-3 transition-colors hover:bg-gw-surface-hover sm:px-5 sm:py-4"
                        onClick={(e) => {
                          if (draggingId) e.preventDefault();
                        }}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                          <div className="flex min-w-0 items-start gap-3 sm:flex-1 sm:items-center">
                          <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0 sm:mt-0">
                            {isUp === null ? (
                              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gray-300" />
                            ) : isUp ? (
                              <>
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                              </>
                            ) : (
                              <>
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                              </>
                            )}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm font-semibold text-gw-fg group-hover:text-indigo-600">
                                {check.name}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-gw-surface-2 px-2 py-0.5 text-[11px] font-medium text-gw-fg-muted">
                                {check.method}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  check.isPublic
                                    ? "bg-indigo-50 text-indigo-600"
                                    : "bg-gw-surface-2 text-gw-fg-muted"
                                }`}
                              >
                                {check.isPublic ? "Public" : "Private"}
                              </span>
                            </div>
                            <p className="mt-0.5 break-all text-xs text-gw-fg-subtle sm:truncate">
                              {check.url}
                            </p>
                          </div>
                          </div>

                          <div className="hidden items-center gap-1.5 sm:flex">
                            {check.regions.slice(0, 3).map((r) => (
                              <span
                                key={r}
                                className="inline-flex items-center rounded-full bg-gw-surface-2 px-2 py-0.5 text-[11px] font-medium text-gw-fg-muted"
                              >
                                {regionLabel(r)}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-4 pl-0 sm:gap-6 sm:pl-0 sm:text-right">
                            <div>
                              <p className="text-xs text-gw-fg-subtle">Response</p>
                              <p className="text-sm font-medium tabular-nums text-gw-fg-muted">
                                {check.displayLatency != null
                                  ? `${check.displayLatency}ms`
                                  : "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gw-fg-subtle">Uptime</p>
                              <p
                                className={`text-sm font-semibold tabular-nums ${uptimePercentClass(check.uptime)}`}
                              >
                                {check.uptime}%
                              </p>
                            </div>
                            <div className="hidden sm:block">
                              <p className="text-xs text-gw-fg-subtle">Last check</p>
                              <p className="text-xs text-gw-fg-muted">
                                {lastResult
                                  ? formatDistanceToNow(
                                      new Date(lastResult.createdAt),
                                      { addSuffix: true },
                                    )
                                  : "Never"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                      </div>

                      {userCanEdit && (
                        <div className="flex shrink-0 items-center px-2 sm:pr-3">
                          <button
                            type="button"
                            aria-label={`Move ${check.name} to a folder`}
                            title="Move to folder"
                            onClick={() => {
                              setMoveError(null);
                              setMoveTarget(check);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gw-border bg-gw-surface px-2.5 py-1.5 text-xs font-medium text-gw-fg-muted transition-colors hover:bg-gw-surface-hover hover:text-gw-fg"
                          >
                            <FolderInput className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Move</span>
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {moveTarget && (
        <MoveFolderModal
          check={moveTarget}
          folders={folderOptions}
          busy={movingId === moveTarget.id}
          error={moveError}
          onClose={() => {
            if (movingId) return;
            setMoveTarget(null);
            setMoveError(null);
          }}
          onMove={(folder) => moveToFolder(moveTarget.id, folder)}
        />
      )}
    </div>
  );
}

function MoveFolderModal({
  check,
  folders,
  busy,
  error,
  onClose,
  onMove,
}: {
  check: CheckListItem;
  folders: string[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onMove: (folder: string | null) => void;
}) {
  const currentFolder = normalizeFolder(check.folder);
  const [selected, setSelected] = useState<string>(
    currentFolder ?? UNCATEGORIZED_FOLDER,
  );
  const [creating, setCreating] = useState(false);
  const [newFolder, setNewFolder] = useState("");

  const trimmedNew = newFolder.trim();
  const targetFolder = creating
    ? trimmedNew || null
    : selected === UNCATEGORIZED_FOLDER
      ? null
      : selected;
  const unchanged = (targetFolder ?? null) === (currentFolder ?? null);
  const canSubmit = !busy && !(creating && !trimmedNew) && !unchanged;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gw-fg">
              Move monitor
            </h3>
            <p className="mt-0.5 truncate text-sm text-gw-fg-muted">
              {check.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-gw-fg-subtle transition-colors hover:bg-gw-surface-hover hover:text-gw-fg-muted disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!creating ? (
          <div className="mt-5 space-y-1.5">
            <FolderOption
              label="Uncategorized"
              icon={false}
              active={selected === UNCATEGORIZED_FOLDER}
              onClick={() => setSelected(UNCATEGORIZED_FOLDER)}
            />
            {folders.map((folder) => (
              <FolderOption
                key={folder}
                label={folder}
                icon
                active={selected === folder}
                onClick={() => setSelected(folder)}
              />
            ))}

            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-gw-border px-3.5 py-2.5 text-sm font-medium text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
            >
              <Plus className="h-4 w-4" />
              Create new folder
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <label
              htmlFor="new-folder"
              className="mb-1.5 block text-sm font-medium text-gw-fg-muted"
            >
              New folder name
            </label>
            <input
              id="new-folder"
              type="text"
              autoFocus
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) onMove(targetFolder);
              }}
              placeholder="e.g. Production API"
              className="w-full rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm text-gw-fg placeholder:text-gw-fg-subtle transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewFolder("");
              }}
              className="mt-2 text-xs font-medium text-gw-fg-subtle hover:text-gw-fg-muted"
            >
              ← Back to existing folders
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-gw-border px-4 py-2 text-sm font-medium text-gw-fg-muted hover:bg-gw-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onMove(targetFolder)}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}

function FolderOption({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
        active
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-gw-border bg-gw-surface text-gw-fg-muted hover:bg-gw-surface-hover"
      }`}
    >
      {icon ? (
        <Folder className="h-4 w-4 shrink-0 text-indigo-500" />
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </button>
  );
}
