"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { persistActiveTeamCookie } from "@/lib/active-team";

type NewTeamFormProps = {
  hasExistingTeams: boolean;
};

export function NewTeamForm({ hasExistingTeams }: NewTeamFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelHref = hasExistingTeams ? "/dashboard" : "/teams";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create team");
      persistActiveTeamCookie(data.id);
      router.push(hasExistingTeams ? "/dashboard" : "/teams");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href={cancelHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gw-fg-muted hover:text-gw-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          {hasExistingTeams ? "Back to dashboard" : "Back to teams"}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gw-fg">
          Create Team
        </h1>
        <p className="mt-1 text-sm text-gw-fg-muted">
          {hasExistingTeams
            ? "Add another team to organize projects separately. You can leave this page anytime without creating one."
            : "Create your first team to start monitoring. You can invite members later."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-gw-border bg-gw-surface p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-gw-fg-muted"
          >
            Team Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Engineering"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gw-fg placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
            disabled={saving}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            href={cancelHref}
            className="inline-flex items-center justify-center rounded-xl border border-gw-border px-4 py-2.5 text-sm font-medium text-gw-fg transition-colors hover:bg-gw-surface-hover"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Team"}
          </button>
        </div>
      </form>
    </div>
  );
}
