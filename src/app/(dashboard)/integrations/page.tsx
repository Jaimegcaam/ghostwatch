"use client";

import { useEffect, useState, useCallback } from "react";
import { useTeam } from "@/components/dashboard/team-context";
import {
  Bell,
  Check,
  Globe,
  Hash,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Settings,
  Trash2,
  X,
  ChevronRight,
} from "lucide-react";

type ChannelType = "SLACK" | "DISCORD" | "EMAIL" | "WEBHOOK";

interface AlertChannel {
  id: string;
  type: ChannelType;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

interface AlertRule {
  id: string;
  checkId: string;
  alertChannelId: string;
  consecutiveFailures: number;
  notifyOnRecovery: boolean;
  enabled: boolean;
  check: { id: string; name: string; url: string; enabled: boolean };
  alertChannel: { id: string; name: string; type: string };
}

interface CheckItem {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

/** Recipients for an email channel, supporting the legacy single-email format. */
function channelEmails(config: Record<string, unknown>): string[] {
  const emails = Array.isArray(config.emails)
    ? (config.emails as unknown[]).filter(
        (e): e is string => typeof e === "string",
      )
    : [];
  const legacy = typeof config.email === "string" ? [config.email] : [];
  return [...new Set([...emails, ...legacy])];
}

const CHANNEL_META: Record<
  ChannelType,
  {
    label: string;
    icon: typeof Hash;
    color: string;
    bg: string;
    desc: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  SLACK: {
    label: "Slack",
    icon: Hash,
    color: "text-purple-700",
    bg: "bg-purple-50",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    desc: "Send alerts to a Slack channel via webhook.",
  },
  DISCORD: {
    label: "Discord",
    icon: MessageCircle,
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    desc: "Post alert messages to a Discord channel.",
  },
  EMAIL: {
    label: "Email",
    icon: Mail,
    color: "text-amber-700",
    bg: "bg-amber-50",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    desc: "Receive alert notifications via email.",
  },
  WEBHOOK: {
    label: "Webhook",
    icon: Globe,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    desc: "Send JSON payloads to a custom endpoint.",
  },
};

const INPUT_CLS =
  "w-full rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm text-gw-fg transition-all placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";
const LABEL_CLS =
  "mb-1.5 block text-sm font-medium text-gw-fg-muted dark:text-gray-300";

export default function IntegrationsPage() {
  const { canEdit, teamId } = useTeam();
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [channelRules, setChannelRules] = useState<
    Record<string, AlertRule[]>
  >({});
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formStep, setFormStep] = useState<0 | 1 | 2>(0);
  const [formType, setFormType] = useState<ChannelType>("SLACK");
  const [formName, setFormName] = useState("");
  const [formWebhookUrl, setFormWebhookUrl] = useState("");
  const [formEmails, setFormEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  const [rulesModalChannel, setRulesModalChannel] =
    useState<AlertChannel | null>(null);
  const [modalRules, setModalRules] = useState<AlertRule[]>([]);
  const [allChecks, setAllChecks] = useState<CheckItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [ruleSaving, setRuleSaving] = useState<string | null>(null);

  const fetchChannels = useCallback(async (pid: string) => {
    const res = await fetch(`/api/alerts/channels?projectId=${pid}`);
    if (!res.ok) throw new Error("Failed to load channels");
    return (await res.json()) as AlertChannel[];
  }, []);

  const fetchRulesForChannel = useCallback(async (channelId: string) => {
    const res = await fetch(`/api/alerts/rules?channelId=${channelId}`);
    if (!res.ok) return [];
    return (await res.json()) as AlertRule[];
  }, []);

  const fetchAllRules = useCallback(
    async (chs: AlertChannel[]) => {
      const entries = await Promise.all(
        chs.map(async (ch) => {
          const rules = await fetchRulesForChannel(ch.id);
          return [ch.id, rules] as const;
        }),
      );
      setChannelRules(Object.fromEntries(entries));
    },
    [fetchRulesForChannel],
  );

  useEffect(() => {
    fetch("/api/instance")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.emailConfigured === "boolean") {
          setEmailConfigured(data.emailConfigured);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const projRes = await fetch(`/api/projects?teamId=${teamId}`);
        if (!projRes.ok) throw new Error("Failed to load projects");
        const projects = await projRes.json();
        const pid = projects[0]?.id;
        if (!pid) {
          setLoading(false);
          return;
        }
        setProjectId(pid);
        const chs = await fetchChannels(pid);
        setChannels(chs);
        await fetchAllRules(chs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchChannels, fetchAllRules]);

  function resetForm() {
    setFormStep(0);
    setFormName("");
    setFormWebhookUrl("");
    setFormEmails([]);
    setEmailInput("");
    setFormSecret("");
    setFormType("SLACK");
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function addEmails(raw: string) {
    const candidates = raw
      .split(/[,\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (candidates.length === 0) return;
    setFormEmails((prev) => {
      const next = [...prev];
      for (const c of candidates) {
        if (EMAIL_RE.test(c) && !next.includes(c)) next.push(c);
      }
      return next;
    });
    setEmailInput("");
  }

  function removeEmail(email: string) {
    setFormEmails((prev) => prev.filter((e) => e !== email));
  }

  function buildConfig(): Record<string, unknown> {
    switch (formType) {
      case "SLACK":
      case "DISCORD":
        return { webhookUrl: formWebhookUrl };
      case "EMAIL": {
        const pending = emailInput
          .split(/[,\s]+/)
          .map((e) => e.trim())
          .filter((e) => EMAIL_RE.test(e));
        return { emails: [...new Set([...formEmails, ...pending])] };
      }
      case "WEBHOOK":
        return {
          url: formWebhookUrl,
          ...(formSecret ? { secret: formSecret } : {}),
        };
    }
  }

  async function handleCreate() {
    if (!projectId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          name: formName.trim(),
          config: buildConfig(),
          projectId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create channel");
      }
      const chs = await fetchChannels(projectId);
      setChannels(chs);
      await fetchAllRules(chs);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create channel");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(channel: AlertChannel) {
    setTogglingId(channel.id);
    try {
      const res = await fetch(`/api/alerts/channels/${channel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !channel.enabled }),
      });
      if (!res.ok) throw new Error("Failed to update channel");
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channel.id ? { ...c, enabled: !c.enabled } : c,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update channel");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/alerts/channels/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete channel");
      setChannels((prev) => prev.filter((c) => c.id !== id));
      setChannelRules((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete channel");
    } finally {
      setDeletingId(null);
    }
  }

  async function openRulesModal(channel: AlertChannel) {
    setRulesModalChannel(channel);
    setModalLoading(true);
    try {
      const [rulesRes, checksRes] = await Promise.all([
        fetch(`/api/alerts/rules?channelId=${channel.id}`),
        fetch(`/api/checks?projectId=${projectId}`),
      ]);
      if (!rulesRes.ok || !checksRes.ok) throw new Error("Failed to load data");
      const rules = (await rulesRes.json()) as AlertRule[];
      const checks = (await checksRes.json()) as CheckItem[];
      setModalRules(rules);
      setAllChecks(checks);
    } catch {
      setError("Failed to load rules");
      setRulesModalChannel(null);
    } finally {
      setModalLoading(false);
    }
  }

  function closeRulesModal() {
    setRulesModalChannel(null);
    setModalRules([]);
    setAllChecks([]);
  }

  async function handleAddRule(checkId: string) {
    if (!rulesModalChannel) return;
    setRuleSaving(checkId);
    try {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkId,
          alertChannelId: rulesModalChannel.id,
          consecutiveFailures: 3,
          notifyOnRecovery: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create rule");
      const rule = (await res.json()) as AlertRule;
      setModalRules((prev) => [...prev, rule]);
      setChannelRules((prev) => ({
        ...prev,
        [rulesModalChannel.id]: [
          ...(prev[rulesModalChannel.id] ?? []),
          rule,
        ],
      }));
    } catch {
      setError("Failed to add rule");
    } finally {
      setRuleSaving(null);
    }
  }

  async function handleRemoveRule(rule: AlertRule) {
    setRuleSaving(rule.checkId);
    try {
      const res = await fetch(`/api/alerts/rules/${rule.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete rule");
      setModalRules((prev) => prev.filter((r) => r.id !== rule.id));
      setChannelRules((prev) => ({
        ...prev,
        [rule.alertChannelId]: (prev[rule.alertChannelId] ?? []).filter(
          (r) => r.id !== rule.id,
        ),
      }));
    } catch {
      setError("Failed to remove rule");
    } finally {
      setRuleSaving(null);
    }
  }

  async function handleUpdateRule(
    rule: AlertRule,
    update: Partial<{
      consecutiveFailures: number;
      notifyOnRecovery: boolean;
      enabled: boolean;
    }>,
  ) {
    setRuleSaving(rule.checkId);
    try {
      const res = await fetch(`/api/alerts/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      const updatedRule = { ...rule, ...update };
      setModalRules((prev) =>
        prev.map((r) => (r.id === rule.id ? updatedRule : r)),
      );
      setChannelRules((prev) => ({
        ...prev,
        [rule.alertChannelId]: (prev[rule.alertChannelId] ?? []).map((r) =>
          r.id === rule.id ? updatedRule : r,
        ),
      }));
    } catch {
      setError("Failed to update rule");
    } finally {
      setRuleSaving(null);
    }
  }

  async function handleAddAll() {
    if (!rulesModalChannel) return;
    const existingCheckIds = new Set(modalRules.map((r) => r.checkId));
    const missing = allChecks.filter((c) => !existingCheckIds.has(c.id));
    for (const check of missing) {
      await handleAddRule(check.id);
    }
  }

  async function handleRemoveAll() {
    for (const rule of [...modalRules]) {
      await handleRemoveRule(rule);
    }
  }

  async function handleTestChannel(channel: AlertChannel) {
    setTestingId(channel.id);
    setError(null);
    setTestSuccess(null);
    try {
      const res = await fetch(`/api/alerts/channels/${channel.id}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Test alert failed");
      }
      setTestSuccess(
        channel.type === "EMAIL"
          ? `Test email sent to ${channelEmails(channel.config).join(", ")}`
          : `Test alert sent to ${channel.name}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test alert failed");
    } finally {
      setTestingId(null);
    }
  }

  const configValid =
    formName.trim().length > 0 &&
    (((formType === "SLACK" ||
      formType === "DISCORD" ||
      formType === "WEBHOOK") &&
      formWebhookUrl.trim().length > 0) ||
      (formType === "EMAIL" &&
        (formEmails.length > 0 || EMAIL_RE.test(emailInput.trim()))));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!emailConfigured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Email not configured on this server.</strong> Add{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">
            RESEND_API_KEY
          </code>{" "}
          (and optionally <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">FROM_EMAIL</code>) to your{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">.env</code>{" "}
          file, then restart the app. Until then, alert emails are only logged to the server console.
        </div>
      )}

      {testSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/100/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {testSuccess}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gw-fg dark:text-white">
            Integrations
          </h1>
          <p className="mt-1 text-sm text-gw-fg-muted dark:text-gw-fg-subtle">
            Manage alert channels and rules for your monitors.
          </p>
        </div>
        {formStep === 0 && (
          <button
            type="button"
            onClick={() => setFormStep(1)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Add Integration
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/100/10 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 rounded-lg p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {formStep >= 1 && (
        <div className="rounded-2xl border border-gw-border bg-gw-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-gw-border px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-gw-fg">
                {formStep === 1
                  ? "Step 1 — Choose channel type"
                  : "Step 2 — Configure channel"}
              </h2>
              <p className="text-sm text-gw-fg-subtle">
                {formStep === 1
                  ? "Select the service you want to send alerts to."
                  : `Set up your ${CHANNEL_META[formType].label} integration.`}
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg p-1.5 text-gw-fg-subtle transition-colors hover:bg-gw-surface-hover hover:text-gw-fg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {formStep === 1 && (
            <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
              {(Object.keys(CHANNEL_META) as ChannelType[]).map((type) => {
                const meta = CHANNEL_META[type];
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setFormType(type);
                      setFormStep(2);
                    }}
                    className="group flex items-center gap-4 rounded-xl border border-gw-border bg-gw-surface p-4 text-left transition-all hover:border-indigo-300 hover:shadow-md"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}
                    >
                      <Icon className={`h-5 w-5 ${meta.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gw-fg">
                        {meta.label}
                      </p>
                      <p className="text-xs text-gw-fg-subtle">{meta.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-indigo-500" />
                  </button>
                );
              })}
            </div>
          )}

          {formStep === 2 && (
            <div className="space-y-4 p-6">
              <div>
                <label htmlFor="channel-name" className={LABEL_CLS}>
                  Channel Name
                </label>
                <input
                  id="channel-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Production Alerts"
                  className={INPUT_CLS}
                />
              </div>

              {(formType === "SLACK" || formType === "DISCORD") && (
                <div>
                  <label htmlFor="webhook-url" className={LABEL_CLS}>
                    Webhook URL
                  </label>
                  <input
                    id="webhook-url"
                    type="url"
                    value={formWebhookUrl}
                    onChange={(e) => setFormWebhookUrl(e.target.value)}
                    placeholder={
                      formType === "SLACK"
                        ? "https://hooks.slack.com/services/..."
                        : "https://discord.com/api/webhooks/..."
                    }
                    className={INPUT_CLS}
                  />
                </div>
              )}

              {formType === "EMAIL" && (
                <div>
                  <label htmlFor="email-address" className={LABEL_CLS}>
                    Email Addresses
                  </label>
                  {formEmails.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {formEmails.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                        >
                          {email}
                          <button
                            type="button"
                            onClick={() => removeEmail(email)}
                            className="rounded-full p-0.5 text-indigo-400 transition-colors hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900"
                            aria-label={`Remove ${email}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    id="email-address"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addEmails(emailInput);
                      }
                    }}
                    onBlur={() => addEmails(emailInput)}
                    placeholder="alerts@example.com"
                    className={INPUT_CLS}
                  />
                  <p className="mt-1.5 text-xs text-gw-fg-subtle">
                    Press Enter or comma to add multiple recipients.
                  </p>
                </div>
              )}

              {formType === "WEBHOOK" && (
                <>
                  <div>
                    <label htmlFor="webhook-endpoint" className={LABEL_CLS}>
                      Endpoint URL
                    </label>
                    <input
                      id="webhook-endpoint"
                      type="url"
                      value={formWebhookUrl}
                      onChange={(e) => setFormWebhookUrl(e.target.value)}
                      placeholder="https://api.example.com/webhooks/alerts"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label htmlFor="webhook-secret" className={LABEL_CLS}>
                      Secret Header{" "}
                      <span className="font-normal text-gw-fg-subtle">
                        (optional)
                      </span>
                    </label>
                    <input
                      id="webhook-secret"
                      type="text"
                      value={formSecret}
                      onChange={(e) => setFormSecret(e.target.value)}
                      placeholder="X-Webhook-Secret value"
                      className={INPUT_CLS}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormStep(1)}
                  className="rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm font-medium text-gw-fg-muted shadow-sm transition-all hover:bg-gw-surface-hover"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!configValid || saving}
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Channel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {channels.length === 0 ? (
        <div className="rounded-2xl border border-gw-border bg-gw-surface py-20 text-center shadow-sm">
          <Bell className="mx-auto h-10 w-10 text-gray-300" />
          <h3 className="mt-4 text-base font-semibold text-gw-fg">
            No integrations configured
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-gw-fg-muted">
            Add an alert channel to get notified when your monitors fail or
            recover.
          </p>
          {formStep === 0 && (
            <button
              type="button"
              onClick={() => setFormStep(1)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Add Integration
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {channels.map((channel) => {
            const meta = CHANNEL_META[channel.type];
            const Icon = meta.icon;
            const rules = channelRules[channel.id] ?? [];

            return (
              <div
                key={channel.id}
                className="rounded-2xl border border-gw-border bg-gw-surface shadow-sm transition-all hover:border-indigo-500/30"
              >
                <div className="flex items-start gap-4 px-5 pt-5 pb-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}
                  >
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="truncate text-sm font-semibold text-gw-fg">
                        {channel.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badgeBg} ${meta.badgeText}`}
                      >
                        {meta.label}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          channel.enabled
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-gw-surface-2 text-gw-fg-muted"
                        }`}
                      >
                        {channel.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gw-fg-subtle">
                      {channel.type === "EMAIL"
                        ? channelEmails(channel.config).join(", ")
                        : (channel.config as Record<string, string>)
                            .webhookUrl ??
                          (channel.config as Record<string, string>).url ??
                          ""}
                    </p>
                  </div>
                </div>

                {rules.length > 0 && (
                  <div className="px-5 pb-3">
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gw-fg-subtle">
                      Linked checks
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {rules.slice(0, 6).map((rule) => (
                        <span
                          key={rule.id}
                          className="inline-flex items-center rounded-full bg-gw-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-gw-fg-muted"
                        >
                          {rule.check?.name ?? rule.checkId}
                        </span>
                      ))}
                      {rules.length > 6 && (
                        <span className="inline-flex items-center rounded-full bg-gw-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-gw-fg-subtle">
                          +{rules.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 border-t border-gw-border px-5 py-3 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => openRulesModal(channel)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gw-fg-muted transition-colors hover:bg-gw-surface-hover hover:text-gw-fg dark:text-gw-fg-subtle dark:hover:bg-gray-800 dark:hover:text-white"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Manage Rules
                  </button>

                  {canEdit && (
                    <button
                      type="button"
                      disabled={testingId === channel.id || !channel.enabled}
                      onClick={() => handleTestChannel(channel)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
                    >
                      {testingId === channel.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Mail className="h-3.5 w-3.5" />
                      )}
                      Send test
                    </button>
                  )}

                  <div className="flex-1" />

                  <button
                    type="button"
                    disabled={togglingId === channel.id}
                    onClick={() => handleToggle(channel)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2 disabled:opacity-50 ${
                      channel.enabled ? "bg-indigo-600" : "bg-gray-200"
                    }`}
                    aria-label={
                      channel.enabled ? "Disable channel" : "Enable channel"
                    }
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-gw-surface shadow ring-0 transition-transform duration-200 ${
                        channel.enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    disabled={deletingId === channel.id}
                    onClick={() => handleDelete(channel.id)}
                    className="rounded-lg p-2 text-gw-fg-subtle transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label="Delete channel"
                  >
                    {deletingId === channel.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rulesModalChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeRulesModal}
          />
          <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-gw-border bg-gw-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-gw-border px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-gw-fg">
                  Manage Rules
                </h2>
                <p className="text-sm text-gw-fg-subtle">
                  Configure alert rules for{" "}
                  <span className="font-medium text-gw-fg-muted">
                    {rulesModalChannel.name}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeRulesModal}
                className="rounded-lg p-1.5 text-gw-fg-subtle transition-colors hover:bg-gw-surface-hover hover:text-gw-fg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-gw-border px-6 py-3">
                  <button
                    type="button"
                    onClick={handleAddAll}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Add All
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveAll}
                    disabled={modalRules.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove All
                  </button>
                  <div className="flex-1" />
                  <span className="text-xs text-gw-fg-subtle">
                    {modalRules.length} / {allChecks.length} checks linked
                  </span>
                </div>

                <div className="flex-1 divide-y divide-gw-border overflow-y-auto">
                  {allChecks.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <p className="text-sm text-gw-fg-subtle">
                        No checks found. Create a monitor first.
                      </p>
                    </div>
                  ) : (
                    allChecks.map((check) => {
                      const rule = modalRules.find(
                        (r) => r.checkId === check.id,
                      );
                      const isLinked = !!rule;
                      const isBusy = ruleSaving === check.id;

                      return (
                        <div
                          key={check.id}
                          className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-gw-surface-hover"
                        >
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              isLinked
                                ? handleRemoveRule(rule)
                                : handleAddRule(check.id)
                            }
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all disabled:opacity-50 ${
                              isLinked
                                ? "border-indigo-600 bg-indigo-600"
                                : "border-gray-300 bg-gw-surface hover:border-indigo-400"
                            }`}
                          >
                            {isBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin text-white" />
                            ) : isLinked ? (
                              <Check className="h-3 w-3 text-white" />
                            ) : null}
                          </button>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gw-fg">
                              {check.name}
                            </p>
                            <p className="truncate text-xs text-gw-fg-subtle">
                              {check.url}
                            </p>
                          </div>

                          {isLinked && (
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <label
                                  htmlFor={`failures-${check.id}`}
                                  className="text-[11px] font-medium text-gw-fg-muted"
                                >
                                  Failures
                                </label>
                                <input
                                  id={`failures-${check.id}`}
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={rule.consecutiveFailures}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val) && val >= 1) {
                                      handleUpdateRule(rule, {
                                        consecutiveFailures: val,
                                      });
                                    }
                                  }}
                                  className="w-14 rounded-lg border border-gw-border bg-gw-surface px-2 py-1 text-center text-xs text-gw-fg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 focus:outline-none"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateRule(rule, {
                                    notifyOnRecovery: !rule.notifyOnRecovery,
                                  })
                                }
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                                  rule.notifyOnRecovery
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                    : "bg-gw-surface-2 text-gw-fg-muted"
                                }`}
                                title="Notify on recovery"
                              >
                                <Bell className="h-3 w-3" />
                                Recovery
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
