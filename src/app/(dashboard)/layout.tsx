import { cookies } from "next/headers";

import {
  DashboardShell,
  type DashboardUser,
  type TeamInfo,
} from "@/components/dashboard/dashboard-shell";
import { ACTIVE_TEAM_COOKIE, resolveActiveTeam } from "@/lib/active-team";
import { requireDashboardUser } from "@/lib/auth-utils";
import { ensureDefaultProject } from "@/lib/team-projects";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireDashboardUser();
  for (const membership of user.teamMemberships) {
    if (
      membership.team.projects.length === 0 &&
      (membership.role === "ADMIN" || membership.role === "EDITOR")
    ) {
      const project = await ensureDefaultProject(
        membership.team.id,
        membership.team.name,
        membership.team.slug,
      );
      membership.team.projects.push(project);
    }
  }

  const teams: TeamInfo[] = user.teamMemberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    slug: m.team.slug,
    imageUrl: m.team.imageUrl,
    role: m.role,
    projects: m.team.projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
    })),
  }));

  const cookieStore = await cookies();
  const savedTeamId = cookieStore.get(ACTIVE_TEAM_COOKIE)?.value;
  const activeTeam = resolveActiveTeam(teams, savedTeamId);

  const shellUser: DashboardUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    teams,
    activeTeamId: activeTeam?.id ?? "",
    activeTeamRole: activeTeam?.role ?? "VIEWER",
  };

  return <DashboardShell user={shellUser}>{children}</DashboardShell>;
}
