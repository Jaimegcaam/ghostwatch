"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [state, setState] = useState<"loading" | "success" | "error" | "wrong-email">("loading");
  const [message, setMessage] = useState("");
  const [teamName, setTeamName] = useState("");
  const [expectedEmail, setExpectedEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("No invitation token provided.");
      return;
    }

    fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setState("success");
          setTeamName(data.teamName || "the team");
          setMessage(data.message || "You have been added to the team!");
        } else {
          if (res.status === 401) {
            const callbackUrl = `/invitations/accept?token=${token}`;
            router.push(`/?callbackUrl=${encodeURIComponent(callbackUrl)}`);
            return;
          }
          if (res.status === 403 && data.wrongEmail) {
            setState("wrong-email");
            setExpectedEmail(data.expectedEmail);
            setMessage(data.error);
            return;
          }
          setState("error");
          setMessage(data.error || "Failed to accept invitation.");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("An unexpected error occurred.");
      });
  }, [token, router]);

  if (state === "loading") {
    return (
      <div className="flex flex-col items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-gw-fg-muted text-sm">Processing your invitation...</p>
      </div>
    );
  }

  if (state === "wrong-email") {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 mb-4">
          <XCircle className="h-6 w-6 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gw-fg mb-2">Wrong Account</h2>
        <p className="text-gw-fg-muted text-sm text-center mb-2">{message}</p>
        <p className="text-gw-fg-subtle text-xs text-center mb-6">
          Sign out and log in with <strong className="text-gw-fg-muted">{expectedEmail}</strong> to accept this invitation.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: `/?callbackUrl=${encodeURIComponent(`/invitations/accept?token=${token}`)}` })}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out &amp; switch account
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 mb-4">
          <XCircle className="h-6 w-6 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-gw-fg mb-2">Invitation Error</h2>
        <p className="text-gw-fg-muted text-sm text-center mb-6">{message}</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 mb-4">
        <CheckCircle className="h-6 w-6 text-green-500" />
      </div>
      <h2 className="text-lg font-semibold text-gw-fg mb-2">Welcome to {teamName}!</h2>
      <p className="text-gw-fg-muted text-sm text-center mb-6">{message}</p>
      <button
        onClick={() => router.push("/dashboard")}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
          <p className="text-gw-fg-muted text-sm">Loading...</p>
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
