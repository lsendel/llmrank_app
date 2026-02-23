# Billing Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken billing flows, add upgrade proration, and create a dedicated `/dashboard/billing` page with Stripe Customer Portal integration.

**Architecture:** New `/dashboard/billing` page with 4 sections (plan hero, subscription management, plan comparison, payment history). Backend adds a `POST /api/billing/upgrade` endpoint for in-place plan upgrades with proration. Stripe Customer Portal handles invoices/payment method/cancellation.

**Tech Stack:** Next.js App Router, shadcn/ui (Card, Badge, Button, Dialog), Hono API, Stripe Billing Portal + Proration API

---

### Task 1: Add upgrade API endpoint with proration

**Files:**

- Modify: `apps/api/src/services/billing-service.ts`
- Modify: `apps/api/src/routes/billing.ts`
- Modify: `packages/billing/src/gateway.ts`

**Step 1: Add `upgradeSubscriptionPrice` to StripeGateway**

In `packages/billing/src/gateway.ts`, add a new method after `updateSubscriptionPrice`:

```typescript
/**
 * Upgrade a subscription's price with proration.
 * proration_behavior "create_prorations" charges the difference immediately.
 */
async upgradeSubscriptionPrice(
  subscriptionId: string,
  itemId: string,
  newPriceId: string,
): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(
    this.secretKey,
    "POST",
    `/subscriptions/${subscriptionId}`,
    {
      "items[0][id]": itemId,
      "items[0][price]": newPriceId,
      proration_behavior: "create_prorations",
    },
  );
}
```

**Step 2: Add `upgrade()` method to billing service**

In `apps/api/src/services/billing-service.ts`, add after the `downgrade` method:

```typescript
async upgrade(args: {
  userId: string;
  targetPlan: string;
  stripeSecretKey: string;
  successUrl: string;
  cancelUrl: string;
  db?: Database;
}) {
  const user = await deps.users.getById(args.userId);
  if (!user) {
    throw new ServiceError("NOT_FOUND", 404, "User not found");
  }

  const targetPriceId = priceIdFromPlanCode(args.targetPlan);
  if (!targetPriceId) {
    throw new ServiceError("VALIDATION_ERROR", 422, `Invalid plan: ${args.targetPlan}`);
  }

  // If user has an active subscription, do an in-place upgrade with proration
  const subscription = await deps.billing.getActiveSubscription(args.userId);
  if (subscription?.stripeSubscriptionId) {
    const gateway = new StripeGateway(args.stripeSecretKey);
    const stripeSub = await gateway.getSubscription(subscription.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) {
      throw new ServiceError("VALIDATION_ERROR", 422, "Subscription has no items");
    }

    await gateway.upgradeSubscriptionPrice(
      subscription.stripeSubscriptionId,
      itemId,
      targetPriceId,
    );

    // Update local plan immediately
    await deps.users.updatePlan(args.userId, args.targetPlan, subscription.stripeSubscriptionId);

    return { upgraded: true, targetPlan: args.targetPlan, method: "proration" };
  }

  // No active subscription — fall back to Stripe Checkout
  const session = await this.checkout({
    userId: args.userId,
    plan: args.targetPlan,
    successUrl: args.successUrl,
    cancelUrl: args.cancelUrl,
    stripeSecretKey: args.stripeSecretKey,
    db: args.db,
  });

  return { upgraded: false, targetPlan: args.targetPlan, method: "checkout", ...session };
}
```

**Step 3: Add `/upgrade` route**

In `apps/api/src/routes/billing.ts`, add after the `/downgrade` route:

```typescript
// ─── POST /upgrade — Upgrade subscription with proration ──────
billingRoutes.post("/upgrade", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json<{
    plan: string;
    successUrl: string;
    cancelUrl: string;
  }>();

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
    const data = await service.upgrade({
      userId,
      targetPlan: body.plan,
      stripeSecretKey: c.env.STRIPE_SECRET_KEY,
      successUrl: body.successUrl ?? "",
      cancelUrl: body.cancelUrl ?? "",
      db,
    });
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 4: Add `upgrade` to API client**

In `apps/web/src/lib/api.ts`, add to the `billing` namespace:

```typescript
async upgrade(
  plan: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ upgraded: boolean; targetPlan: string; method: string; sessionId?: string; url?: string }> {
  const res = await apiClient.post<ApiEnvelope<{
    upgraded: boolean;
    targetPlan: string;
    method: string;
    sessionId?: string;
    url?: string;
  }>>("/api/billing/upgrade", { plan, successUrl, cancelUrl });
  return res.data;
},
```

**Step 5: Verify build**

Run: `pnpm build`
Expected: builds without error

**Step 6: Commit**

```bash
git add packages/billing/src/gateway.ts apps/api/src/services/billing-service.ts apps/api/src/routes/billing.ts apps/web/src/lib/api.ts
git commit -m "feat(billing): add upgrade endpoint with Stripe proration"
```

---

### Task 2: Create dedicated billing page layout

**Files:**

- Create: `apps/web/src/app/dashboard/billing/layout.tsx`
- Create: `apps/web/src/app/dashboard/billing/page.tsx`

**Step 1: Create billing layout with metadata**

```typescript
// apps/web/src/app/dashboard/billing/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing | LLM Rank",
  description: "Manage your subscription, plan, and payment history.",
};

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

**Step 2: Create the billing page**

Create `apps/web/src/app/dashboard/billing/page.tsx` — this is a large file with 4 sections. Full code:

```typescript
"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  Zap,
  AlertTriangle,
  Check,
  Star,
  ArrowDown,
  ExternalLink,
  CheckCircle2,
  X,
  Receipt,
  Crown,
} from "lucide-react";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type BillingInfo,
  type SubscriptionInfo,
  type PaymentRecord,
  type PromoInfo,
} from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const plans = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    priceNote: "",
    popular: false,
    features: [
      "1 project",
      "10 pages per crawl",
      "2 crawls per month",
      "30-day history",
    ],
  },
  {
    tier: "starter",
    name: "Starter",
    price: "$79",
    priceNote: "/mo",
    popular: false,
    features: [
      "5 projects",
      "100 pages per crawl",
      "10 crawls per month",
      "90-day history",
      "Lighthouse analysis",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$149",
    priceNote: "/mo",
    popular: true,
    features: [
      "20 projects",
      "500 pages per crawl",
      "30 crawls per month",
      "1-year history",
      "API access",
      "GSC + PageSpeed Insights",
    ],
  },
  {
    tier: "agency",
    name: "Agency",
    price: "$299",
    priceNote: "/mo",
    popular: false,
    features: [
      "50 projects",
      "2000 pages per crawl",
      "Unlimited crawls",
      "2-year history",
      "API access",
      "Custom LLM prompts",
      "All 4 integrations",
    ],
  },
];

const planNameMap: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

const planPriceMap: Record<string, number> = {
  free: 0,
  starter: 79,
  pro: 149,
  agency: 299,
};

export default function BillingPage() {
  const { withAuth } = useApi();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const { data: billing } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );
  const { data: subscription, mutate: mutateSubscription } =
    useApiSWR<SubscriptionInfo | null>(
      "billing-subscription",
      useCallback(() => api.billing.getSubscription(), []),
    );
  const { data: payments } = useApiSWR<PaymentRecord[]>(
    "billing-payments",
    useCallback(() => api.billing.getPayments(), []),
  );

  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [downgradingTo, setDowngradingTo] = useState<string | null>(null);
  const [downgrading, setDowngrading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoValid, setPromoValid] = useState<PromoInfo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(() => {
    if (searchParams.get("upgraded") === "true") {
      window.history.replaceState({}, "", "/dashboard/billing");
      return "Your plan has been upgraded successfully!";
    }
    return null;
  });

  const currentTier = billing?.plan ?? "free";
  const currentPlanName = planNameMap[currentTier] ?? "Free";
  const crawlsTotal = billing?.crawlCreditsTotal ?? 0;
  const creditsRemaining = Math.min(
    billing?.crawlCreditsRemaining ?? 0,
    crawlsTotal,
  );
  const crawlsUsed = Math.max(0, crawlsTotal - creditsRemaining);
  const creditsPercentUsed =
    crawlsTotal > 0 ? Math.min(100, (crawlsUsed / crawlsTotal) * 100) : 0;
  const currentTierIndex = plans.findIndex((p) => p.tier === currentTier);

  async function handleOpenPortal() {
    setPortalLoading(true);
    try {
      await withAuth(async () => {
        const result = await api.billing.createPortalSession(
          window.location.href,
        );
        window.location.href = result.url;
      });
    } catch {
      toast({
        title: "Unable to open billing portal",
        description:
          "Make sure you have an active subscription. If this persists, contact support.",
        variant: "destructive",
      });
      setPortalLoading(false);
    }
  }

  async function handleCancelSubscription() {
    setCanceling(true);
    try {
      await withAuth(async () => {
        await api.billing.cancelSubscription();
      });
      setCancelDialogOpen(false);
      setDowngradeDialogOpen(false);
      await mutateSubscription();
      toast({ title: "Subscription canceled", description: "You'll keep access until the end of your billing period." });
    } catch {
      toast({ title: "Failed to cancel", description: "Please try again or contact support.", variant: "destructive" });
    } finally {
      setCanceling(false);
    }
  }

  async function handleValidatePromo() {
    if (!promoCode.trim()) return;
    setValidatingPromo(true);
    setPromoError(null);
    try {
      const info = await api.billing.validatePromo(promoCode.trim());
      setPromoValid(info);
    } catch (err) {
      setPromoValid(null);
      setPromoError(err instanceof Error ? err.message : "Invalid promo code");
    } finally {
      setValidatingPromo(false);
    }
  }

  async function handleDowngrade(targetPlan: string) {
    setDowngrading(true);
    try {
      await withAuth(async () => {
        await api.billing.downgrade(targetPlan);
      });
      setDowngradeDialogOpen(false);
      setDowngradingTo(null);
      await mutateSubscription();
      toast({ title: "Plan downgraded", description: `Your plan will change to ${planNameMap[targetPlan]} at the next billing cycle.` });
    } catch {
      toast({ title: "Downgrade failed", description: "Please try again or contact support.", variant: "destructive" });
    } finally {
      setDowngrading(false);
    }
  }

  async function handlePlanAction(planTier: string) {
    const planIndex = plans.findIndex((p) => p.tier === planTier);
    const isDowngrade = planIndex < currentTierIndex;

    // Downgrading
    if (isDowngrade) {
      setDowngradingTo(planTier === "free" ? null : planTier);
      setDowngradeDialogOpen(true);
      return;
    }

    // Upgrade
    setUpgrading(planTier);
    try {
      await withAuth(async () => {
        const result = await api.billing.upgrade(
          planTier,
          window.location.origin + "/dashboard/billing?upgraded=true",
          window.location.origin + "/dashboard/billing",
        );
        if (result.method === "checkout" && result.url) {
          window.location.href = result.url;
        } else {
          // In-place upgrade succeeded
          await mutateSubscription();
          toast({ title: "Plan upgraded!", description: `You're now on the ${planNameMap[planTier]} plan. Prorated charges have been applied.` });
          setUpgrading(null);
        }
      });
    } catch {
      toast({ title: "Upgrade failed", description: "Please try again or contact support.", variant: "destructive" });
      setUpgrading(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Success banner */}
      {successBanner && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{successBanner}</p>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-green-600 hover:text-green-800 dark:text-green-400">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your subscription, plan, and payment history.
        </p>
      </div>

      {/* ─── Section 1: Current Plan Hero ─────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {currentPlanName} Plan
                {currentTier !== "free" && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    ${planPriceMap[currentTier]}/mo
                  </span>
                )}
              </CardTitle>
            </div>
            {subscription && (
              <Badge
                variant={
                  subscription.cancelAtPeriodEnd
                    ? "secondary"
                    : subscription.status === "active"
                      ? "default"
                      : "destructive"
                }
              >
                {subscription.cancelAtPeriodEnd
                  ? "Canceling"
                  : subscription.status === "past_due"
                    ? "Past Due"
                    : "Active"}
              </Badge>
            )}
            {!subscription && currentTier === "free" && (
              <Badge variant="secondary">Free</Badge>
            )}
          </div>
          {subscription?.currentPeriodEnd && (
            <CardDescription>
              {subscription.cancelAtPeriodEnd
                ? `Access until ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : `Next billing date: ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Usage progress bars */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Crawl Credits</span>
              <span className="font-medium">
                {creditsRemaining} of {crawlsTotal} remaining
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${creditsPercentUsed}%` }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Max Projects</p>
              <p className="text-lg font-semibold">
                {billing?.maxProjects ?? "--"}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Pages per Crawl</p>
              <p className="text-lg font-semibold">
                {billing?.maxPagesPerCrawl ?? "--"}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Monthly Crawls</p>
              <p className="text-lg font-semibold">
                {crawlsUsed} / {crawlsTotal}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          {currentTier !== "agency" && (
            <Button
              onClick={() =>
                handlePlanAction(plans[currentTierIndex + 1]?.tier ?? "starter")
              }
            >
              <Zap className="h-4 w-4" />
              Upgrade Plan
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* ─── Section 2: Subscription Management ───────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Subscription Management</CardTitle>
          </div>
          <CardDescription>
            {subscription
              ? "View invoices, update payment method, or manage your subscription through Stripe."
              : "You're on the Free plan. Upgrade to unlock more features."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="gap-2">
          {subscription && (
            <>
              <Button onClick={handleOpenPortal} disabled={portalLoading}>
                <ExternalLink className="h-4 w-4" />
                {portalLoading ? "Opening..." : "Manage in Stripe"}
              </Button>
              {!subscription.cancelAtPeriodEnd &&
                subscription.status === "active" && (
                  <Dialog
                    open={cancelDialogOpen}
                    onOpenChange={setCancelDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Cancel Subscription
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cancel subscription?</DialogTitle>
                        <DialogDescription>
                          Your subscription will remain active until the end of
                          the current billing period. You won&apos;t be charged
                          again.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setCancelDialogOpen(false)}
                        >
                          Keep Subscription
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleCancelSubscription}
                          disabled={canceling}
                        >
                          {canceling ? "Canceling..." : "Yes, cancel"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
            </>
          )}
          {!subscription && (
            <Button
              onClick={() =>
                handlePlanAction(plans[currentTierIndex + 1]?.tier ?? "starter")
              }
            >
              <Zap className="h-4 w-4" />
              Choose a Plan
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* ─── Section 3: Plan Comparison ────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Plans</CardTitle>
          <CardDescription>
            Compare plans and choose the best fit for your needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan, index) => {
              const isCurrent = plan.tier === currentTier;
              const isUpgrade = index > currentTierIndex;
              return (
                <div
                  key={plan.tier}
                  className={`relative rounded-lg border p-4 ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : plan.popular
                        ? "border-primary/60 shadow-sm"
                        : "border-border"
                  }`}
                >
                  {plan.popular && !isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground shadow-sm">
                        <Star className="mr-1 h-3 w-3" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">{plan.name}</h3>
                    {isCurrent && <Badge variant="default">Current</Badge>}
                  </div>
                  <p className="mb-3">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    {plan.priceNote && (
                      <span className="text-sm text-muted-foreground">
                        {plan.priceNote}
                      </span>
                    )}
                  </p>
                  <ul className="space-y-1.5">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <Button
                      variant={isUpgrade && plan.popular ? "default" : "outline"}
                      size="sm"
                      className="mt-4 w-full"
                      disabled={upgrading === plan.tier}
                      onClick={() => handlePlanAction(plan.tier)}
                    >
                      {upgrading === plan.tier ? (
                        "Processing..."
                      ) : isUpgrade ? (
                        <>
                          <Zap className="h-3.5 w-3.5" />
                          Upgrade
                        </>
                      ) : (
                        <>
                          <ArrowDown className="h-3.5 w-3.5" />
                          Downgrade
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Promo code */}
          <div className="mt-4 flex items-center gap-2">
            <Input
              placeholder="Promo code"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setPromoValid(null);
                setPromoError(null);
              }}
              className="max-w-[200px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidatePromo}
              disabled={validatingPromo || !promoCode.trim()}
            >
              {validatingPromo ? "Checking..." : "Apply"}
            </Button>
            {promoValid && (
              <Badge variant="default">
                {promoValid.discountType === "percent_off"
                  ? `${promoValid.discountValue}% off`
                  : promoValid.discountType === "free_months"
                    ? `${promoValid.discountValue} free months`
                    : `$${(promoValid.discountValue / 100).toFixed(2)} off`}
              </Badge>
            )}
            {promoError && (
              <span className="text-sm text-destructive">{promoError}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Downgrade confirmation dialog */}
      <Dialog
        open={downgradeDialogOpen}
        onOpenChange={(open) => {
          setDowngradeDialogOpen(open);
          if (!open) setDowngradingTo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Downgrade to {planNameMap[downgradingTo ?? "free"] ?? "Free"}?
            </DialogTitle>
            <DialogDescription>
              {downgradingTo
                ? `Your plan will change to ${planNameMap[downgradingTo]} at the next billing cycle.`
                : "Your subscription will be canceled at the end of the billing period."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/50">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Projects and data exceeding the new plan limits may become
              read-only.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDowngradeDialogOpen(false);
                setDowngradingTo(null);
              }}
            >
              Keep Current Plan
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (downgradingTo) {
                  handleDowngrade(downgradingTo);
                } else {
                  handleCancelSubscription();
                }
              }}
              disabled={canceling || downgrading}
            >
              {canceling || downgrading
                ? "Processing..."
                : `Downgrade to ${planNameMap[downgradingTo ?? "free"] ?? "Free"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Section 4: Payment History ────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Payment History</CardTitle>
            </div>
            {subscription && (
              <Button variant="ghost" size="sm" onClick={handleOpenPortal}>
                <ExternalLink className="h-3.5 w-3.5" />
                View all in Stripe
              </Button>
            )}
          </div>
          <CardDescription>Your recent payments and invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          {payments && payments.length > 0 ? (
            <div className="divide-y">
              {payments.map((payment: PaymentRecord) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      ${(payment.amountCents / 100).toFixed(2)}{" "}
                      {payment.currency.toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      payment.status === "succeeded"
                        ? "default"
                        : payment.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {payment.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No payments yet. Payment history will appear here when you
              subscribe to a paid plan.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Verify it renders**

Run: `pnpm --filter web build`
Expected: builds without error

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/billing/
git commit -m "feat(web): add dedicated /dashboard/billing page"
```

---

### Task 3: Add Billing to dashboard sidebar

**Files:**

- Modify: `apps/web/src/app/dashboard/layout.tsx`

**Step 1: Add Billing link to sidebar**

In `apps/web/src/app/dashboard/layout.tsx`, add `Receipt` to the lucide-react import and add the billing link to `baseSidebarLinks`:

```typescript
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  ShieldCheck,
  Receipt,
} from "lucide-react";

const baseSidebarLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/layout.tsx
git commit -m "feat(web): add Billing to dashboard sidebar"
```

---

### Task 4: Simplify billing settings tab

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx`
- Modify: `apps/web/src/components/settings/billing-section.tsx`

**Step 1: Replace billing settings with redirect link**

Simplify `apps/web/src/components/settings/billing-section.tsx` to a minimal component that links to the new billing page:

```typescript
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreditCard, ArrowRight } from "lucide-react";

export function BillingSection() {
  return (
    <div className="pt-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Billing</CardTitle>
          </div>
          <CardDescription>
            Manage your subscription, plan, and payment history on the dedicated
            billing page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/billing">
            <Button>
              Go to Billing
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Clean up unused imports in settings page**

In `apps/web/src/app/dashboard/settings/page.tsx`, remove the `BillingInfo` import from api.ts and the `useApiSWR` billing-info call if it was only used for the billing tab loading state. Keep the billing tab with the simplified component.

Review the file to see what's actually unused after the BillingSection simplification.

**Step 3: Update checkout/upgrade success redirect URLs**

In the existing billing routes, update the success URL from `/dashboard/settings?upgraded=true` to `/dashboard/billing?upgraded=true`. This was already done in the new billing page — just ensure consistency.

**Step 4: Commit**

```bash
git add apps/web/src/components/settings/billing-section.tsx apps/web/src/app/dashboard/settings/page.tsx
git commit -m "refactor(web): simplify billing settings tab to link to /dashboard/billing"
```

---

### Task 5: Verify full flow and fix build

**Step 1: Build all packages**

Run: `pnpm build`
Expected: builds without error

**Step 2: Run existing tests**

Run: `pnpm test`
Expected: existing tests still pass

**Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors (pre-existing ones OK)

**Step 4: Fix any issues found**

Address any build/test/typecheck failures.

**Step 5: Commit fixes if needed**

```bash
git add -A
git commit -m "fix(billing): resolve build issues from billing redesign"
```
