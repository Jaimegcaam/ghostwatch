import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Plus, Search, Activity } from "lucide-react";
import { ChecksList } from "@/components/checks/checks-list";
import { ACTIVE_TEAM_COOKIE, resolveActiveMembership } from "@/lib/active-team";
import { requireAuth } from "@/lib/auth-utils";
import { normalizeFolder } from "@/lib/check-folders";
import { computeDisplayLatency, latencyResultsInclude } from "@/lib/display-latency";
import { getRegionLabelMap } from "@/lib/regions";
import { db } from "@/lib/db";

export default async function ChecksPage() {
  const user = await requireAuth();

  const cookieStore = await cookies();
  const savedTeamId = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;
  const membership = resolveActiveMembership(user.teamMemberships, savedTeamId);

  if (!membership?.team.projects.length) {
    redirect("/dashboard");
  }

  const projectId = membership.team.projects[0].id;
  const userCanEdit =
    membership.role === "ADMIN" || membership.role === "EDITOR";

  const checks = await db.check.findMany({
    where: { projectId },
    include: {
      results: latencyResultsInclude(),
      _count: {
        select: { results: true },
      },
    },
    orderBy: [{ folder: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const checksWithUptime = await Promise.all(
    checks.map(async (check) => {
      const successCount = await db.checkResult.count({
        where: { checkId: check.id, success: true },
      });
      const totalCount = check._count.results;
      const uptime =
        totalCount === 0
          ? 100
          : Math.round((successCount / totalCount) * 10000) / 100;
      return { ...check, uptime, totalCount, successCount };
    }),
  );

  const existingFolders = [
    ...new Set(
      checksWithUptime
        .map((c) => normalizeFolder(c.folder))
        .filter((f): f is string => !!f),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const listItems = checksWithUptime.map((check) => ({
    id: check.id,
    name: check.name,
    url: check.url,
    method: check.method,
    isPublic: check.isPublic ?? true,
    regions: check.regions ?? [],
    folder: check.folder ?? null,
    uptime: check.uptime,
    displayLatency: computeDisplayLatency(
      check.results,
      check.regions ?? [],
    ),
    results: check.results.map((r) => ({
      success: r.success,
      responseTime: r.responseTime,
      createdAt: r.createdAt,
    })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gw-fg">
            Monitors
          </h1>
          <p className="mt-1 text-sm text-gw-fg-muted">
            Track the health and performance of your endpoints. Use folders to
            keep large lists organized.
          </p>
        </div>
        {userCanEdit && (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <Link
              href="/checks/discover"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm font-medium text-gw-fg-muted shadow-sm transition-all hover:bg-gw-surface-hover sm:w-auto"
            >
              <Search className="h-4 w-4 text-gw-fg-subtle" />
              <span className="sm:hidden">Import</span>
              <span className="hidden sm:inline">Import OpenAPI</span>
            </Link>
            <Link
              href="/checks/new"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              New Monitor
            </Link>
          </div>
        )}
      </div>

      {checksWithUptime.length === 0 ? (
        <div className="rounded-2xl border border-gw-border bg-gw-surface py-20 text-center shadow-sm">
          <Activity className="mx-auto h-10 w-10 text-gray-300" />
          <h3 className="mt-4 text-base font-semibold text-gw-fg">
            No monitors yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-gw-fg-muted">
            Create your first monitor to start tracking an endpoint, or import
            from an OpenAPI specification.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/checks/discover"
              className="inline-flex items-center gap-2 rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm font-medium text-gw-fg-muted shadow-sm transition-all hover:bg-gw-surface-hover"
            >
              <Search className="h-4 w-4 text-gw-fg-subtle" />
              Import OpenAPI
            </Link>
            <Link
              href="/checks/new"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              New Monitor
            </Link>
          </div>
        </div>
      ) : (
        <ChecksList
          checks={listItems}
          userCanEdit={userCanEdit}
          existingFolders={existingFolders}
          regionLabels={getRegionLabelMap()}
        />
      )}
    </div>
  );
}
