"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { REGISTRATION_DENIED_MESSAGE } from "@/lib/self-hosted-messages";

type InstanceInfo = {
  selfHosted: boolean;
  openRegistration: boolean;
  bootstrap: boolean;
  googleOAuth?: boolean;
  githubOAuth?: boolean;
};

const inputClass =
  "w-full rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm text-gw-fg placeholder:text-gw-fg-subtle focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition-all";

const btnPrimary =
  "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-3 w-full font-medium transition-all text-sm";

const btnOAuth =
  "flex w-full items-center justify-center gap-3 rounded-xl border border-gw-border bg-gw-surface px-4 py-2.5 text-sm font-medium text-gw-fg-muted transition-all hover:bg-gw-surface-2";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

type FieldErrors = Partial<Record<"name" | "email" | "password" | "confirmPassword", string>>;
type RegisterIssue = { path?: (string | number)[]; message: string };

export function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [instance, setInstance] = useState<InstanceInfo | null>(null);

  useEffect(() => {
    fetch("/api/instance")
      .then((r) => r.json())
      .then((data) => setInstance(data))
      .catch(() => setInstance({ selfHosted: false, openRegistration: true, bootstrap: false }));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errs: FieldErrors = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!email.trim()) errs.email = "Email is required";
    if (password.length < 6) errs.password = "Min 6 characters";
    if (password !== confirmPassword) errs.confirmPassword = "Passwords don't match";
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      });

      let data: { error?: string; issues?: RegisterIssue[] } = {};
      try { data = await res.json(); } catch { /* empty */ }

      if (!res.ok) {
        if (res.status === 400 && Array.isArray(data.issues)) {
          const fromApi: FieldErrors = {};
          for (const issue of data.issues) {
            const key = issue.path?.[0];
            if (key === "name" || key === "email" || key === "password" || key === "confirmPassword") {
              fromApi[key] = issue.message;
            }
          }
          setFieldErrors(fromApi);
        }
        setFormError(data.error ?? REGISTRATION_DENIED_MESSAGE);
        return;
      }

      setSuccess(true);
      const signResult = await signIn("credentials", { email: email.trim().toLowerCase(), password, redirect: false });
      if (signResult?.ok) {
        setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 2000);
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gw-fg">Check your email</h2>
        <p className="mt-2 text-sm text-gw-fg-muted">
          We sent a verification link to <strong>{email}</strong>. Please verify your email to complete setup.
        </p>
        <p className="mt-4 text-xs text-gw-fg-subtle">Redirecting to dashboard...</p>
      </div>
    );
  }

  // After the first owner exists, registration is invitation-only unless
  // OPEN_REGISTRATION=true on the instance.
  const invitationOnly =
    !instance?.bootstrap && !instance?.openRegistration;
  const showOAuth = instance?.googleOAuth || instance?.githubOAuth;

  return (
    <div>
      <h2 className="mb-1 text-center text-xl font-semibold text-gw-fg">
        {instance?.bootstrap ? "Set up your instance" : "Create your account"}
      </h2>
      <p className="mb-6 text-center text-sm text-gw-fg-muted">
        {instance?.bootstrap
          ? "Create the administrator account for this instance."
          : instance?.openRegistration
            ? "Sign up to create monitors and status pages."
            : "Register with the email address you were invited with."}
      </p>

      {invitationOnly && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-200">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>
            This is a private instance. You can only register if an administrator
            has invited your email to a team.
          </span>
        </div>
      )}

      {showOAuth && (
        <>
          <div className="space-y-3">
            {instance?.googleOAuth ? (
              <button type="button" className={btnOAuth} onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
                <GoogleIcon /> Continue with Google
              </button>
            ) : null}
            {instance?.githubOAuth ? (
              <button type="button" className={btnOAuth} onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
                <GitHubIcon /> Continue with GitHub
              </button>
            ) : null}
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gw-fg-subtle">OR</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {formError && (
          <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>
        )}
        <div>
          <label htmlFor="reg-name" className="mb-1.5 block text-sm font-medium text-gw-fg-muted">Name</label>
          <input id="reg-name" type="text" autoComplete="name" placeholder="Your name" value={name} onChange={(ev) => setName(ev.target.value)} className={inputClass} disabled={loading} />
          {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
        </div>
        <div>
          <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-gw-fg-muted">Email</label>
          <input id="reg-email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(ev) => setEmail(ev.target.value)} className={inputClass} disabled={loading} />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
        </div>
        <div>
          <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium text-gw-fg-muted">Password</label>
          <input id="reg-password" type="password" autoComplete="new-password" placeholder="Min 6 characters" value={password} onChange={(ev) => setPassword(ev.target.value)} className={inputClass} disabled={loading} />
          {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
        </div>
        <div>
          <label htmlFor="reg-confirm" className="mb-1.5 block text-sm font-medium text-gw-fg-muted">Confirm password</label>
          <input id="reg-confirm" type="password" autoComplete="new-password" placeholder="Repeat password" value={confirmPassword} onChange={(ev) => setConfirmPassword(ev.target.value)} className={inputClass} disabled={loading} />
          {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>}
        </div>
        <button type="submit" className={btnPrimary} disabled={loading}>{loading ? "Creating account..." : "Create account"}</button>
      </form>

      <p className="mt-6 text-center text-sm text-gw-fg-muted">
        Already have an account?{" "}
        <Link href="/" className="font-medium text-indigo-600 hover:text-indigo-500">Sign in</Link>
      </p>
    </div>
  );
}
