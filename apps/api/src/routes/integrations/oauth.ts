import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { integrationQueries, projectQueries, userQueries } from "@llm-boost/db";
import { canAccessIntegration, INTEGRATION_META, type PlanTier } from "@llm-boost/shared";
import { encrypt } from "../../lib/crypto";
import {
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  GOOGLE_SCOPES,
} from "../../lib/google-oauth";
import {
  buildMetaAuthUrl,
  exchangeCodeForTokens as exchangeMetaCode,
  exchangeForLongLivedToken,
  META_SCOPES,
} from "../../lib/meta-oauth";

export const integrationOAuthRoutes = new Hono<AppEnv>();

function canAccessProvider(plan: string, provider: "gsc" | "ga4" | "meta"): boolean {
  return canAccessIntegration(plan as PlanTier, provider);
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

integrationOAuthRoutes.post("/:projectId/oauth/google/start", async (c) => {
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

  const statePayload = { projectId, provider, userId };
  const nonce = await hmacSign(
    c.env.SHARED_SECRET,
    JSON.stringify(statePayload),
  );
  const state = btoa(JSON.stringify({ ...statePayload, nonce }));
  const redirectUri = `${c.req.header("Origin") ?? c.req.url.split("/api")[0]}/integrations/callback/google`;

  const url = buildGoogleAuthUrl({
    clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
    redirectUri,
    state,
    scopes: [GOOGLE_SCOPES[provider]],
  });

  return c.json({ data: { url } });
});

integrationOAuthRoutes.post("/oauth/google/callback", async (c) => {
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

  const { nonce, ...stateWithoutNonce } = stateData as {
    nonce?: string;
    projectId: string;
    provider: "gsc" | "ga4";
    userId: string;
  };
  const expectedNonce = await hmacSign(
    c.env.SHARED_SECRET,
    JSON.stringify({
      projectId: stateWithoutNonce.projectId,
      provider: stateWithoutNonce.provider,
      userId: stateWithoutNonce.userId,
    }),
  );
  if (!nonce || nonce !== expectedNonce) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid state nonce" } },
      401,
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

  const encrypted = await encrypt(
    JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }),
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

integrationOAuthRoutes.post("/:projectId/oauth/meta/start", async (c) => {
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

  if (!canAccessProvider(user.plan, "meta")) {
    return c.json(
      {
        error: {
          code: "PLAN_LIMIT_REACHED",
          message: `${INTEGRATION_META.meta.label} requires a higher plan`,
        },
      },
      403,
    );
  }

  const body = await c.req.json<{ adAccountId?: string }>();
  const statePayload = { projectId, provider: "meta" as const, userId };
  const nonce = await hmacSign(
    c.env.SHARED_SECRET,
    JSON.stringify(statePayload),
  );
  const state = btoa(
    JSON.stringify({ ...statePayload, nonce, adAccountId: body.adAccountId }),
  );
  const redirectUri = `${c.req.header("Origin") ?? c.req.url.split("/api")[0]}/integrations/callback/meta`;

  const scopes: string[] = [META_SCOPES.basic];
  if (body.adAccountId) scopes.push(META_SCOPES.ads);

  const url = buildMetaAuthUrl({
    clientId: c.env.META_APP_ID,
    redirectUri,
    state,
    scopes,
  });

  return c.json({ data: { url } });
});

integrationOAuthRoutes.post("/oauth/meta/callback", async (c) => {
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

  let stateData: {
    projectId: string;
    provider: "meta";
    userId: string;
    adAccountId?: string;
  };
  try {
    stateData = JSON.parse(atob(body.state));
  } catch {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid state" } },
      422,
    );
  }

  const { nonce, adAccountId, ...stateWithoutExtra } = stateData as {
    nonce?: string;
    projectId: string;
    provider: "meta";
    userId: string;
    adAccountId?: string;
  };
  const expectedNonce = await hmacSign(
    c.env.SHARED_SECRET,
    JSON.stringify({
      projectId: stateWithoutExtra.projectId,
      provider: stateWithoutExtra.provider,
      userId: stateWithoutExtra.userId,
    }),
  );
  if (!nonce || nonce !== expectedNonce) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid state nonce" } },
      401,
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

  const shortLived = await exchangeMetaCode({
    code: body.code,
    clientId: c.env.META_APP_ID,
    clientSecret: c.env.META_APP_SECRET,
    redirectUri: body.redirectUri,
  });
  const longLived = await exchangeForLongLivedToken({
    shortLivedToken: shortLived.accessToken,
    clientId: c.env.META_APP_ID,
    clientSecret: c.env.META_APP_SECRET,
  });

  const encrypted = await encrypt(
    JSON.stringify({ accessToken: longLived.accessToken }),
    c.env.INTEGRATION_ENCRYPTION_KEY,
  );

  const config: Record<string, unknown> = {};
  if (adAccountId) config.adAccountId = adAccountId;

  const integration = await integrationQueries(db).upsert({
    projectId: stateData.projectId,
    provider: "meta",
    encryptedCredentials: encrypted,
    tokenExpiresAt: new Date(Date.now() + longLived.expiresIn * 1000),
    config,
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
