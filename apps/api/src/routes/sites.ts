import { Hono } from "hono";
import type { AppEnv } from "../index";
import { apiTokenAuth } from "../middleware/api-token-auth";
import { visibilityQueries } from "@llm-boost/db";
import type { TokenScope, TokenContext } from "../services/api-token-service";

export const sitesRoutes = new Hono<AppEnv>();

sitesRoutes.use("*", apiTokenAuth);

// ---------------------------------------------------------------------------
// Helpers (mirrors v1.ts — kept local so this route is self-contained)
// ---------------------------------------------------------------------------

function getTokenCtx(c: { get(key: "tokenCtx"): TokenContext }): TokenContext {
  return c.get("tokenCtx");
}

function requireProjectAccess(
  tokenCtx: TokenContext,
  projectId: string,
): string | null {
  // Account-wide tokens (null projectId) can access any project.
  if (tokenCtx.projectId === null) {
    return null;
  }
  if (tokenCtx.projectId !== projectId) {
    return "Token is not authorized for this project";
  }
  return null;
}

function requireScope(
  tokenCtx: TokenContext,
  scope: TokenScope,
): string | null {
  if (!tokenCtx.scopes.includes(scope)) {
    return `Token is missing required scope: ${scope}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /sites/:id/scores — AI-citation counts per cited page (scope: visibility:read)
//
// Stable EXTERNAL contract for any programmatic consumer (SDKs, sync scripts).
// Unlike the rest of the API it returns a TOP-LEVEL `scores` array of
// { url, citations } — NOT the house `{ data }` envelope — so a consumer can read
// `resp.json()["scores"]` directly. This is a published shape: keep it stable.
// (Our families.care dogfood sync is one such consumer; the endpoint is generic
// and not specific to it.)
//
// `:id` is the project UUID. Data comes from the visibility_checks table
// (cited_url grouped + counted), so a project with no completed visibility checks
// returns `{ scores: [] }` (a clean no-op), not an error.
// ---------------------------------------------------------------------------

sitesRoutes.get("/:id/scores", async (c) => {
  const tokenCtx = getTokenCtx(c as Parameters<typeof getTokenCtx>[0]);
  const projectId = c.req.param("id");

  const projectErr = requireProjectAccess(tokenCtx, projectId);
  if (projectErr) {
    return c.json({ error: { code: "FORBIDDEN", message: projectErr } }, 403);
  }

  const scopeErr = requireScope(tokenCtx, "visibility:read");
  if (scopeErr) {
    return c.json({ error: { code: "FORBIDDEN", message: scopeErr } }, 403);
  }

  // Consumer requests limit=500; clamp to a sane [1, 1000] range.
  const limit = Math.min(
    Math.max(Number(c.req.query("limit")) || 500, 1),
    1000,
  );

  // visibility_checks lives in Supabase (agency db), not the D1 app db.
  const agencyDb = c.get("agencyDb");
  const cited = await visibilityQueries(agencyDb).getCitedPages(projectId);

  const scores = cited.slice(0, limit).map((row) => ({
    url: row.citedUrl,
    citations: row.citationCount,
  }));

  return c.json({ scores });
});
