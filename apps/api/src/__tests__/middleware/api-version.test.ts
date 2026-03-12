import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import {
  extractApiVersion,
  apiVersionMiddleware,
  requireVersion,
  deprecatedEndpoint,
  VersionRouter,
  API_VERSIONS,
  LATEST_API_VERSION,
} from "../../middleware/api-version";

describe("extractApiVersion", () => {
  function createContext(
    path: string,
    headers: Record<string, string> = {},
  ): any {
    return {
      req: {
        path,
        header: (name: string) => headers[name],
      },
    };
  }

  it("extracts version from path", () => {
    const c = createContext("/api/v1/projects");
    expect(extractApiVersion(c)).toBe("v1");
  });

  it("extracts version from custom header", () => {
    const c = createContext("/api/projects", { "X-API-Version": "v1" });
    expect(extractApiVersion(c)).toBe("v1");
  });

  it("extracts version from Accept header", () => {
    const c = createContext("/api/projects", {
      Accept: "application/vnd.llmrank.v1+json",
    });
    expect(extractApiVersion(c)).toBe("v1");
  });

  it("defaults to latest version when no version specified", () => {
    const c = createContext("/api/projects");
    expect(extractApiVersion(c)).toBe(LATEST_API_VERSION);
  });

  it("ignores invalid versions in path", () => {
    const c = createContext("/api/v99/projects");
    expect(extractApiVersion(c)).toBe(LATEST_API_VERSION);
  });

  it("prioritizes path version over header version", () => {
    const c = createContext("/api/v1/projects", { "X-API-Version": "v2" });
    expect(extractApiVersion(c)).toBe("v1");
  });
});

describe("apiVersionMiddleware", () => {
  it("sets API version headers in response", async () => {
    const app = new Hono<AppEnv>();

    app.use("*", apiVersionMiddleware);
    app.get("/api/v1/test", (c) => c.json({ success: true }));

    const res = await app.request("/api/v1/test");

    expect(res.headers.get("X-API-Version")).toBe("v1");
    expect(res.headers.get("X-Supported-Versions")).toBe(
      API_VERSIONS.join(", "),
    );
  });
});

describe("requireVersion", () => {
  it("allows request when version matches", async () => {
    const app = new Hono<AppEnv>();

    app.get("/api/v1/test", requireVersion("v1"), (c) =>
      c.json({ success: true }),
    );

    const res = await app.request("/api/v1/test");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("rejects request when version mismatch", async () => {
    const app = new Hono<AppEnv>();

    // This endpoint requires v2, but path is v1
    app.get("/api/v1/test", requireVersion("v2" as any), (c) =>
      c.json({ success: true }),
    );

    const res = await app.request("/api/v1/test");
    expect(res.status).toBe(400);

    const json: any = await res.json();
    expect(json.error.code).toBe("VERSION_MISMATCH");
  });
});

describe("deprecatedEndpoint", () => {
  it("adds deprecation headers to response", async () => {
    const app = new Hono<AppEnv>();

    // Mock logger
    app.use("*", async (c, next) => {
      c.set("logger", {
        warn: () => {},
        info: () => {},
        error: () => {},
        debug: () => {},
        child: () => ({}) as any,
      } as any);
      await next();
    });

    app.get(
      "/api/v1/old",
      deprecatedEndpoint("2027-12-31T23:59:59Z", "/api/v1/new"),
      (c) => c.json({ data: "deprecated" }),
    );

    const res = await app.request("/api/v1/old");

    expect(res.headers.get("Deprecation")).toBe("true");
    expect(res.headers.get("Sunset")).toBe("2027-12-31T23:59:59Z");
    expect(res.headers.get("Link")).toBe(
      '</api/v1/new>; rel="successor-version"',
    );
  });
});

describe("VersionRouter", () => {
  it("routes to correct version handler", async () => {
    const app = new Hono<AppEnv>();

    const router = new VersionRouter();
    router.version("v1", async (c) => c.json({ version: "v1" }));

    app.get("/api/test", async (c) => router.handle(c));

    const res = await app.request("/api/test", {
      headers: { "X-API-Version": "v1" },
    });

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.version).toBe("v1");
  });

  it("falls back to latest version when specific version not implemented", async () => {
    const app = new Hono<AppEnv>();

    const router = new VersionRouter();
    router.version("v1", async (c) => c.json({ version: "v1" }));

    app.get("/api/test", async (c) => router.handle(c));

    // Request v2 (not implemented), should fall back to v1 (latest)
    const res = await app.request("/api/test", {
      headers: { "X-API-Version": "v2" },
    });

    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.version).toBe("v1");
  });

  it("supports multiple versions", async () => {
    const app = new Hono<AppEnv>();

    const router = new VersionRouter();
    router.version("v1", async (c) => c.json({ version: "v1", field: "old" }));

    app.get("/api/test", async (c) => router.handle(c));

    const v1Res = await app.request("/api/test", {
      headers: { "X-API-Version": "v1" },
    });
    const v1Json: any = await v1Res.json();
    expect(v1Json.version).toBe("v1");
    expect(v1Json.field).toBe("old");
  });

  it("returns error when no handler available", async () => {
    const app = new Hono<AppEnv>();

    const router = new VersionRouter();
    // No handlers registered

    app.get("/api/test", async (c) => router.handle(c));

    const res = await app.request("/api/test");
    expect(res.status).toBe(400);

    const json: any = await res.json();
    expect(json.error.code).toBe("VERSION_NOT_SUPPORTED");
  });
});
