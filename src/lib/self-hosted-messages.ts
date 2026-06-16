/**
 * Public auth messages safe to show in the browser (no secrets, no OWNER_EMAIL).
 */

export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

export const SIGN_IN_DENIED_MESSAGE =
  "Sign-in was denied. You do not have access to this instance.";

export const REGISTRATION_DENIED_MESSAGE =
  "You cannot create an account with this email. Contact the instance administrator.";

export const REGISTRATION_CLOSED_MESSAGE =
  "Registration is closed on this instance. Ask the administrator for an invitation.";

export type RegistrationDenialCode =
  | "bootstrap_denied"
  | "closed"
  | "no_invitation";

export function publicAuthMessage(code: RegistrationDenialCode): string {
  switch (code) {
    case "bootstrap_denied":
      return REGISTRATION_DENIED_MESSAGE;
    case "closed":
      return REGISTRATION_CLOSED_MESSAGE;
    case "no_invitation":
      return REGISTRATION_DENIED_MESSAGE;
    default:
      return INVALID_CREDENTIALS_MESSAGE;
  }
}
