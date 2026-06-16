"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [errorMsg, setErrorMsg] = useState(
    !token ? "Invalid verification link." : ""
  );

  useEffect(() => {
    if (!token) return;

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json().catch(() => ({}));
          setErrorMsg(data.error || "Verification failed.");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("Something went wrong.");
        setStatus("error");
      });
  }, [token]);

  if (status === "loading") {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        <p className="text-sm text-gw-fg-muted">Verifying your email...</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gw-fg">Email verified</h2>
        <p className="mt-2 text-sm text-gw-fg-muted">
          Your email has been verified successfully.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gw-fg">Verification failed</h2>
      <p className="mt-2 text-sm text-gw-fg-muted">{errorMsg}</p>
      <Link
        href="/"
        className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
      >
        Go to sign in
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-gw-fg-subtle">Loading...</div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
