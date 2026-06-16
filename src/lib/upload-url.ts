/** Public URL stored after upload (served via /api/uploads). */
export function uploadPublicPath(filename: string): string {
  return `/api/uploads/${filename}`;
}

/** Map a legacy Vercel Blob URL to our proxy route. */
function blobUrlToUploadPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("blob.vercel-storage.com")) return null;
    const name = parsed.pathname.split("/").filter(Boolean).pop();
    if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) return null;
    return uploadPublicPath(name);
  } catch {
    return null;
  }
}

/**
 * Normalize stored upload paths for display. Maps legacy `/uploads/…` to the
 * API route so logos work in Docker standalone and on custom domains.
 */
export function resolveUploadUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return blobUrlToUploadPath(trimmed) ?? trimmed;
  }
  if (trimmed.startsWith("/api/uploads/")) return trimmed;
  if (trimmed.startsWith("/uploads/")) {
    return `/api/uploads/${trimmed.slice("/uploads/".length)}`;
  }
  return trimmed;
}

/** Absolute URL for img src (browser or SSR with request origin). */
export function publicUploadSrc(
  url: string | null | undefined,
  origin?: string | null,
): string | null {
  const resolved = resolveUploadUrl(url);
  if (!resolved) return null;
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    return resolved;
  }
  if (origin) {
    return `${origin.replace(/\/$/, "")}${resolved}`;
  }
  return resolved;
}

/** Keep only values we should persist (API path or external https URL). */
export function normalizeStoredUploadUrl(
  url: string | null | undefined,
): string | null {
  const resolved = resolveUploadUrl(url);
  if (!resolved) return null;
  if (resolved.startsWith("/api/uploads/")) return resolved;
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    return resolved;
  }
  return null;
}
