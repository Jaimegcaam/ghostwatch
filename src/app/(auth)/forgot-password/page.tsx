"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const inputClass =
  "w-full rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all";

const btnPrimary =
  "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 w-full font-medium transition-all text-sm";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrim }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong.");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
          <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gw-fg">Check your email</h2>
        <p className="mt-2 text-sm text-gw-fg-muted">
          If an account exists for <strong>{email}</strong>, we sent a password reset link. Check your inbox.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-center text-xl font-semibold text-gw-fg">
        Reset your password
      </h2>
      <p className="mb-6 text-center text-sm text-gw-fg-muted">
        Enter your email and we&apos;ll send you a reset link
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="fp-email" className="mb-1.5 block text-sm font-medium text-gw-fg-muted">
            Email address
          </label>
          <input
            id="fp-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className={inputClass}
            disabled={loading}
          />
        </div>

        <button type="submit" className={btnPrimary} disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gw-fg-muted">
        Remember your password?{" "}
        <Link href="/" className="font-medium text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
      </p>
    </div>
  );
}
