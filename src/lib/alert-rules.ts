import { db } from "@/lib/db";

/** Link a monitor to all enabled alert channels in its project (idempotent). */
export async function linkCheckToProjectChannels(
  checkId: string,
  projectId: string,
) {
  const channels = await db.alertChannel.findMany({
    where: { projectId, enabled: true },
    select: { id: true },
  });
  if (channels.length === 0) return;

  await db.alertRule.createMany({
    data: channels.map((channel) => ({
      checkId,
      alertChannelId: channel.id,
      consecutiveFailures: 3,
      notifyOnRecovery: true,
      enabled: true,
    })),
    skipDuplicates: true,
  });
}

/** Link all enabled monitors in a project to a new alert channel (idempotent). */
export async function linkChannelToProjectChecks(
  alertChannelId: string,
  projectId: string,
) {
  const checks = await db.check.findMany({
    where: { projectId, enabled: true },
    select: { id: true },
  });
  if (checks.length === 0) return;

  await db.alertRule.createMany({
    data: checks.map((check) => ({
      checkId: check.id,
      alertChannelId,
      consecutiveFailures: 3,
      notifyOnRecovery: true,
      enabled: true,
    })),
    skipDuplicates: true,
  });
}
