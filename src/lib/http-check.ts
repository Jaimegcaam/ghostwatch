/**
 * Shared HTTP check execution — used by in-process checks (self-hosted)
 * and by regional probe API routes (Vercel Edge).
 */

import { validateMonitorUrl } from "@/lib/url-security";

export interface HttpCheckInput {
  url: string;
  method: string;
  headers?: Record<string, string> | null;
  body?: string | null;
  timeout: number;
  expectedStatus: number;
}

export interface HttpCheckResult {
  status: number | null;
  responseTime: number;
  success: boolean;
  error: string | null;
}

export async function performHttpCheck(
  input: HttpCheckInput,
): Promise<HttpCheckResult> {
  const urlValidation = validateMonitorUrl(input.url);
  if (!urlValidation.ok) {
    return {
      status: null,
      responseTime: 0,
      success: false,
      error: urlValidation.error,
    };
  }

  const headers: Record<string, string> = input.headers
    ? (input.headers as Record<string, string>)
    : {};

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeout);
  const start = performance.now();

  try {
    const response = await fetch(urlValidation.url.toString(), {
      method: input.method,
      headers,
      body:
        input.method !== "GET" && input.method !== "HEAD"
          ? (input.body ?? undefined)
          : undefined,
      signal: controller.signal,
      redirect: "follow",
    });

    const responseTime = Math.round(performance.now() - start);
    const success = response.status === input.expectedStatus;

    return {
      status: response.status,
      responseTime,
      success,
      error: success
        ? null
        : `Expected status ${input.expectedStatus}, got ${response.status}`,
    };
  } catch (err) {
    const responseTime = Math.round(performance.now() - start);
    let error = "Unknown error";
    if (err instanceof DOMException && err.name === "AbortError") {
      error = `Timeout after ${input.timeout}ms`;
    } else if (err instanceof Error) {
      error = err.message;
    }
    return { status: null, responseTime, success: false, error };
  } finally {
    clearTimeout(timeoutId);
  }
}
