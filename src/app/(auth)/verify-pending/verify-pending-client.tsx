"use client";

import Link from "next/link";
import { useState } from "react";

export function VerifyPendingClient({ email }: { email: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function resend() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not resend verification email.");
        return;
      }
      setMessage("Verification email sent. Check your inbox.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
        <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gw-fg">Verify your email</h2>
      <p className="mt-2 text-sm text-gw-fg-muted">
        We sent a verification link to <strong>{email}</strong>.
        Confirm your email to access the dashboard.
      </p>

      {message && (
        <p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={resend}
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Sending..." : "Resend verification email"}
      </button>

      <p className="mt-6 text-sm text-gw-fg-muted">
        Wrong account?{" "}
        <Link href="/api/auth/signout?callbackUrl=/" className="font-medium text-indigo-600 hover:text-indigo-500">
          Sign out
        </Link>
      </p>
    </div>
  );
}
