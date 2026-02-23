// ---------------------------------------------------------------------------
// Multi-environment configuration for billing E2E tests
//
// Usage:
//   # Test against production
//   BILLING_E2E_BASE_URL=https://api.llmrank.app \
//   BILLING_E2E_AUTH_COOKIE="better-auth.session_token=..." \
//   npx vitest run src/__tests__/e2e/billing-e2e.test.ts
//
//   # Test against local dev
//   BILLING_E2E_BASE_URL=http://localhost:8787 \
//   BILLING_E2E_AUTH_COOKIE="better-auth.session_token=..." \
//   npx vitest run src/__tests__/e2e/billing-e2e.test.ts
//
//   # Test against staging
//   BILLING_E2E_BASE_URL=https://api-staging.llmrank.app \
//   BILLING_E2E_AUTH_COOKIE="better-auth.session_token=..." \
//   npx vitest run src/__tests__/e2e/billing-e2e.test.ts
// ---------------------------------------------------------------------------

export interface E2EConfig {
  baseUrl: string;
  authCookie: string;
  /** Stripe test key — only needed for webhook signature tests */
  stripeWebhookSecret?: string;
  /** Request timeout in ms */
  timeout: number;
}

export function loadConfig(): E2EConfig {
  const baseUrl = process.env.BILLING_E2E_BASE_URL;
  const authCookie = process.env.BILLING_E2E_AUTH_COOKIE;

  if (!baseUrl || !authCookie) {
    throw new Error(
      "E2E billing tests require BILLING_E2E_BASE_URL and BILLING_E2E_AUTH_COOKIE env vars.\n" +
        "Example:\n" +
        "  BILLING_E2E_BASE_URL=https://api.llmrank.app \\\n" +
        '  BILLING_E2E_AUTH_COOKIE="better-auth.session_token=<token>" \\\n' +
        "  npx vitest run src/__tests__/e2e/billing-e2e.test.ts",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    authCookie,
    stripeWebhookSecret: process.env.BILLING_E2E_STRIPE_WEBHOOK_SECRET,
    timeout: Number(process.env.BILLING_E2E_TIMEOUT) || 15000,
  };
}

/** Helper: make an authenticated request to the billing API */
export async function billingRequest(
  config: E2EConfig,
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<Response> {
  const url = `${config.baseUrl}${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Cookie", config.authCookie);
  headers.set("Origin", "https://llmrank.app");

  let body = init?.body;
  if (init?.json) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  try {
    return await fetch(url, {
      ...init,
      headers,
      body,
      signal: controller.signal,
      redirect: "manual",
    });
  } finally {
    clearTimeout(timer);
  }
}
