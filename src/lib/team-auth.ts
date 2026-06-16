import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TeamRole } from "@/generated/prisma/client";

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
};

export function hasMinRole(userRole: TeamRole, requiredRole: TeamRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canEdit(role: TeamRole): boolean {
  return hasMinRole(role, "EDITOR");
}

export function canAdmin(role: TeamRole): boolean {
  return hasMinRole(role, "ADMIN");
}

export async function getTeamMember(teamId: string, userId: string) {
  return db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { team: true },
  });
}

export async function requireTeamRole(
  teamId: string,
  userId: string,
  minimumRole: TeamRole,
) {
  const member = await getTeamMember(teamId, userId);
  if (!member) {
    throw new TeamAuthError("Not a member of this team", 403);
  }
  if (!hasMinRole(member.role, minimumRole)) {
    throw new TeamAuthError("Insufficient permissions", 403);
  }
  return member;
}

/**
 * Returns the user's teams. First team is the "default" active team.
 */
export async function getUserTeams(userId: string) {
  const memberships = await db.teamMember.findMany({
    where: { userId },
    include: { team: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships;
}

/**
 * Resolves teamId for a project and verifies the user has the required role.
 */
export async function requireProjectAccess(
  projectId: string,
  userId: string,
  minimumRole: TeamRole,
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, teamId: true },
  });
  if (!project) {
    throw new TeamAuthError("Project not found", 404);
  }
  const member = await requireTeamRole(project.teamId, userId, minimumRole);
  return { project, member };
}

/**
 * Get all project IDs accessible to a user (across all their teams).
 */
export async function getUserProjectIds(userId: string): Promise<string[]> {
  const memberships = await db.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const teamIds = memberships.map((m) => m.teamId);
  if (teamIds.length === 0) return [];

  const projects = await db.project.findMany({
    where: { teamId: { in: teamIds } },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

/**
 * Authenticate from the session and return user id, or throw.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new TeamAuthError("Unauthorized", 401);
  }
  return session.user.id;
}

export class TeamAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "TeamAuthError";
    this.status = status;
  }
}
