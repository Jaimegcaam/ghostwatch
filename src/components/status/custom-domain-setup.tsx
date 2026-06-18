"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { inputField } from "@/lib/theme-classes";
import { DOMAIN_RE, normalizeCustomDomain } from "@/lib/status-domain-utils";

type DomainSetupInfo = {
  cnameTarget: string;
  mainHost: string;
  appOrigin: string;
  instructions: {
    cname: { type: string; name: string; host: string; value: string };
    note: string;
    reverseProxy: string;
  };
};

type VerifyResult = {
  verified: boolean;
  message: string;
  observedRecords: string[];
  domain: string;
};

type CustomDomainSetupProps = {
  statusPageId?: string;
  domains: string[];
  /** Domains already verified server-side (persisted state). */
  verifiedDomains?: string[];
  isPublic: boolean;
  onDomainsChange: (domains: string[]) => void;
  defaultPublicUrl: string;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gw-border px-2 py-1 text-xs text-gw-fg-muted transition-colors hover:bg-gw-surface-hover"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function CustomDomainSetup({
  statusPageId,
  domains,
  verifiedDomains = [],
  isPublic,
  onDomainsChange,
  defaultPublicUrl,
}: CustomDomainSetupProps) {
  const [setup, setSetup] = useState<DomainSetupInfo | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [verifyByDomain, setVerifyByDomain] = useState<
    Record<string, VerifyResult>
  >({});
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status-page/domain-setup")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSetup(data))
      .catch(() => {});
  }, []);

  const cnameTarget = setup?.cnameTarget ?? "your-ghostwatch-server.com";

  function addDomain() {
    const normalized = normalizeCustomDomain(newDomain);
    if (!normalized || !DOMAIN_RE.test(normalized)) {
      setAddError(
        "Enter a valid hostname like status.example.com (no protocol or path).",
      );
      return;
    }
    if (domains.some((d) => d.toLowerCase() === normalized)) {
      setAddError("That domain is already in the list.");
      return;
    }
    onDomainsChange([...domains, normalized]);
    setNewDomain("");
    setAddError(null);
  }

  function removeDomain(domain: string) {
    onDomainsChange(domains.filter((d) => d !== domain));
    setVerifyByDomain((prev) => {
      const next = { ...prev };
      delete next[domain];
      return next;
    });
  }

  const runVerify = useCallback(
    async (domain: string) => {
      if (!domain) return;
      setVerifyingDomain(domain);
      try {
        if (!statusPageId) {
          setVerifyByDomain((prev) => ({
            ...prev,
            [domain]: {
              verified: false,
              message: "Save the status page first, then verify DNS.",
              observedRecords: [],
              domain,
            },
          }));
          return;
        }
        const res = await fetch(
          `/api/status-page/${statusPageId}/verify-domain`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain }),
          },
        );
        const data = await res.json();
        setVerifyByDomain((prev) => ({
          ...prev,
          [domain]: {
            verified: Boolean(data.verified),
            message:
              data.error ??
              data.message ??
              (res.ok ? "OK" : "Verification failed"),
            observedRecords: data.observedRecords ?? [],
            domain,
          },
        }));
      } catch {
        setVerifyByDomain((prev) => ({
          ...prev,
          [domain]: {
            verified: false,
            message: "Could not run DNS check. Try again in a moment.",
            observedRecords: [],
            domain,
          },
        }));
      } finally {
        setVerifyingDomain(null);
      }
    },
    [statusPageId],
  );

  return (
    <div className="space-y-4 rounded-xl border border-gw-border bg-gw-surface-2 p-3 sm:p-4">
      <div>
        <p className="text-sm font-medium text-gw-fg">Public URLs</p>
        <p className="mt-1 text-xs text-gw-fg-muted">
          Built-in (always works):{" "}
          <a
            href={defaultPublicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {defaultPublicUrl}
          </a>
        </p>
        <p className="mt-2 text-xs text-gw-fg-subtle">
          Add one or more custom domains per status page (e.g. different products
          or Route&nbsp;53 zones). Each hostname must be unique across your
          instance.
        </p>
      </div>

      {!isPublic && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Turn on <strong>Public</strong> below so custom domains can serve this
          page.
        </p>
      )}

      {isPublic && (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gw-fg-muted">
              Custom domains
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => {
                  setNewDomain(e.target.value);
                  if (addError) setAddError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDomain();
                  }
                }}
                placeholder="status.example.com"
                className={inputField}
              />
              <button
                type="button"
                onClick={addDomain}
                disabled={!newDomain.trim()}
                className="inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-xl border border-gw-border bg-gw-surface px-3 py-2 text-sm font-medium text-gw-fg transition-colors hover:bg-gw-surface-hover disabled:opacity-50 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
            {addError && (
              <p className="mt-1.5 text-xs text-red-600">{addError}</p>
            )}
          </div>

          {domains.length > 0 && (
            <ul className="space-y-3">
              {domains.map((domain) => {
                const verify = verifyByDomain[domain];
                // Use the full hostname as the DNS record name: it is
                // unambiguous regardless of which zone hosts the record.
                const isVerified =
                  verify?.verified ?? verifiedDomains.includes(domain);
                return (
                  <li
                    key={domain}
                    className="rounded-lg border border-gw-border bg-gw-surface p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`https://${domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all font-mono text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            https://{domain}
                          </a>
                          {isVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                              <BadgeCheck className="h-3 w-3" />
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-gw-fg-subtle">
                          CNAME {domain} → {cnameTarget}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <CopyButton text={cnameTarget} />
                        <button
                          type="button"
                          onClick={() => removeDomain(domain)}
                          className="rounded-lg p-2 text-gw-fg-subtle transition-colors hover:bg-red-500/10 hover:text-red-600"
                          aria-label={`Remove ${domain}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={verifyingDomain === domain || !statusPageId}
                        onClick={() => runVerify(domain)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {verifyingDomain === domain ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Check DNS
                      </button>
                      {!statusPageId && (
                        <span className="text-[11px] text-gw-fg-subtle">
                          Save the page to verify
                        </span>
                      )}
                    </div>

                    {verify && (
                      <div
                        className={`mt-2 rounded-lg border px-2.5 py-2 text-xs ${
                          verify.verified
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                        }`}
                      >
                        <p>{verify.message}</p>
                        {verify.observedRecords.length > 0 && (
                          <ul className="mt-1 list-inside list-disc font-mono text-[10px] opacity-80">
                            {verify.observedRecords.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-2 border-t border-gw-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gw-fg-muted">
              DNS &amp; TLS (all domains)
            </p>
            <p className="text-xs leading-relaxed text-gw-fg-muted">
              {setup?.instructions.note ??
                "Point each domain to your Ghostwatch server with a CNAME (or A record to the same IP)."}
            </p>
            <p className="text-xs leading-relaxed text-gw-fg-muted">
              {setup?.instructions.reverseProxy ??
                "Configure your proxy / Ingress so every listed hostname terminates HTTPS and forwards to Ghostwatch."}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <span>CNAME target for all pages:</span>
              <div className="flex min-w-0 items-center gap-2">
              <code className="min-w-0 break-all rounded bg-gw-surface-2 px-1.5 py-0.5 font-mono">
                {cnameTarget}
              </code>
              <CopyButton text={cnameTarget} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
