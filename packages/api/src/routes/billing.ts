import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { userQueries, billingQueries } from "@llm-boost/db";
import {
  StripeGateway,
  priceIdFromPlanCode,
  handleWebhook,
  type StripeEvent,
} from "@llm-boost/billing";
import { PLAN_LIMITS } from "@llm-boost/shared";

export const billingRoutes = new Hono<AppEnv>();

// ─── POST /checkout — Create Stripe Checkout session ──────────────

billingRoutes.post("/checkout", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{
    plan: string;
    successUrl: string;
    cancelUrl: string;
  }>();

  if (!body.plan || !body.successUrl || !body.cancelUrl) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "plan, successUrl, and cancelUrl are required",
        },
      },
      422,
    );
  }

  const priceId = priceIdFromPlanCode(body.plan);
  if (!priceId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid plan: ${body.plan}`,
        },
      },
      422,
    );
  }

  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);
  const customerId = await gateway.ensureCustomer(
    user.email,
    userId,
    user.stripeCustomerId ?? undefined,
  );

  const { sessionId, url } = await gateway.createCheckoutSession({
    customerId,
    priceId,
    userId,
    planCode: body.plan,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
  });

  return c.json({ data: { sessionId, url } });
});

// ─── GET /usage — Current plan + usage limits ────────────────────

billingRoutes.get("/usage", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  }

  const limits = PLAN_LIMITS[user.plan];
  return c.json({
    data: {
      plan: user.plan,
      crawlCreditsRemaining: user.crawlCreditsRemaining,
      crawlCreditsTotal: limits.crawlsPerMonth,
      maxPagesPerCrawl: limits.pagesPerCrawl,
      maxDepth: limits.maxCrawlDepth,
      maxProjects: limits.projects,
    },
  });
});

// ─── GET /subscription — Current subscription details ────────────

billingRoutes.get("/subscription", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const sub = await billingQueries(db).getActiveSubscription(userId);

  return c.json({
    data: sub
      ? {
          id: sub.id,
          planCode: sub.planCode,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          canceledAt: sub.canceledAt?.toISOString() ?? null,
        }
      : null,
  });
});

// ─── GET /payments — User's payment history ──────────────────────

billingRoutes.get("/payments", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const paymentList = await billingQueries(db).listPayments(userId);

  return c.json({
    data: paymentList.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      stripeInvoiceId: p.stripeInvoiceId,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

// ─── POST /cancel — Cancel subscription at period end ────────────

billingRoutes.post("/cancel", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const sub = await billingQueries(db).getActiveSubscription(userId);

  if (!sub?.stripeSubscriptionId) {
    return c.json(
      {
        error: { code: "VALIDATION_ERROR", message: "No active subscription" },
      },
      422,
    );
  }

  const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);
  await gateway.cancelAtPeriodEnd(sub.stripeSubscriptionId);
  await billingQueries(db).markCancelAtPeriodEnd(sub.stripeSubscriptionId);

  return c.json({ data: { canceled: true } });
});

// ─── POST /portal — Stripe Customer Portal ──────────────────────

billingRoutes.post("/portal", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);

  if (!user?.stripeCustomerId) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "No active subscription found",
        },
      },
      422,
    );
  }

  const body = await c.req.json<{ returnUrl: string }>();
  const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);
  const url = await gateway.createPortalSession(
    user.stripeCustomerId,
    body.returnUrl,
  );

  return c.json({ data: { url } });
});

// ─── POST /webhook — Stripe webhook handler ─────────────────────

billingRoutes.post("/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Missing Stripe signature" } },
      401,
    );
  }

  const rawBody = await c.req.text();
  const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);

  let event: StripeEvent;
  try {
    event = await gateway.verifyWebhookSignature(
      rawBody,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid signature" } },
      401,
    );
  }

  const db = c.get("db");
  await handleWebhook(event, db, c.env.STRIPE_SECRET_KEY);

  return c.json({ received: true });
});
