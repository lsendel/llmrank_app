import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { adminMiddleware } from "../middleware/admin";
import { createAdminRepository } from "../repositories";
import { createAdminService } from "../services/admin-service";
import { createMonitoringService } from "../services/monitoring-service";
import { createNotificationService } from "../services/notification-service";
import { handleServiceError } from "../services/errors";
import { StripeGateway } from "@llm-boost/billing";
import {
  promoQueries,
  billingQueries,
  apiTokenQueries,
  adminQueries,
} from "@llm-boost/db";
import { normalizeDomain } from "@llm-boost/shared";

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", authMiddleware, adminMiddleware);

function buildAdminService(c: Context<AppEnv>) {
  return createAdminService({ admin: createAdminRepository(c.get("db")) });
}

adminRoutes.get("/stats", async (c) => {
  const service = buildAdminService(c);
  const stats = await service.getStats();
  return c.json({ data: stats });
});

adminRoutes.get("/metrics", async (c) => {
  const db = c.get("db");
  const notifications = createNotificationService(db, c.env.RESEND_API_KEY, {
    appBaseUrl: c.env.APP_BASE_URL,
  });
  const monitor = createMonitoringService(db, notifications);

  try {
    const metrics = await monitor.getSystemMetrics();

    // Include crawler health from KV
    const crawlerHealthRaw = await c.env.KV.get("crawler:health:latest");
    let crawlerHealth: unknown = null;
    if (crawlerHealthRaw) {
      try {
        crawlerHealth = JSON.parse(crawlerHealthRaw);
      } catch {
        console.error("[admin] Failed to parse crawler health data from KV");
      }
    }

    return c.json({ data: { ...metrics, crawlerHealth } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

adminRoutes.get("/customers", async (c) => {
  const service = buildAdminService(c);
  const page = parseInt(c.req.query("page") ?? "1", 10);
  const limit = parseInt(c.req.query("limit") ?? "25", 10);
  const search = c.req.query("search") ?? undefined;

  const result = await service.getCustomers({ page, limit, search });
  return c.json(result);
});

adminRoutes.get("/customers/:id", async (c) => {
  const service = buildAdminService(c);
  try {
    const detail = await service.getCustomerDetail(c.req.param("id"));
    return c.json({ data: detail });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

adminRoutes.get("/ingest", async (c) => {
  const service = buildAdminService(c);
  try {
    const detail = await service.getIngestDetails();
    return c.json({ data: detail });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

adminRoutes.post("/ingest/jobs/:id/retry", async (c) => {
  const service = buildAdminService(c);
  try {
    const result = await service.retryCrawlJob(
      c.req.param("id"),
      c.get("userId"),
    );
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

adminRoutes.post("/ingest/jobs/:id/cancel", async (c) => {
  const service = buildAdminService(c);
  const body = (await c.req.json<{ reason?: string }>().catch(() => ({}))) as {
    reason?: string;
  };
  try {
    const result = await service.cancelCrawlJob(
      c.req.param("id"),
      body.reason ?? "Cancelled by admin",
      c.get("userId"),
    );
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

adminRoutes.post("/ingest/outbox/:id/replay", async (c) => {
  const service = buildAdminService(c);
  try {
    const result = await service.replayOutboxEvent(
      c.req.param("id"),
      c.get("userId"),
    );
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/block — Ban a user ────────────────────

adminRoutes.post("/customers/:id/block", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");
  const body = (await c.req.json<{ reason?: string }>().catch(() => ({}))) as {
    reason?: string;
  };

  const service = buildAdminService(c);
  try {
    const result = await service.blockUser({
      targetId,
      adminId,
      reason: body.reason,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      db,
    });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/suspend — Suspend a user ──────────────

adminRoutes.post("/customers/:id/suspend", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");
  const body = (await c.req.json<{ reason?: string }>().catch(() => ({}))) as {
    reason?: string;
  };

  const service = buildAdminService(c);
  try {
    const result = await service.suspendUser({
      targetId,
      adminId,
      reason: body.reason,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      db,
    });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/unblock — Restore a user ──────────────

adminRoutes.post("/customers/:id/unblock", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");

  const service = buildAdminService(c);
  try {
    const result = await service.unblockUser({ targetId, adminId, db });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/change-plan — Admin force plan change ──

adminRoutes.post("/customers/:id/change-plan", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");
  const body = await c.req.json<{ plan: string }>();

  if (!body.plan) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "plan is required" } },
      422,
    );
  }

  const service = buildAdminService(c);
  try {
    const result = await service.changeUserPlan({
      targetId,
      adminId,
      plan: body.plan,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      db,
    });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/cancel-subscription — Admin cancel sub ─

adminRoutes.post("/customers/:id/cancel-subscription", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");

  const service = buildAdminService(c);
  try {
    const result = await service.cancelUserSubscription({
      targetId,
      adminId,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      db,
    });
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── GET /customers/:id/tokens — List user's API tokens ─────

adminRoutes.get("/customers/:id/tokens", async (c) => {
  const targetId = c.req.param("id");
  const db = c.get("db");
  const tokens = await apiTokenQueries(db).listByUser(targetId);
  return c.json({ data: tokens });
});

// ─── DELETE /customers/:id/tokens/:tokenId — Admin revoke token ─

adminRoutes.delete("/customers/:id/tokens/:tokenId", async (c) => {
  const adminId = c.get("userId");
  const targetId = c.req.param("id");
  const tokenId = c.req.param("tokenId");
  const db = c.get("db");

  // Verify token belongs to this user
  const tokens = await apiTokenQueries(db).listByUser(targetId);
  const owned = tokens.some((t) => t.id === tokenId);
  if (!owned) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Token not found" } },
      404,
    );
  }

  const revoked = await apiTokenQueries(db).revoke(tokenId);

  const service = buildAdminService(c);
  await service.recordAction({
    actorId: adminId,
    action: "revoke_token",
    targetType: "api_token",
    targetId: tokenId,
    reason: `Admin revoked token for user ${targetId}`,
  });

  return c.json({ data: revoked });
});

// ─── GET /promos — List all promo codes ─────────────────────────

adminRoutes.get("/promos", async (c) => {
  const db = c.get("db");
  const promoList = await promoQueries(db).list();
  return c.json({ data: promoList });
});

// ─── POST /promos — Create a promo code ─────────────────────────

adminRoutes.post("/promos", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const body = await c.req.json<{
    code: string;
    discountType: "percent_off" | "amount_off" | "free_months";
    discountValue: number;
    duration: "once" | "repeating" | "forever";
    durationMonths?: number;
    maxRedemptions?: number;
    expiresAt?: string;
  }>();

  if (
    !body.code?.trim() ||
    !body.discountType ||
    !body.discountValue ||
    !body.duration
  ) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message:
            "code, discountType, discountValue, and duration are required",
        },
      },
      422,
    );
  }

  try {
    const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);

    // Build Stripe coupon params
    const couponOpts: Parameters<typeof gateway.createCoupon>[0] = {
      duration: body.duration,
      name: `Promo: ${body.code.toUpperCase()}`,
    };

    if (body.discountType === "percent_off") {
      couponOpts.percentOff = body.discountValue;
    } else if (body.discountType === "amount_off") {
      couponOpts.amountOff = body.discountValue;
    } else if (body.discountType === "free_months") {
      couponOpts.percentOff = 100;
      couponOpts.duration = "repeating";
      couponOpts.durationInMonths = body.discountValue;
    }

    if (body.duration === "repeating" && body.durationMonths) {
      couponOpts.durationInMonths = body.durationMonths;
    }

    const stripeCoupon = await gateway.createCoupon(couponOpts);

    const stripePromoCode = await gateway.createPromotionCode(
      stripeCoupon.id,
      body.code,
      {
        maxRedemptions: body.maxRedemptions ?? undefined,
        expiresAt: body.expiresAt
          ? Math.floor(new Date(body.expiresAt).getTime() / 1000)
          : undefined,
      },
    );

    const promo = await promoQueries(db).create({
      code: body.code,
      stripeCouponId: stripeCoupon.id,
      stripePromotionCodeId: stripePromoCode.id,
      discountType: body.discountType,
      discountValue: body.discountValue,
      duration:
        body.discountType === "free_months" ? "repeating" : body.duration,
      durationMonths:
        body.discountType === "free_months"
          ? body.discountValue
          : body.durationMonths,
      maxRedemptions: body.maxRedemptions,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      createdBy: adminId,
    });

    const service = buildAdminService(c);
    await service.recordAction({
      actorId: adminId,
      action: "create_promo",
      targetType: "promo",
      targetId: promo.id,
    });

    return c.json({ data: promo }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── DELETE /promos/:id — Deactivate a promo code ───────────────

adminRoutes.delete("/promos/:id", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const promoId = c.req.param("id");

  try {
    const promo = await promoQueries(db).getById(promoId);
    if (!promo) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Promo not found" } },
        404,
      );
    }

    // Deactivate in Stripe (best-effort — may not exist if key changed)
    const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);
    if (promo.stripePromotionCodeId) {
      try {
        await gateway.deactivatePromotionCode(promo.stripePromotionCodeId);
      } catch {
        // Stripe promo may belong to a different account; still clean up locally
      }
    }

    await promoQueries(db).deactivate(promoId);

    const service = buildAdminService(c);
    await service.recordAction({
      actorId: adminId,
      action: "deactivate_promo",
      targetType: "promo",
      targetId: promoId,
    });

    return c.json({ data: { deactivated: true } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── POST /customers/:id/apply-promo — Apply promo to customer ──

adminRoutes.post("/customers/:id/apply-promo", async (c) => {
  const db = c.get("db");
  const adminId = c.get("userId");
  const targetId = c.req.param("id");
  const body = await c.req.json<{ promoId: string }>();

  if (!body.promoId) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "promoId is required" } },
      422,
    );
  }

  try {
    const promo = await promoQueries(db).getById(body.promoId);
    if (!promo || !promo.active) {
      return c.json(
        {
          error: { code: "NOT_FOUND", message: "Promo not found or inactive" },
        },
        404,
      );
    }

    const sub = await billingQueries(db).getActiveSubscription(targetId);
    if (!sub?.stripeSubscriptionId) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Customer has no active subscription",
          },
        },
        422,
      );
    }

    const gateway = new StripeGateway(c.env.STRIPE_SECRET_KEY);
    await gateway.applyDiscountToSubscription(
      sub.stripeSubscriptionId,
      promo.stripeCouponId,
    );
    await promoQueries(db).incrementRedeemed(promo.id);

    const service = buildAdminService(c);
    await service.recordAction({
      actorId: adminId,
      action: "apply_promo",
      targetType: "user",
      targetId,
      reason: `Applied promo ${promo.code}`,
    });

    return c.json({ data: { applied: true, promoCode: promo.code } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// ─── GET /blocked-domains — List all blocked domains ─────────────

adminRoutes.get("/blocked-domains", async (c) => {
  const db = c.get("db");
  const queries = adminQueries(db);
  const domains = await queries.listBlockedDomains();
  return c.json({ data: domains });
});

// ─── POST /blocked-domains — Block a domain ─────────────────────

adminRoutes.post("/blocked-domains", async (c) => {
  const db = c.get("db");
  const user = c.get("userId");
  const body = await c.req.json<{ domain?: string; reason?: string }>();

  const domain = normalizeDomain(body.domain ?? "");
  if (!domain) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Domain is required" } },
      422,
    );
  }

  const queries = adminQueries(db);
  const existing = await queries.isBlocked(domain);
  if (existing) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Domain is already blocked",
        },
      },
      409,
    );
  }

  const row = await queries.addBlockedDomain(domain, body.reason ?? null, user);
  return c.json({ data: row }, 201);
});

// ─── DELETE /blocked-domains/:id — Unblock a domain ──────────────

adminRoutes.delete("/blocked-domains/:id", async (c) => {
  const db = c.get("db");
  const queries = adminQueries(db);
  const row = await queries.removeBlockedDomain(c.req.param("id"));
  if (!row) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Blocked domain not found" } },
      404,
    );
  }
  return c.json({ data: row });
});

// ─── GET /settings — Get admin settings ──────────────────────────

adminRoutes.get("/settings", async (c) => {
  const db = c.get("db");
  const queries = adminQueries(db);
  const httpFallback = await queries.getSetting("http_fallback_enabled");
  return c.json({
    data: {
      http_fallback_enabled: httpFallback?.value === true,
    },
  });
});

// ─── PUT /settings/:key — Update an admin setting ────────────────

adminRoutes.put("/settings/:key", async (c) => {
  const db = c.get("db");
  const user = c.get("userId");
  const key = c.req.param("key");
  const body = await c.req.json<{ value: unknown }>();

  const allowedKeys = ["http_fallback_enabled"];
  if (!allowedKeys.includes(key)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Unknown setting: ${key}`,
        },
      },
      422,
    );
  }

  const queries = adminQueries(db);
  const row = await queries.setSetting(key, body.value, user);
  return c.json({ data: row });
});
