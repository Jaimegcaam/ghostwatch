interface ChannelConfig {
  webhookUrl?: string;
  email?: string;
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
