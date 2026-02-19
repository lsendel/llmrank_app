"use client";

import { useCallback, useState } from "react";
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
import {
  CreditCard,
  Zap,
  AlertTriangle,
  Check,
  Star,
  ArrowDown,
} from "lucide-react";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import { Input } from "@/components/ui/input";
import {
  api,
  type BillingInfo,
  type SubscriptionInfo,
  type PaymentRecord,
  type PromoInfo,
} from "@/lib/api";

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

export function BillingSection() {
  const { withAuth } = useApi();

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
  const [promoCode, setPromoCode] = useState("");
  const [promoValid, setPromoValid] = useState<PromoInfo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const currentTier = billing?.plan ?? "free";
  const currentPlanName = planNameMap[currentTier] ?? "Free";
  const crawlsTotal = billing?.crawlCreditsTotal ?? 0;
  const creditsRemaining = Math.min(
    billing?.crawlCreditsRemaining ?? 0,
    crawlsTotal,
  );
  const crawlsUsed = Math.max(0, crawlsTotal - creditsRemaining);
  const creditsPercentUsed =
    crawlsTotal > 0
      ? Math.min(100, Math.max(0, (crawlsUsed / crawlsTotal) * 100))
      : 0;
  const currentTierIndex = plans.findIndex((p) => p.tier === currentTier);

  async function handleCancelSubscription() {
    setCanceling(true);
    try {
      await withAuth(async () => {
        await api.billing.cancelSubscription();
      });
      setCancelDialogOpen(false);
      setDowngradeDialogOpen(false);
      await mutateSubscription();
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error(err);
    } finally {
      setDowngrading(false);
    }
  }

  async function handlePlanAction(planTier: string) {
    const planIndex = plans.findIndex((p) => p.tier === planTier);
    const isDowngrade = planIndex < currentTierIndex;

    // Downgrading to Free
    if (planTier === "free" && isDowngrade) {
      setDowngradeDialogOpen(true);
      return;
    }

    // Paid-to-paid downgrade
    if (isDowngrade) {
      setDowngradingTo(planTier);
      setDowngradeDialogOpen(true);
      return;
    }

    // Upgrade: Stripe checkout
    setUpgrading(planTier);
    try {
      await withAuth(async () => {
        const result = await api.billing.createCheckoutSession(
          planTier,
          window.location.origin + "/dashboard/settings?upgraded=true",
          window.location.origin + "/dashboard/settings",
        );
        window.location.href = result.url;
      });
    } catch (err) {
      console.error(err);
      setUpgrading(null);
    }
  }

  return (
    <div className="space-y-8 pt-4">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Current Plan</CardTitle>
          </div>
          <CardDescription>
            You are on the{" "}
            <span className="font-semibold text-foreground">
              {currentPlanName}
            </span>{" "}
            plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Credits */}
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

          {/* Usage stats */}
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
              <p className="text-xs text-muted-foreground">
                Monthly Crawls Used
              </p>
              <p className="text-lg font-semibold">
                {crawlsUsed} / {crawlsTotal}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
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

      {/* Subscription Management */}
      {subscription && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Subscription</CardTitle>
            </div>
            <CardDescription>Manage your active subscription.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
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
              <span className="text-sm font-medium capitalize">
                {subscription.planCode} plan
              </span>
            </div>
            {subscription.currentPeriodEnd && (
              <p className="text-sm text-muted-foreground">
                {subscription.cancelAtPeriodEnd
                  ? "Access until "
                  : "Next billing date: "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </CardContent>
          <CardFooter className="gap-2">
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
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await withAuth(async () => {
                    const result = await api.billing.createPortalSession(
                      window.location.href,
                    );
                    window.location.href = result.url;
                  });
                } catch (err) {
                  console.error(err);
                }
              }}
            >
              Manage Billing
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Plan comparison */}
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
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <Button
                      variant={
                        isUpgrade && plan.popular ? "default" : "outline"
                      }
                      size="sm"
                      className="mt-4 w-full"
                      disabled={upgrading === plan.tier}
                      onClick={() => handlePlanAction(plan.tier)}
                    >
                      {upgrading === plan.tier ? (
                        "Redirecting..."
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

          {/* Promo code input */}
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
              {downgradingTo && downgradingTo !== "free"
                ? `Your plan will be changed to ${planNameMap[downgradingTo]} at the next billing cycle. No proration will be applied.`
                : "Your current subscription will be canceled at the end of the billing period. You'll keep access to your paid features until then."}
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
                if (downgradingTo && downgradingTo !== "free") {
                  handleDowngrade(downgradingTo);
                } else {
                  handleCancelSubscription();
                }
              }}
              disabled={canceling || downgrading}
            >
              {canceling || downgrading
                ? "Processing..."
                : `Yes, downgrade to ${planNameMap[downgradingTo ?? "free"] ?? "Free"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Payment History</CardTitle>
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
              No payments yet. Your payment history will appear here when you
              subscribe to a paid plan.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
