import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  type RateLimitResult,
} from "@/lib/rate-limit";

function isEnabled(): boolean {
  return process.env.AUTH_RATE_LIMIT !== "false";
}

function windowMs(): number {
  const raw = Number.parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? "900000", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 900_000;
}

/** Returns a 429 response when limited, otherwise null. */
export function enforceAuthRateLimit(
  request: Request,
  scope: string,
  limit: number,
): Response | null {
  if (!isEnabled()) return null;

  const ip = getClientIp(request);
  const result = checkRateLimit(`auth:${scope}:${ip}`, limit, windowMs());
  return result.ok ? null : rateLimitResponse(result);
}

/** Returns a 429 response when limited, otherwise null. */
export function enforceAuthEmailRateLimit(
  email: string,
  scope: string,
  limit: number,
): Response | null {
  if (!isEnabled()) return null;

  const normalized = email.trim().toLowerCase();
  const result = checkRateLimit(
    `auth:${scope}:email:${normalized}`,
    limit,
    windowMs(),
  );
  return result.ok ? null : rateLimitResponse(result);
}

export { getClientIp };
