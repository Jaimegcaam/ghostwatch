import { NextResponse, type NextRequest } from "next/server";

import { getMainAppHosts } from "@/lib/status-domain-hosts";

/**
 * Custom domain routing (data-driven — no hostnames are hardcoded).
 *
 * A hostname registered on a status page in the DB is ALWAYS status-only:
 * public page at `/`, never dashboard/auth/APIs — even if it was mistakenly
 * set as APP_HOST or NEXTAUTH_URL.
 *
 * Main app host (from env): full dashboard + /s/<slug> for every public page.
 */

const ASSET_PATH_PREFIXES = [
  "/_next",
  "/favicon",
  "/uploads",
  "/api/uploads",
  "/api/status-page/resolve-host",
];

function slugFromStatusPath(pathname: string): string | null {
  if (!pathname.startsWith("/s/")) return null;
  const slug = pathname.slice(3).split("/")[0]?.trim();
  return slug || null;
}

function normalizeHost(host: string | null): string | null {
  if (!host) return null;
  return host.split(":")[0]?.toLowerCase() ?? null;
}

async function resolveSlugForHost(
  host: string,
  origin: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${origin}/api/status-page/resolve-host?host=${encodeURIComponent(host)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { slug?: string };
    return data.slug ?? null;
  } catch {
    return null;
  }
}

function rewriteCustomDomainNotFound(
  req: NextRequest,
  host: string,
  search: string,
) {
  const url = req.nextUrl.clone();
  url.pathname = "/domain";
  url.search = search;
  const res = NextResponse.rewrite(url);
  res.headers.set("x-ghostwatch-host", host);
  return res;
}

/** Status-page custom domain: only the bound public page, nothing else. */
function handleStatusPageCustomDomain(
  req: NextRequest,
  host: string,
  pathname: string,
  search: string,
  boundSlug: string,
) {
  if (pathname === "/" || pathname === "/domain") {
    const url = req.nextUrl.clone();
    url.pathname = `/s/${boundSlug}`;
    const res = NextResponse.rewrite(url);
    res.headers.set("x-ghostwatch-host", host);
    return res;
  }

  if (pathname.startsWith("/s/")) {
    const slug = slugFromStatusPath(pathname);
    if (slug === boundSlug) {
      return NextResponse.next();
    }
  }

  return rewriteCustomDomainNotFound(req, host, search);
}

export async function middleware(req: NextRequest) {
  const host = normalizeHost(req.headers.get("host"));
  if (!host) return NextResponse.next();

  const { pathname, search } = req.nextUrl;

  if (ASSET_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // DB lookup first: a status-page custom domain must never expose the dashboard.
  const boundSlug = await resolveSlugForHost(host, req.nextUrl.origin);
  if (boundSlug) {
    return handleStatusPageCustomDomain(
      req,
      host,
      pathname,
      search,
      boundSlug,
    );
  }

  const mainHosts = getMainAppHosts();
  if (mainHosts.has(host)) {
    return NextResponse.next();
  }

  return rewriteCustomDomainNotFound(req, host, search);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
