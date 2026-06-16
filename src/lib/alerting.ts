import { db } from "@/lib/db";
import {
  buildAlertEmailHtml,
  isEmailConfigured,
  sendTransactionalEmail,
} from "@/lib/email";
import type { AlertChannel, ChannelType, Prisma } from "@/generated/prisma/client";

interface AlertMetadata {
  checkId?: string;
  checkName?: string;
  url?: string;
  status?: number | null;
  responseTime?: number | null;
  error?: string | null;
  isAnomaly?: boolean;
  zScore?: number;
  region?: string;
  recovered?: boolean;
  [key: string]: unknown;
}

interface ChannelConfig {
  webhookUrl?: string;
  /** Legacy single-recipient field. */
  email?: string;
  /** One or more alert recipients. */
  emails?: string[];
  url?: string;
  [key: string]: unknown;
}

/** Recipients for an email channel, supporting the legacy single-email format. */
export function emailRecipients(config: ChannelConfig): string[] {
  const list = Array.isArray(config.emails) ? config.emails : [];
  const merged = [...list, ...(config.email ? [config.email] : [])]
    .map((e) => e.trim())
    .filter(Boolean);
  return [...new Set(merged)];
}

async function sendSlack(config: ChannelConfig, message: string, metadata: AlertMetadata) {
  if (!config.webhookUrl) throw new Error("Slack webhook URL not configured");

  const color = metadata.recovered ? "#22c55e" : metadata.isAnomaly ? "#f59e0b" : "#ef4444";
  const emoji = metadata.recovered ? ":white_check_mark:" : ":rotating_light:";

  await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: message,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} *Ghostwatch ${metadata.recovered ? "Recovery" : "Alert"}*\n${message}`,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: [
                metadata.url ? `Endpoint: ${metadata.url}` : null,
                metadata.status != null ? `Status: ${metadata.status}` : null,
                metadata.responseTime != null ? `Response: ${metadata.responseTime}ms` : null,
                metadata.region ? `Region: ${metadata.region}` : null,
              ]
                .filter(Boolean)
                .join(" | ") || "No details",
            },
          ],
        },
      ],
      attachments: [{ color, fallback: message }],
    }),
  });
}

async function sendDiscord(config: ChannelConfig, message: string, metadata: AlertMetadata) {
  if (!config.webhookUrl) throw new Error("Discord webhook URL not configured");

  const color = metadata.recovered ? 0x22c55e : metadata.isAnomaly ? 0xf59e0b : 0xef4444;

  await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: metadata.recovered ? "Ghostwatch Recovery" : "Ghostwatch Alert",
          description: message,
          color,
          fields: [
            { name: "URL", value: metadata.url ?? "N/A", inline: true },
            { name: "Status", value: String(metadata.status ?? "N/A"), inline: true },
            { name: "Response", value: `${metadata.responseTime ?? "N/A"}ms`, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
}

async function sendEmailAlert(config: ChannelConfig, message: string, metadata: AlertMetadata) {
  const to = emailRecipients(config);
  if (to.length === 0) throw new Error("Email address not configured");

  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured on this server (set RESEND_API_KEY in the environment)",
    );
  }

  const isRecovery = !!metadata.recovered;
  const subject = isRecovery
    ? `✅ Recovered: ${metadata.checkName ?? "Check"}`
    : `🚨 Alert: ${metadata.checkName ?? "Check"} is down`;

  const html = buildAlertEmailHtml(message, metadata);
  const result = await sendTransactionalEmail({ to, subject, html });

  if (!result.ok) {
    throw new Error("error" in result ? result.error : "Failed to send alert email");
  }
  if ("skipped" in result && result.skipped) {
    throw new Error(
      "Email is not configured on this server (set RESEND_API_KEY in the environment)",
    );
  }
}

async function sendWebhook(config: ChannelConfig, message: string, metadata: AlertMetadata) {
  const url = config.url ?? config.webhookUrl;
  if (!url) throw new Error("Webhook URL not configured");

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, metadata, sentAt: new Date().toISOString() }),
  });
}

const senders: Record<ChannelType, typeof sendSlack> = {
  SLACK: sendSlack,
  DISCORD: sendDiscord,
  EMAIL: sendEmailAlert,
  WEBHOOK: sendWebhook,
};

async function dispatchToChannel(
  channel: AlertChannel,
  message: string,
  metadata: AlertMetadata,
  options?: { throwOnError?: boolean },
): Promise<boolean> {
  const config = channel.config as ChannelConfig;
  const sender = senders[channel.type];

  let sent = false;
  try {
    await sender(config, message, metadata);
    sent = true;
  } catch (err) {
    console.error(
      `Failed to send ${channel.type} alert to "${channel.name}":`,
      err instanceof Error ? err.message : err,
    );
    if (options?.throwOnError) {
      throw err;
    }
  }

  await db.alert.create({
    data: {
      alertChannelId: channel.id,
      message,
      metadata: {
        ...(metadata as object),
        delivered: sent,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return sent;
}

export async function sendAlertToChannel(
  channelId: string,
  message: string,
  metadata: AlertMetadata = {},
  options?: { throwOnError?: boolean },
): Promise<boolean> {
  const channel = await db.alertChannel.findUnique({ where: { id: channelId } });
  if (!channel || !channel.enabled) return false;
  return dispatchToChannel(channel, message, metadata, options);
}

export async function sendRecoveryToChannel(
  channelId: string,
  message: string,
  metadata: AlertMetadata = {},
) {
  await sendAlertToChannel(channelId, message, { ...metadata, recovered: true });
}

export async function sendAlerts(
  projectId: string,
  message: string,
  metadata: AlertMetadata = {},
) {
  const channels = await db.alertChannel.findMany({
    where: { projectId, enabled: true },
  });

  const results = await Promise.allSettled(
    channels.map((channel: AlertChannel) => dispatchToChannel(channel, message, metadata)),
  );

  return results;
}
