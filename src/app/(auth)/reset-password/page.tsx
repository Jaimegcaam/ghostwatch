"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent, Suspense } from "react";

const inputClass =
  "w-full rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all";

const btnPrimary =
  "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 w-full font-medium transition-all text-sm";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="py-4 text-center">
        <h2 className="text-lg font-semibold text-gw-fg">Invalid link</h2>
        <p className="mt-2 text-sm text-gw-fg-muted">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gw-fg">Password updated</h2>
        <p className="mt-2 text-sm text-gw-fg-muted">
          Your password has been reset successfully.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Sign in with your new password
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-center text-xl font-semibold text-gw-fg">
        Set new password
      </h2>
      <p className="mb-6 text-center text-sm text-gw-fg-muted">
        Choose a strong password for your account
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="rp-pass" className="mb-1.5 block text-sm font-medium text-gw-fg-muted">
            New password
          </label>
          <input
            id="rp-pass"
            type="password"
            autoComplete="new-password"
            placeholder="Min 6 characters"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className={inputClass}
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="rp-confirm" className="mb-1.5 block text-sm font-medium text-gw-fg-muted">
            Confirm password
          </label>
          <input
            id="rp-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(ev) => setConfirmPassword(ev.target.value)}
            className={inputClass}
            disabled={loading}
          />
        </div>

        <button type="submit" className={btnPrimary} disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-gw-fg-subtle">Loading...</div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
