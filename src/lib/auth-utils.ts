import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const userInclude = {
  teamMemberships: {
    include: {
      team: {
        include: {
          projects: { orderBy: { createdAt: "asc" as const } },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

/** Load the signed-in user from the database, or null if not logged in. */
export async function getCurrentUser() {
  let session;
  try {
    session = await auth();
  } catch {
    return null;
  }
  if (!session?.user?.id) return null;

  return db.user.findUnique({
    where: { id: session.user.id },
    include: userInclude,
  });
}

/**
 * Dashboard guard: redirects to login, or signs out when the JWT is valid but
 * the user no longer exists (e.g. after switching to a fresh Postgres volume).
 */
export async function requireDashboardUser() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/");
  }

  if (!session?.user?.id) redirect("/");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: userInclude,
  });

  if (!user) {
    redirect("/api/auth/signout?callbackUrl=/");
  }

  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
