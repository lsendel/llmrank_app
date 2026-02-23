import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { createBillingRepository, createUserRepository } from "../repositories";
import {
  StripeGateway,
  handleWebhook,
  type StripeEvent,
} from "@llm-boost/billing";
import { createBillingService } from "../services/billing-service";
import { handleServiceError } from "../services/errors";

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

  const service = createBillingService({
    billing: createBillingRepository(db),
    users: createUserRepository(db),
  });

  try {
    const session = await service.checkout({
      userId,
      plan: body.plan,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      promoCode: (body as { promoCode?: string }).promoCode,
      db,
    });
    return c.json({ data: session });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── GET /usage — Current plan + usage limits ────────────────────

billingRoutes.get("/usage", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const service = createBillingService({
    billing: createBillingRepository(db),
    users: createUserRepository(db),
  });

  try {
    const data = await service.getUsage(userId);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── GET /subscription — Current subscription details ────────────

billingRoutes.get("/subscription", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const service = createBillingService({
    billing: createBillingRepository(db),
    users: createUserRepository(db),
  });

  const sub = await service.getSubscription(userId);
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
  const service = createBillingService({
    billing: createBillingRepository(db),
    users: createUserRepository(db),
  });

  const paymentList = await service.listPayments(userId);
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
  const service = createBillingService({
    billing: createBillingRepository(db),
    users: createUserRepository(db),
  });

  try {
    const data = await service.cancelAtPeriodEnd(
      userId,
      c.env.STRIPE_SECRET_KEY,
    );
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /validate-promo — Validate a promo code ──────────────

billingRoutes.post("/validate-promo", async (c) => {
  const body = await c.req.json<{ code: string }>();
  if (!body.code?.trim()) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "code is required" } },
      422,
    );
  }

  const db = c.get("db");
  const service = createBillingService({
    billing: createBillingRepository(db),
    users: createUserRepository(db),
  });

  try {
    const data = await service.validatePromo(body.code.trim(), db);
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /downgrade — Downgrade subscription at period end ─────

billingRoutes.post("/downgrade", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{ plan: string }>();

  if (!body.plan) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "plan is required" } },
      422,
    );
  }

  const service = createBillingService({
    billing: createBillingRepository(db),
    users: createUserRepository(db),
  });

  try {
    const data = await service.downgrade({
      userId,
      targetPlan: body.plan,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
    });
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /portal — Stripe Customer Portal ──────────────────────

billingRoutes.post("/portal", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{ returnUrl: string }>();
  if (!body.returnUrl) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "returnUrl is required",
        },
      },
      422,
    );
  }

  const service = createBillingService({
    billing: createBillingRepository(db),
    users: createUserRepository(db),
  });

  try {
    const data = await service.portal(
      userId,
      body.returnUrl,
      c.env.STRIPE_SECRET_KEY,
    );
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
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
    const log = c.get("logger");
    log.warn("Stripe webhook signature verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid signature" } },
      401,
    );
  }

  const db = c.get("db");
  try {
    await handleWebhook(event, db, c.env.STRIPE_SECRET_KEY);
  } catch (err) {
    const log = c.get("logger");
    log.error("Stripe webhook handler failed", {
      eventType: event.type,
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // Return 200 to prevent Stripe retry storms for application errors.
    // The error is logged for investigation.
  }

  return c.json({ received: true });
});
