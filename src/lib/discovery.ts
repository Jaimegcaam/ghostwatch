export interface PathParamSuggestion {
  name: string;
  required: boolean;
  defaultValue?: string;
}

export interface CheckSuggestion {
  name: string;
  /** Full summary from the spec (can be long). */
  description?: string;
  path: string;
  baseUrl: string;
  url: string;
  method: string;
  expectedStatus: number;
  pathParams: PathParamSuggestion[];
}

type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

const HTTP_METHODS = new Set<HttpMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

type OpenAPIParameter = {
  name: string;
  in: string;
  required?: boolean;
  example?: unknown;
  schema?: { default?: unknown; example?: unknown };
};

type Operation = {
  summary?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
};

type OpenAPISpec = {
  openapi?: string;
  swagger?: string;
  servers?: Array<{ url: string }>;
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths?: Record<string, Record<string, Operation>>;
};

export async function discoverFromOpenAPI(specUrl: string): Promise<CheckSuggestion[]> {
  const response = await fetch(specUrl, {
    headers: { Accept: "application/json, application/yaml, */*" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch specification (${response.status}). Check the URL is publicly reachable from this server.`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();

  let spec: OpenAPISpec;
  try {
    if (
      contentType.includes("yaml") ||
      specUrl.match(/\.ya?ml$/i)
    ) {
      throw new Error(
        "YAML specifications are not supported yet. Use a JSON OpenAPI URL (e.g. /openapi.json or /v3/api-docs).",
      );
    }
    spec = JSON.parse(raw) as OpenAPISpec;
  } catch (err) {
    if (err instanceof Error && err.message.includes("YAML")) throw err;
    throw new Error("Invalid JSON — provide a valid OpenAPI/Swagger JSON document URL.");
  }

  const baseUrl = resolveBaseUrl(spec, specUrl);
  const suggestions: CheckSuggestion[] = [];

  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    return suggestions;
  }

  for (const [path, methods] of Object.entries(spec.paths)) {
    if (!methods || typeof methods !== "object") continue;

    for (const [method, operation] of Object.entries(methods)) {
      if (method.startsWith("x-") || method === "parameters") continue;

      const upperMethod = method.toUpperCase() as HttpMethod;
      if (!HTTP_METHODS.has(upperMethod)) continue;

      const op = operation as Operation;
      const description = op?.summary?.trim() || undefined;
      const operationId = op?.operationId?.trim();
      const name =
        operationId ||
        (description && description.length <= 80
          ? description
          : description
            ? `${description.slice(0, 77)}…`
            : null) ||
        `${upperMethod} ${path}`;

      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const pathParams = collectPathParams(normalizedPath, op);
      const fullUrl = `${baseUrl}${normalizedPath}`.replace(/([^:]\/)\/+/g, "$1");

      suggestions.push({
        name,
        description,
        path: normalizedPath,
        baseUrl,
        url: fullUrl,
        method: upperMethod,
        expectedStatus: upperMethod === "POST" ? 201 : 200,
        pathParams,
      });
    }
  }

  return suggestions;
}

function resolveBaseUrl(spec: OpenAPISpec, specUrl: string): string {
  const specOrigin = new URL(specUrl).origin;

  // OpenAPI 3.x — servers[]
  if (spec.servers?.length) {
    const serverUrl = spec.servers[0].url.trim();
    if (serverUrl.startsWith("http")) {
      return serverUrl.replace(/\/$/, "");
    }
    if (serverUrl.startsWith("/")) {
      return `${specOrigin}${serverUrl}`.replace(/\/$/, "");
    }
    return `${specOrigin}/${serverUrl}`.replace(/\/$/, "");
  }

  // Swagger 2.0 — host + basePath + schemes
  if (spec.swagger?.startsWith("2") && spec.host) {
    const scheme = spec.schemes?.[0] ?? new URL(specUrl).protocol.replace(":", "");
    const basePath = (spec.basePath ?? "").replace(/\/$/, "");
    return `${scheme}://${spec.host}${basePath}`.replace(/\/$/, "");
  }

  return specOrigin;
}

function collectPathParams(
  path: string,
  operation?: Operation,
): PathParamSuggestion[] {
  const names = new Set<string>();
  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    names.add(match[1]);
  }

  const opParams = (operation?.parameters ?? []).filter((p) => p.in === "path");

  return [...names].map((name) => {
    const spec = opParams.find((p) => p.name === name);
    const rawDefault = spec?.example ?? spec?.schema?.example ?? spec?.schema?.default;
    return {
      name,
      required: spec?.required ?? true,
      defaultValue:
        rawDefault !== undefined && rawDefault !== null
          ? String(rawDefault)
          : undefined,
    };
  });
}
