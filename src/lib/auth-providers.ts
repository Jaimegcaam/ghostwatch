/** Master switch — OAuth buttons and providers stay off unless this is true. */
export function isOAuthEnabled(): boolean {
  return process.env.ENABLE_OAUTH === "true";
}

/** Google sign-in: ENABLE_OAUTH=true plus client id/secret. */
export function isGoogleOAuthEnabled(): boolean {
  return (
    isOAuthEnabled() &&
    !!(
      process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
    )
  );
}

/** GitHub sign-in: ENABLE_OAUTH=true plus client id/secret. */
export function isGitHubOAuthEnabled(): boolean {
  return (
    isOAuthEnabled() &&
    !!(process.env.GITHUB_ID?.trim() && process.env.GITHUB_SECRET?.trim())
  );
}
