import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Bindings } from "../../index";
import type { TokenContext } from "../../services/api-token-service";

// apiTokenAuth is exercised by its own middleware test; here we stub it so the
// route's project/scope guards + response shaping are what's under test. The
// per-test tokenCtx is injected via a context middleware in createApp().
const apiTokenAuthMock = vi.hoisted(() =>
  vi.fn().mockImplementation(async (_c, next) => {
    await next();
  }),
);

const dbMocks = vi.hoisted(() => {
  const getCitedPages = vi.fn();
  return {
    getCitedPages,
    visibilityQueries: vi.fn(() => ({ getCitedPages })),
  };
});

vi.mock("../../middleware/api-token-auth", () => ({
  apiTokenAuth: apiTokenAuthMock,
}));

vi.mock("@llm-boost/db", () => ({
  visibilityQueries: dbMocks.visibilityQueries,
}));

import { sitesRoutes } from "../../routes/sites";

function createApp(tokenCtx: TokenContext) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    c.set("tokenCtx", tokenCtx);
    await next();
  });
  app.route("/sites", sitesRoutes);
  return app;
}

const baseEnv = {} as unknown as Bindings;

const accountWideToken: TokenContext = {
  tokenId: "tok-1",
  userId: "user-1",
  projectId: null,
  scopes: ["visibility:read"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /sites/:id/scores", () => {
  it("returns a top-level scores array of { url, citations } (families.care contract)", async () => {
    dbMocks.getCitedPages.mockResolvedValue([
      {
        citedUrl: "https://families.care/providers/acme-home-care",
        citationCount: 7,
      },
      { citedUrl: "https://families.care/providers/sunrise", citationCount: 3 },
    ]);

    const app = createApp(accountWideToken);
    const res = await app.request("/sites/proj-123/scores", {}, baseEnv);

    expect(res.status).toBe(200);
    const body = await res.json();
    // Top-level `scores`, NOT a { data } envelope — the consumer reads body.scores.
    expect(body).toEqual({
      scores: [
        { url: "https://families.care/providers/acme-home-care", citations: 7 },
        { url: "https://families.care/providers/sunrise", citations: 3 },
      ],
    });
    expect(dbMocks.getCitedPages).toHaveBeenCalledWith("proj-123");
  });

  it("returns { scores: [] } when the project has no visibility data (clean no-op, not an error)", async () => {
    dbMocks.getCitedPages.mockResolvedValue([]);
    const app = createApp(accountWideToken);
    const res = await app.request("/sites/proj-123/scores", {}, baseEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ scores: [] });
  });

  it("403s when the token lacks the visibility:read scope", async () => {
    const app = createApp({ ...accountWideToken, scopes: ["scores:read"] });
    const res = await app.request("/sites/proj-123/scores", {}, baseEnv);
    expect(res.status).toBe(403);
    expect(dbMocks.getCitedPages).not.toHaveBeenCalled();
  });

  it("403s when a project-scoped token requests a different project", async () => {
    const app = createApp({ ...accountWideToken, projectId: "other-proj" });
    const res = await app.request("/sites/proj-123/scores", {}, baseEnv);
    expect(res.status).toBe(403);
    expect(dbMocks.getCitedPages).not.toHaveBeenCalled();
  });

  it("clamps an oversized limit and slices the result set", async () => {
    dbMocks.getCitedPages.mockResolvedValue(
      Array.from({ length: 5 }, (_v, i) => ({
        citedUrl: `https://families.care/providers/p${i}`,
        citationCount: 5 - i,
      })),
    );
    const app = createApp(accountWideToken);
    const res = await app.request(
      "/sites/proj-123/scores?limit=2",
      {},
      baseEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scores: unknown[] };
    expect(body.scores).toHaveLength(2);
  });
});
