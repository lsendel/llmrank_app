import type { Context, Next } from "hono";
import type { AppEnv } from "../index";

/**
 * Supported API versions
 */
export const API_VERSIONS = ["v1"] as const;
export type ApiVersion = (typeof API_VERSIONS)[number];

export const DEFAULT_API_VERSION: ApiVersion = "v1";
export const LATEST_API_VERSION: ApiVersion = "v1";

/**
 * Extract API version from request path or Accept header
 *
 * Priority:
 * 1. Explicit version in path (/api/v1/...)
 * 2. Accept header with version (application/vnd.llmrank.v1+json)
 * 3. Custom header (X-API-Version: v1)
 * 4. Default to latest version
 */
export function extractApiVersion(c: Context<AppEnv>): ApiVersion {
  const path = c.req.path;

  // Check path for version (e.g., /api/v1/projects)
  const pathMatch = path.match(/\/api\/(v\d+)\//);
  if (pathMatch && API_VERSIONS.includes(pathMatch[1] as ApiVersion)) {
    return pathMatch[1] as ApiVersion;
  }

  // Check custom header
  const headerVersion = c.req.header("X-API-Version");
  if (headerVersion && API_VERSIONS.includes(headerVersion as ApiVersion)) {
    return headerVersion as ApiVersion;
  }

  // Check Accept header for versioned media type
  const accept = c.req.header("Accept") ?? "";
  const acceptMatch = accept.match(/application\/vnd\.llmrank\.(v\d+)\+json/);
  if (acceptMatch && API_VERSIONS.includes(acceptMatch[1] as ApiVersion)) {
    return acceptMatch[1] as ApiVersion;
  }

  // Default to latest
  return LATEST_API_VERSION;
}

/**
 * Middleware to set API version in context
 */
export async function apiVersionMiddleware(c: Context<AppEnv>, next: Next) {
  const version = extractApiVersion(c);

  // Store version in context for use in route handlers
  c.set("apiVersion" as any, version);

  // Add version headers to response
  c.res.headers.set("X-API-Version", version);
  c.res.headers.set("X-Supported-Versions", API_VERSIONS.join(", "));

  await next();
}

/**
 * Require specific API version in route handler
 */
export function requireVersion(version: ApiVersion) {
  return async (c: Context<AppEnv>, next: Next) => {
    const requestVersion = extractApiVersion(c);

    if (requestVersion !== version) {
      return c.json(
        {
          error: {
            code: "VERSION_MISMATCH",
            message: `This endpoint requires API version ${version}, but ${requestVersion} was requested`,
            supportedVersions: API_VERSIONS,
          },
        },
        400,
      );
    }

    await next();
  };
}

/**
 * Mark an endpoint as deprecated
 *
 * @param sunsetDate - ISO date string when the endpoint will be removed
 * @param replacement - Path to replacement endpoint
 */
export function deprecatedEndpoint(sunsetDate: string, replacement?: string) {
  return async (c: Context<AppEnv>, next: Next) => {
    c.res.headers.set("Deprecation", "true");
    c.res.headers.set("Sunset", sunsetDate);

    if (replacement) {
      c.res.headers.set("Link", `<${replacement}>; rel="successor-version"`);
    }

    // Log deprecation usage
    const logger = c.get("logger");
    if (logger) {
      logger.warn("Deprecated API endpoint accessed", {
        path: c.req.path,
        method: c.req.method,
        sunsetDate,
        replacement,
      });
    }

    await next();
  };
}

/**
 * Version negotiation for breaking changes
 *
 * Allows different behavior based on requested API version
 */
export class VersionRouter {
  private handlers: Map<ApiVersion, (c: Context<AppEnv>) => Promise<Response>>;

  constructor() {
    this.handlers = new Map();
  }

  /**
   * Register handler for specific version
   */
  version(
    version: ApiVersion,
    handler: (c: Context<AppEnv>) => Promise<Response>,
  ): this {
    this.handlers.set(version, handler);
    return this;
  }

  /**
   * Execute appropriate handler based on request version
   */
  async handle(c: Context<AppEnv>): Promise<Response> {
    const requestedVersion = extractApiVersion(c);

    const handler = this.handlers.get(requestedVersion);
    if (!handler) {
      // Fallback to latest version if specific version not implemented
      const latestHandler = this.handlers.get(LATEST_API_VERSION);
      if (latestHandler) {
        return latestHandler(c);
      }

      return c.json(
        {
          error: {
            code: "VERSION_NOT_SUPPORTED",
            message: `API version ${requestedVersion} is not supported for this endpoint`,
            supportedVersions: Array.from(this.handlers.keys()),
          },
        },
        400,
      );
    }

    return handler(c);
  }
}
