import { Resend } from "resend";

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromEmail(): string {
  return process.env.FROM_EMAIL || "Ghostwatch <onboarding@resend.dev>";
}

export type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string }
  | { ok: true; skipped: true };

export async function sendTransactionalEmail(
  payload: EmailPayload,
): Promise<SendEmailResult> {
  const recipients = Array.isArray(payload.to)
    ? payload.to.join(", ")
    : payload.to;
  const resend = getResendClient();
  if (!resend) {
    console.log("──────────────────────────────────────");
    console.log("EMAIL (no RESEND_API_KEY configured):");
    console.log(`  To: ${recipients}`);
    console.log(`  Subject: ${payload.subject}`);
    console.log(`  Body: ${payload.html.replace(/<[^>]+>/g, "").trim().slice(0, 200)}`);
    console.log("──────────────────────────────────────");
    return { ok: true, skipped: true };
  }

  const from = getFromEmail();
  console.log(`[Email] Sending to ${recipients}: "${payload.subject}" (from: ${from})`);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });

    if (error) {
      console.error("[Email] Resend error:", error.message);
      return { ok: false, error: error.message };
    }

    console.log("[Email] Sent successfully, id:", data?.id);
    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    console.error("[Email] Failed to send:", err);
    return { ok: false, error: message };
  }
}

export function buildAlertEmailHtml(
  message: string,
  metadata: {
    checkName?: string;
    url?: string;
    status?: number | null;
    responseTime?: number | null;
    error?: string | null;
    region?: string;
    recovered?: boolean;
  },
): string {
  const isRecovery = !!metadata.recovered;
  const statusColor = isRecovery ? "#22c55e" : "#ef4444";
  const statusLabel = isRecovery ? "Recovered" : "Down";

  const details = [
    metadata.url
      ? `<tr><td style="color:#6b7280;padding:4px 12px 4px 0">URL</td><td style="color:#111827">${metadata.url}</td></tr>`
      : "",
    metadata.status != null
      ? `<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Status</td><td style="color:#111827">${metadata.status}</td></tr>`
      : "",
    metadata.responseTime != null
      ? `<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Response</td><td style="color:#111827">${metadata.responseTime}ms</td></tr>`
      : "",
    metadata.region
      ? `<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Region</td><td style="color:#111827">${metadata.region}</td></tr>`
      : "",
    metadata.error
      ? `<tr><td style="color:#6b7280;padding:4px 12px 4px 0">Error</td><td style="color:#111827">${metadata.error}</td></tr>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:40px 20px;">
      <div style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;color:${statusColor};background:${isRecovery ? "#f0fdf4" : "#fef2f2"};border:1px solid ${isRecovery ? "#bbf7d0" : "#fecaca"};margin-bottom:16px;">
        ● ${statusLabel}
      </div>
      <h2 style="color:#111827;font-size:18px;margin:0 0 8px;">${metadata.checkName ?? "Check"}</h2>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 20px;">${message}</p>
      ${details ? `<table style="font-size:13px;border-collapse:collapse;margin-bottom:20px;">${details}</table>` : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#9ca3af;font-size:11px;margin:0;">Ghostwatch Monitoring — ${new Date().toISOString()}</p>
    </div>
  `;
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${token}`;
  const result = await sendTransactionalEmail({
    to: email,
    subject: "Verify your Ghostwatch email",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111827; font-size: 20px; margin-bottom: 16px;">Verify your email</h2>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          Thanks for signing up for Ghostwatch. Click the button below to verify your email address.
        </p>
        <a href="${url}" style="display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Verify Email
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          If you didn't create an account, you can ignore this email. This link expires in 24 hours.
        </p>
      </div>
    `,
  });
  return result.ok;
}

export async function sendTeamInvitationEmail(
  email: string,
  token: string,
  teamName: string,
  inviterName: string,
) {
  const url = `${APP_URL}/invitations/accept?token=${token}`;
  const result = await sendTransactionalEmail({
    to: email,
    subject: `You've been invited to join ${teamName} on Ghostwatch`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111827; font-size: 20px; margin-bottom: 16px;">Team Invitation</h2>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          ${inviterName} has invited you to join <strong>${teamName}</strong> on Ghostwatch.
        </p>
        <a href="${url}" style="display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Accept Invitation
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          This invitation expires in 7 days. If you don't have an account, you'll be able to create one.
        </p>
      </div>
    `,
  });
  return result.ok;
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}`;
  const result = await sendTransactionalEmail({
    to: email,
    subject: "Reset your Ghostwatch password",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111827; font-size: 20px; margin-bottom: 16px;">Reset your password</h2>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset your password. Click the button below to choose a new one.
        </p>
        <a href="${url}" style="display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Reset Password
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
          If you didn't request a password reset, you can ignore this email. This link expires in 1 hour.
        </p>
      </div>
    `,
  });
  return result.ok;
}
