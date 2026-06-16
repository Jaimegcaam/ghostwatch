import { db } from "@/lib/db";
import { generateSlug } from "@/lib/utils";

export async function allocateUniqueProjectSlug(base: string): Promise<string> {
  let candidate = generateSlug(base) || "project";
  let n = 2;
  for (;;) {
    const taken = await db.project.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
    candidate = `${generateSlug(base) || "project"}-${n}`;
    n += 1;
    if (n > 1002) {
      throw new Error("Could not allocate a unique project slug");
    }
  }
}

/**
 * Ensures a team has at least one project (default workspace for monitors, status pages, etc.).
 */
export async function ensureDefaultProject(
  teamId: string,
  teamName: string,
  teamSlug: string,
) {
  const existing = await db.project.findFirst({
    where: { teamId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const slug = await allocateUniqueProjectSlug(`${teamSlug}-default`);
  return db.project.create({
    data: {
      teamId,
      name: teamName.trim() || "Default",
      slug,
    },
  });
}
