/** Cookie used to remember the active team across dashboard pages. */
export const ACTIVE_TEAM_COOKIE = "active-team-id";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** Persist the active team in a browser cookie (client-side only). */
export function persistActiveTeamCookie(teamId: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${ACTIVE_TEAM_COOKIE}=${encodeURIComponent(teamId)};path=/;max-age=${COOKIE_MAX_AGE_SEC}`;
}

type MembershipWithTeamId = {
  team: { id: string };
};

/**
 * Resolve the active team membership from the cookie, falling back to the first
 * membership when the cookie is missing or points at a team the user no longer
 * belongs to.
 */
export function resolveActiveMembership<T extends MembershipWithTeamId>(
  memberships: T[],
  savedTeamId?: string | null,
): T | null {
  if (memberships.length === 0) return null;
  if (savedTeamId) {
    const found = memberships.find((m) => m.team.id === savedTeamId);
    if (found) return found;
  }
  return memberships[0];
}

type TeamLike = { id: string };

/** Same as resolveActiveMembership but for the flattened TeamInfo list in the shell. */
export function resolveActiveTeam<T extends TeamLike>(
  teams: T[],
  savedTeamId?: string | null,
): T | null {
  if (teams.length === 0) return null;
  if (savedTeamId) {
    const found = teams.find((t) => t.id === savedTeamId);
    if (found) return found;
  }
  return teams[0];
}
