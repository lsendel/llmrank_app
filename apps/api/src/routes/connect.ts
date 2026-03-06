/**
 * First-party app connection routes.
 *
 * Allows indices.app to securely retrieve an API token + project ID
 * via a signed token exchange instead of manual entry.
 *
 * Flow:
 *   1. indices.app signs { email, callbackUrl, nonce } with shared CONNECT_SECRET
 *   2. Redirects user to GET /connect/indices?token=<signed>
 *   3. LLMRank verifies token, checks user session, finds default project
 *   4. Creates a scoped API token for indices.app
 *   5. Signs { apiToken, projectId, projectName, apiUrl } and redirects back
 */
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { signPayload, verifyPayload } from "../lib/connect-token";
import { createAuth } from "../lib/auth";
import { projectQueries, userQueries, apiTokenQueries } from "@llm-boost/db";
import { ALL_TOKEN_SCOPES, type PlanTier } from "@llm-boost/shared";
import {
  createApiTokenService,
  type ApiTokenRepository,
} from "../services/api-token-service";

interface ConnectRequest {
  email: string;
  callbackUrl: string;
  nonce: string;
}

export const connectRoutes = new Hono<AppEnv>();

// GET /connect/indices?token=<signed_token>
connectRoutes.get("/indices", async (c) => {
  const secret = c.env.CONNECT_SECRET;
  if (!secret) {
    return c.json(
      { code: "NOT_CONFIGURED", message: "Connect secret not configured" },
      500,
    );
  }

  const token = c.req.query("token");
  if (!token) {
    return c.json(
      { code: "VALIDATION_ERROR", message: "Missing token parameter" },
      400,
    );
  }

  // 1. Verify the signed token from indices.app
  const result = await verifyPayload<ConnectRequest>(token, secret);
  if (!result.valid) {
    return c.json({ code: "TOKEN_INVALID", message: result.error }, 401);
  }

  const { email, callbackUrl, nonce } = result.payload;
  if (!email || !callbackUrl || !nonce) {
    return c.json(
      {
        code: "VALIDATION_ERROR",
        message: "Token must contain email, callbackUrl, and nonce",
      },
      400,
    );
  }

  // Validate callback URL
  try {
    const url = new URL(callbackUrl);
    if (
      !url.hostname.endsWith("indices.app") &&
      !url.hostname.includes("localhost")
    ) {
      return c.json(
        { code: "FORBIDDEN", message: "Invalid callback URL origin" },
        403,
      );
    }
  } catch {
    return c.json(
      { code: "VALIDATION_ERROR", message: "Invalid callback URL" },
      400,
    );
  }

  // 2. Check user session
  const auth = createAuth(c.env);
  const session = await auth.api
    .getSession({ headers: c.req.raw.headers })
    .catch(() => null);

  if (!session?.user) {
    // Redirect to login with return URL
    const baseUrl = c.env.APP_BASE_URL || "https://llmrank.app";
    const returnUrl = encodeURIComponent(c.req.url);
    return c.redirect(`${baseUrl}/login?returnTo=${returnUrl}`);
  }

  // 3. Verify email matches
  if (session.user.email.toLowerCase() !== email.toLowerCase()) {
    return c.json(
      {
        code: "EMAIL_MISMATCH",
        message: `Logged into LLMRank as ${session.user.email} but indices.app requested ${email}. Please log in with the same account.`,
      },
      403,
    );
  }

  // 4. Find user's default project
  const db = c.get("db");
  const pq = projectQueries(db);
  const projects = await pq.listByUser(session.user.id);

  if (projects.length === 0) {
    return c.json(
      {
        code: "NO_PROJECT",
        message: "No projects found. Create a project on LLMRank first.",
      },
      404,
    );
  }

  const project = projects[0]; // Use first/default project

  // 5. Create a scoped API token for indices.app
  const user = await userQueries(db).getById(session.user.id);
  const service = createApiTokenService({
    apiTokens: apiTokenQueries(db) as unknown as ApiTokenRepository,
    projects: { getById: (id: string) => pq.getById(id) },
  });

  const tokenResult = await service.create({
    userId: session.user.id,
    userPlan: (user?.plan as PlanTier) || "free",
    projectId: project.id,
    type: "api",
    name: "indices.app integration",
    scopes: [...ALL_TOKEN_SCOPES],
  });

  // 6. Sign response and redirect back
  const apiUrl = new URL(c.req.url).origin;
  const responsePayload = {
    apiToken: tokenResult.plainToken,
    apiUrl,
    projectId: project.id,
    projectName: project.name || project.domain,
    userId: session.user.id,
    nonce,
  };

  const responseToken = await signPayload(responsePayload, secret);
  const separator = callbackUrl.includes("?") ? "&" : "?";
  return c.redirect(`${callbackUrl}${separator}token=${responseToken}`);
});
