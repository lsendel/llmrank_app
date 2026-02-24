import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb } from "@llm-boost/db";
import * as schema from "@llm-boost/db";
import type { Bindings } from "../index";
import { convertLeadToProject } from "../services/lead-conversion-service";

export function createAuth(env: Bindings) {
  const db = createDb(env.DATABASE_URL);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL, // e.g. http://localhost:8787 (NOT including basePath)
    basePath: "/api/auth",
    trustedOrigins: [
      env.APP_BASE_URL,
      "http://localhost:3000",
      "https://llmrank.app",
      "https://www.llmrank.app",
    ].filter(Boolean),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // Best-effort: seed a project from a prior public scan lead.
            // Failures must never block the signup flow.
            try {
              await convertLeadToProject(db, user.id, user.email);
            } catch {
              // Silently swallow — the user still signs up successfully.
            }
          },
        },
      },
    },
    advanced: {
      generateId: () => crypto.randomUUID(),
      crossSubDomainCookies: {
        enabled: !env.APP_BASE_URL.includes("localhost"),
        domain: env.APP_BASE_URL.includes("localhost")
          ? undefined
          : "llmrank.app",
      },
    },
  });
}
