import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { projectQueries, userQueries, integrationQueries } from "@llm-boost/db";
import {
  PLAN_INTEGRATION_ACCESS,
  ConnectIntegrationSchema,
  UpdateIntegrationSchema,
  INTEGRATION_META,
  type IntegrationProvider,
} from "@llm-boost/shared";
import { encrypt, decrypt } from "../lib/crypto";
import {
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  GOOGLE_SCOPES,
} from "../lib/google-oauth";

export const integrationRoutes = new Hono<AppEnv>();

integrationRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canAccessProvider(
  plan: string,
  provider: IntegrationProvider,
): boolean {
  const allowed =
    PLAN_INTEGRATION_ACCESS[plan as keyof typeof PLAN_INTEGRATION_ACCESS] ?? [];
  return allowed.includes(provider);
}

// ---------------------------------------------------------------------------
// GET /:projectId — List integrations (never returns credentials)
// ---------------------------------------------------------------------------

integrationRoutes.get("/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const integrations = await integrationQueries(db).listByProject(projectId);

  const safe = integrations.map((i) => ({
    id: i.id,
    projectId: i.projectId,
    provider: i.provider,
    enabled: i.enabled,
    hasCredentials: !!i.encryptedCredentials,
    config: i.config,
    tokenExpiresAt: i.tokenExpiresAt,
    lastSyncAt: i.lastSyncAt,
    lastError: i.lastError,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));

  return c.json({ data: safe });
});

// ---------------------------------------------------------------------------
// POST /:projectId/connect — Connect API key integration (PSI, Clarity)
// ---------------------------------------------------------------------------

integrationRoutes.post("/:projectId/connect", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const body = await c.req.json();
  const parsed = ConnectIntegrationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const { provider, apiKey, clarityProjectId } = parsed.data;

  if (!canAccessProvider(user.plan, provider)) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: `${INTEGRATION_META[provider].label} requires a higher plan`,
        },
      },
      403,
    );
  }

  const meta = INTEGRATION_META[provider];
  if (meta.authType === "oauth2") {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `${meta.label} uses OAuth2. Use the OAuth flow instead.`,
        },
      },
      422,
    );
  }

  if (!apiKey) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "apiKey is required for this integration",
        },
      },
      422,
    );
  }

  const credentialPayload: Record<string, string> = { apiKey };
  if (provider === "clarity" && clarityProjectId) {
    credentialPayload.projectId = clarityProjectId;
  }

  const encrypted = await encrypt(
    JSON.stringify(credentialPayload),
    c.env.INTEGRATION_ENCRYPTION_KEY,
  );

  const integration = await integrationQueries(db).upsert({
    projectId,
    provider,
    encryptedCredentials: encrypted,
    config:
      provider === "clarity" && clarityProjectId
        ? { projectId: clarityProjectId }
        : {},
  });

  return c.json(
    {
      data: {
        id: integration.id,
        provider: integration.provider,
        enabled: integration.enabled,
        hasCredentials: true,
        createdAt: integration.createdAt,
      },
    },
    201,
  );
});

// ---------------------------------------------------------------------------
// PUT /:projectId/:id — Toggle enabled/disabled, update config
// ---------------------------------------------------------------------------

integrationRoutes.put("/:projectId/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const id = c.req.param("id");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const body = await c.req.json();
  const parsed = UpdateIntegrationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  if (parsed.data.enabled !== undefined) {
    const updated = await integrationQueries(db).updateEnabled(
      id,
      parsed.data.enabled,
    );
    if (!updated) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Integration not found" } },
        404,
      );
    }
    return c.json({
      data: {
        id: updated.id,
        provider: updated.provider,
        enabled: updated.enabled,
      },
    });
  }

  return c.json({ data: { id } });
});

// ---------------------------------------------------------------------------
// DELETE /:projectId/:id — Disconnect and delete credentials
// ---------------------------------------------------------------------------

integrationRoutes.delete("/:projectId/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const id = c.req.param("id");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  await integrationQueries(db).remove(id, projectId);
  return c.json({ data: { deleted: true } });
});

// ---------------------------------------------------------------------------
// POST /:projectId/oauth/google/start — Return Google auth URL
// ---------------------------------------------------------------------------

integrationRoutes.post("/:projectId/oauth/google/start", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const body = await c.req.json<{ provider: "gsc" | "ga4" }>();
  const provider = body.provider;

  if (provider !== "gsc" && provider !== "ga4") {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "provider must be gsc or ga4",
        },
      },
      422,
    );
  }

  if (!canAccessProvider(user.plan, provider)) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: `${INTEGRATION_META[provider].label} requires a higher plan`,
        },
      },
      403,
    );
  }

  const state = btoa(JSON.stringify({ projectId, provider, userId }));
  const redirectUri = `${c.req.header("Origin") ?? c.req.url.split("/api")[0]}/integrations/callback/google`;

  const url = buildGoogleAuthUrl({
    clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
    redirectUri,
    state,
    scopes: [GOOGLE_SCOPES[provider]],
  });

  return c.json({ data: { url } });
});

// ---------------------------------------------------------------------------
// POST /oauth/google/callback — Exchange code for tokens, store encrypted
// ---------------------------------------------------------------------------

integrationRoutes.post("/oauth/google/callback", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = await c.req.json<{
    code: string;
    state: string;
    redirectUri: string;
  }>();

  if (!body.code || !body.state || !body.redirectUri) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "code, state, and redirectUri are required",
        },
      },
      422,
    );
  }

  let stateData: { projectId: string; provider: "gsc" | "ga4"; userId: string };
  try {
    stateData = JSON.parse(atob(body.state));
  } catch {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid state" } },
      422,
    );
  }

  if (stateData.userId !== userId) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "State mismatch" } },
      401,
    );
  }

  const project = await projectQueries(db).getById(stateData.projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const tokens = await exchangeCodeForTokens({
    code: body.code,
    clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: body.redirectUri,
  });

  const credentialPayload = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };

  const encrypted = await encrypt(
    JSON.stringify(credentialPayload),
    c.env.INTEGRATION_ENCRYPTION_KEY,
  );

  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  const integration = await integrationQueries(db).upsert({
    projectId: stateData.projectId,
    provider: stateData.provider,
    encryptedCredentials: encrypted,
    tokenExpiresAt: expiresAt,
  });

  return c.json({
    data: {
      id: integration.id,
      provider: integration.provider,
      enabled: integration.enabled,
      hasCredentials: true,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /:projectId/:id/test — Lightweight connectivity test
// ---------------------------------------------------------------------------

integrationRoutes.post("/:projectId/:id/test", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");
  const id = c.req.param("id");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const integrations = await integrationQueries(db).listByProject(projectId);
  const integration = integrations.find((i) => i.id === id);

  if (!integration || !integration.encryptedCredentials) {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Integration not found or no credentials",
        },
      },
      404,
    );
  }

  try {
    const creds = JSON.parse(
      await decrypt(
        integration.encryptedCredentials,
        c.env.INTEGRATION_ENCRYPTION_KEY,
      ),
    );

    let ok = false;
    let message = "Unknown provider";

    if (integration.provider === "psi") {
      const testUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=${creds.apiKey}&category=performance`;
      const res = await fetch(testUrl);
      ok = res.ok;
      message = ok ? "PSI API key is valid" : `PSI API returned ${res.status}`;
    } else if (integration.provider === "clarity") {
      ok = !!creds.apiKey;
      message = ok ? "Clarity credentials present" : "Missing API key";
    } else if (
      integration.provider === "gsc" ||
      integration.provider === "ga4"
    ) {
      ok = !!creds.accessToken && !!creds.refreshToken;
      message = ok ? "OAuth tokens present" : "Missing OAuth tokens";
    }

    return c.json({ data: { ok, message } });
  } catch (err) {
    return c.json({
      data: {
        ok: false,
        message: err instanceof Error ? err.message : "Test failed",
      },
    });
  }
});
