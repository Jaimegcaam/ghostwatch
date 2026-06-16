"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Plus, Settings, ChevronRight } from "lucide-react";
import { resolveUploadUrl } from "@/lib/upload-url";

type Team = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  role: string;
  memberCount: number;
  projectCount: number;
  createdAt: string;
};

const roleBadgeStyles: Record<string, string> = {
  ADMIN: "bg-indigo-50 text-indigo-700",
  EDITOR: "bg-emerald-50 text-emerald-700",
  VIEWER: "bg-gw-surface-2 text-gw-fg-muted",
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => setTeams(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gw-fg">Teams</h1>
          <p className="mt-1 text-sm text-gw-fg-muted">
            Manage your teams and collaborate with others.
          </p>
        </div>
        <Link
          href="/teams/new"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          New Team
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-2xl border border-gw-border bg-gw-surface py-20 text-center shadow-sm">
          <Users className="mx-auto h-10 w-10 text-gray-300" />
          <h3 className="mt-4 text-base font-semibold text-gw-fg">No teams yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-gw-fg-muted">
            Create a team to start collaborating, or return to the dashboard.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/teams/new"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Create team
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl border border-gw-border px-4 py-2.5 text-sm font-medium text-gw-fg hover:bg-gw-surface-hover"
            >
              Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center gap-4 rounded-2xl border border-gw-border bg-gw-surface px-5 py-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
            >
              {team.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveUploadUrl(team.imageUrl) ?? ""} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-600">
                  {team.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gw-fg">{team.name}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${roleBadgeStyles[team.role] ?? roleBadgeStyles.VIEWER}`}>
                    {team.role}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gw-fg-subtle">
                  {team.memberCount} member{team.memberCount !== 1 ? "s" : ""} · {team.projectCount} project{team.projectCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {team.role === "ADMIN" && (
                  <Link
                    href={`/teams/${team.id}/settings`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gw-border px-3 py-1.5 text-xs font-medium text-gw-fg-muted transition-colors hover:bg-gw-surface-hover"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Settings
                  </Link>
                )}
                <Link
                  href={`/teams/${team.id}/members`}
                  className="inline-flex items-center gap-1 rounded-lg border border-gw-border px-3 py-1.5 text-xs font-medium text-gw-fg-muted transition-colors hover:bg-gw-surface-hover"
                >
                  Members
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
