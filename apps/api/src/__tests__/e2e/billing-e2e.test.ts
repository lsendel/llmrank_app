// ---------------------------------------------------------------------------
// Billing E2E Test Suite — Multi-Environment
//
// Tests every billing API endpoint against a real running environment.
// Configure via environment variables (see billing-e2e.config.ts).
//
// Coverage targets:
//   - GET  /api/billing/subscription    ✓
//   - GET  /api/billing/usage           ✓
//   - GET  /api/billing/payments        ✓
//   - POST /api/billing/checkout        ✓ (all plans + validation)
//   - POST /api/billing/upgrade         ✓ (checkout fallback + validation)
//   - POST /api/billing/downgrade       ✓ (validation)
//   - POST /api/billing/cancel          ✓ (no-sub case + validation)
//   - POST /api/billing/portal          ✓ (validation + no-customer)
//   - POST /api/billing/webhook         ✓ (missing sig, invalid sig)
//   - POST /api/billing/validate-promo  ✓ (missing code, invalid code)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll } from "vitest";
import {
  loadConfig,
  billingRequest,
  type E2EConfig,
} from "./billing-e2e.config";

let cfg: E2EConfig;

beforeAll(() => {
  cfg = loadConfig();
});

// ---------------------------------------------------------------------------
// GET /api/billing/subscription
// ---------------------------------------------------------------------------

describe("GET /api/billing/subscription", () => {
  it("returns 200 with subscription data or null", async () => {
    const res = await billingRequest(cfg, "/api/billing/subscription");
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body).toHaveProperty("data");
    // data is either null (no subscription) or an object with planCode
    if (body.data !== null) {
      expect(body.data).toHaveProperty("planCode");
      expect(body.data).toHaveProperty("status");
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/billing/usage
// ---------------------------------------------------------------------------

describe("GET /api/billing/usage", () => {
  it("returns 200 with plan limits and credit info", async () => {
    const res = await billingRequest(cfg, "/api/billing/usage");
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.data).toHaveProperty("plan");
    expect(body.data).toHaveProperty("crawlCreditsRemaining");
    expect(body.data).toHaveProperty("crawlCreditsTotal");
    expect(body.data).toHaveProperty("maxPagesPerCrawl");
    expect(body.data).toHaveProperty("maxDepth");
    expect(body.data).toHaveProperty("maxProjects");
    expect(typeof body.data.crawlCreditsRemaining).toBe("number");
    expect(typeof body.data.maxPagesPerCrawl).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// GET /api/billing/payments
// ---------------------------------------------------------------------------

describe("GET /api/billing/payments", () => {
  it("returns 200 with payment array", async () => {
    const res = await billingRequest(cfg, "/api/billing/payments");
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      expect(body.data[0]).toHaveProperty("amountCents");
      expect(body.data[0]).toHaveProperty("currency");
      expect(body.data[0]).toHaveProperty("status");
      expect(body.data[0]).toHaveProperty("createdAt");
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/checkout
// ---------------------------------------------------------------------------

describe("POST /api/billing/checkout", () => {
  const PLANS = ["starter", "pro", "agency"] as const;

  for (const plan of PLANS) {
    it(`creates checkout session for ${plan} plan`, async () => {
      const res = await billingRequest(cfg, "/api/billing/checkout", {
        method: "POST",
        json: {
          plan,
          successUrl: "https://llmrank.app/dashboard/billing?success=true",
          cancelUrl: "https://llmrank.app/dashboard/billing?canceled=true",
        },
      });
      expect(res.status).toBe(200);

      const body: any = await res.json();
      expect(body.data).toHaveProperty("url");
      expect(body.data.url).toContain("checkout.stripe.com");
    });
  }

  it("returns 422 when plan is missing", async () => {
    const res = await billingRequest(cfg, "/api/billing/checkout", {
      method: "POST",
      json: {
        successUrl: "https://llmrank.app/success",
        cancelUrl: "https://llmrank.app/cancel",
      },
    });
    expect(res.status).toBe(422);

    const body: any = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when successUrl is missing", async () => {
    const res = await billingRequest(cfg, "/api/billing/checkout", {
      method: "POST",
      json: { plan: "starter", cancelUrl: "https://llmrank.app/cancel" },
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 when cancelUrl is missing", async () => {
    const res = await billingRequest(cfg, "/api/billing/checkout", {
      method: "POST",
      json: { plan: "starter", successUrl: "https://llmrank.app/success" },
    });
    expect(res.status).toBe(422);
  });

  it("returns error for invalid plan code", async () => {
    const res = await billingRequest(cfg, "/api/billing/checkout", {
      method: "POST",
      json: {
        plan: "nonexistent_plan",
        successUrl: "https://llmrank.app/success",
        cancelUrl: "https://llmrank.app/cancel",
      },
    });
    // Either 422 (VALIDATION_ERROR) or 500 (INTERNAL_ERROR) depending on how
    // the service handles it. Either way, not 200.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/upgrade
// ---------------------------------------------------------------------------

describe("POST /api/billing/upgrade", () => {
  it("returns 200 with upgrade/checkout result for starter", async () => {
    const res = await billingRequest(cfg, "/api/billing/upgrade", {
      method: "POST",
      json: {
        plan: "starter",
        successUrl: "https://llmrank.app/dashboard/billing?upgraded=true",
        cancelUrl: "https://llmrank.app/dashboard/billing",
      },
    });
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.data).toHaveProperty("targetPlan", "starter");
    expect(body.data).toHaveProperty("method");
    expect(["proration", "checkout"]).toContain(body.data.method);
    if (body.data.method === "checkout") {
      expect(body.data).toHaveProperty("url");
      expect(body.data.url).toContain("stripe.com");
    }
  });

  it("returns 200 with upgrade/checkout result for pro", async () => {
    const res = await billingRequest(cfg, "/api/billing/upgrade", {
      method: "POST",
      json: {
        plan: "pro",
        successUrl: "https://llmrank.app/dashboard/billing?upgraded=true",
        cancelUrl: "https://llmrank.app/dashboard/billing",
      },
    });
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.data).toHaveProperty("targetPlan", "pro");
  });

  it("returns 200 with upgrade/checkout result for agency", async () => {
    const res = await billingRequest(cfg, "/api/billing/upgrade", {
      method: "POST",
      json: {
        plan: "agency",
        successUrl: "https://llmrank.app/dashboard/billing?upgraded=true",
        cancelUrl: "https://llmrank.app/dashboard/billing",
      },
    });
    expect(res.status).toBe(200);

    const body: any = await res.json();
    expect(body.data).toHaveProperty("targetPlan", "agency");
  });

  it("returns 422 when plan is missing", async () => {
    const res = await billingRequest(cfg, "/api/billing/upgrade", {
      method: "POST",
      json: {
        successUrl: "https://llmrank.app/success",
        cancelUrl: "https://llmrank.app/cancel",
      },
    });
    expect(res.status).toBe(422);

    const body: any = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns error for invalid plan code", async () => {
    const res = await billingRequest(cfg, "/api/billing/upgrade", {
      method: "POST",
      json: {
        plan: "bogus_plan",
        successUrl: "https://llmrank.app/success",
        cancelUrl: "https://llmrank.app/cancel",
      },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/downgrade
// ---------------------------------------------------------------------------

describe("POST /api/billing/downgrade", () => {
  it("returns 422 when plan is missing", async () => {
    const res = await billingRequest(cfg, "/api/billing/downgrade", {
      method: "POST",
      json: {},
    });
    expect(res.status).toBe(422);

    const body: any = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("handles downgrade request (result depends on subscription state)", async () => {
    const res = await billingRequest(cfg, "/api/billing/downgrade", {
      method: "POST",
      json: { plan: "free" },
    });
    // If no subscription: may succeed with downgrade or fail with no-sub error.
    // Either way, we get a structured response.
    const body: any = await res.json();
    expect(body).toSatisfy(
      (b: any) => b.data !== undefined || b.error !== undefined,
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/cancel
// ---------------------------------------------------------------------------

describe("POST /api/billing/cancel", () => {
  it("returns structured response (422 if no subscription)", async () => {
    const res = await billingRequest(cfg, "/api/billing/cancel", {
      method: "POST",
      json: {},
    });

    const body: any = await res.json();
    if (res.status === 200) {
      expect(body.data).toHaveProperty("canceled", true);
    } else {
      expect(res.status).toBe(422);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toContain("No active subscription");
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/portal
// ---------------------------------------------------------------------------

describe("POST /api/billing/portal", () => {
  it("returns 422 when returnUrl is missing", async () => {
    const res = await billingRequest(cfg, "/api/billing/portal", {
      method: "POST",
      json: {},
    });
    expect(res.status).toBe(422);

    const body: any = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("returnUrl");
  });

  it("returns portal URL or 422 (no customer)", async () => {
    const res = await billingRequest(cfg, "/api/billing/portal", {
      method: "POST",
      json: { returnUrl: "https://llmrank.app/dashboard/settings" },
    });

    const body: any = await res.json();
    if (res.status === 200) {
      expect(body.data).toHaveProperty("url");
      expect(body.data.url).toContain("stripe.com");
    } else {
      expect(res.status).toBe(422);
      expect(body.error.message).toContain("subscription");
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/webhook
// ---------------------------------------------------------------------------

describe("POST /api/billing/webhook", () => {
  it("returns 401 when stripe-signature header is missing", async () => {
    const res = await billingRequest(cfg, "/api/billing/webhook", {
      method: "POST",
      json: { type: "checkout.session.completed" },
    });
    expect(res.status).toBe(401);

    const body: any = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when signature is invalid", async () => {
    const res = await billingRequest(cfg, "/api/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=123,v1=invalid_signature" },
      json: { type: "checkout.session.completed" },
    });
    expect(res.status).toBe(401);

    const body: any = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/validate-promo
// ---------------------------------------------------------------------------

describe("POST /api/billing/validate-promo", () => {
  it("returns 422 when code is missing", async () => {
    const res = await billingRequest(cfg, "/api/billing/validate-promo", {
      method: "POST",
      json: {},
    });
    expect(res.status).toBe(422);

    const body: any = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for non-existent promo code", async () => {
    const res = await billingRequest(cfg, "/api/billing/validate-promo", {
      method: "POST",
      json: { code: "FAKE_CODE_12345" },
    });

    const body: any = await res.json();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Auth guard — unauthenticated requests
// ---------------------------------------------------------------------------

describe("Auth guards", () => {
  it("returns 401 for unauthenticated /api/billing/usage", async () => {
    const url = `${cfg.baseUrl}/api/billing/usage`;
    const res = await fetch(url, {
      headers: { Origin: "https://llmrank.app" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for unauthenticated /api/billing/checkout", async () => {
    const url = `${cfg.baseUrl}/api/billing/checkout`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://llmrank.app",
      },
      body: JSON.stringify({
        plan: "starter",
        successUrl: "https://llmrank.app/s",
        cancelUrl: "https://llmrank.app/c",
      }),
    });
    expect(res.status).toBe(401);
  });
});
