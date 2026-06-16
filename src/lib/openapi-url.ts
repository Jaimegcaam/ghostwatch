/** Path template segments like `/pet/{petId}`. */
export function extractPathParamNames(path: string): string[] {
  const names: string[] = [];
  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
}

export function resolvePathWithParams(
  path: string,
  params: Record<string, string>,
): string {
  return path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = params[name]?.trim();
    if (!value) return `{${name}}`;
    return encodeURIComponent(value);
  });
}

export function buildCheckUrl(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
): string {
  const resolvedPath = resolvePathWithParams(path, params);
  const base = baseUrl.replace(/\/$/, "");
  const segment = resolvedPath.startsWith("/") ? resolvedPath : `/${resolvedPath}`;
  return `${base}${segment}`.replace(/([^:]\/)\/+/g, "$1");
}

export function urlHasUnresolvedPathParams(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /\{[^}]+\}/.test(path);
  } catch {
    return /\{[^}]+\}/.test(url);
  }
}
