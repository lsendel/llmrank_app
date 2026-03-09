import {
  AlertTriangle,
  ArrowDown,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  ExternalLink,
  Loader2,
  Receipt,
  Star,
  X,
  Zap,
} from "lucide-react";
import type { PaymentRecord, PromoInfo, SubscriptionInfo } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { WorkflowGuidance } from "@/components/ui/workflow-guidance";
import {
  BILLING_PLANS,
  BILLING_PLAN_NAME_MAP,
  BILLING_WORKFLOW_ACTIONS,
  BILLING_WORKFLOW_STEPS,
  getBillingSubscriptionBadgeVariant,
  getBillingSubscriptionLabel,
  getPaymentStatusVariant,
  getPromoBadgeText,
  type BillingPlanTier,
} from "../billing-page-helpers";

export function BillingVerifyingUpgradeState() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <h2 className="text-xl font-semibold">Verifying your upgrade...</h2>
      <p className="text-center text-muted-foreground">
        Please wait a moment while we confirm your payment with Stripe.
      </p>
    </div>
  );
}

export function BillingSuccessBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm font-medium">{message}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss billing success banner"
        onClick={onDismiss}
        className="text-green-600 hover:text-green-800 dark:text-green-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function BillingPageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
      <p className="mt-1 text-muted-foreground">
        Manage your subscription, plan, and payment history.
      </p>
    </div>
  );
}

export function BillingWorkflowCard() {
  return (
    <WorkflowGuidance
      title="Billing workflow"
      description="Check usage, confirm limits, and choose the right plan before credits become a blocker."
      actions={[...BILLING_WORKFLOW_ACTIONS]}
      steps={BILLING_WORKFLOW_STEPS}
    />
  );
}

interface BillingCurrentPlanCardProps {
  currentPlanName: string;
  currentTier: BillingPlanTier;
  currentPlanPrice: number;
  subscription: SubscriptionInfo | null;
  creditsRemaining: number;
  crawlsTotal: number;
  creditsPercentUsed: number;
  crawlsUsed: number;
  maxProjects?: number;
  maxPagesPerCrawl?: number;
  nextPlanTier: BillingPlanTier | null;
  onUpgradePlan: () => void;
}

export function BillingCurrentPlanCard({
  currentPlanName,
  currentTier,
  currentPlanPrice,
  subscription,
  creditsRemaining,
  crawlsTotal,
  creditsPercentUsed,
  crawlsUsed,
  maxProjects,
  maxPagesPerCrawl,
  nextPlanTier,
  onUpgradePlan,
}: BillingCurrentPlanCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              {currentPlanName} Plan
              {currentTier !== "free" && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ${currentPlanPrice}/mo
                </span>
              )}
            </CardTitle>
          </div>
          {subscription ? (
            <Badge variant={getBillingSubscriptionBadgeVariant(subscription)}>
              {getBillingSubscriptionLabel(subscription)}
            </Badge>
          ) : currentTier === "free" ? (
            <Badge variant="secondary">Free</Badge>
          ) : null}
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
            <p className="text-lg font-semibold">{maxProjects ?? "--"}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Pages per Crawl</p>
            <p className="text-lg font-semibold">{maxPagesPerCrawl ?? "--"}</p>
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
        {nextPlanTier && (
          <Button onClick={onUpgradePlan}>
            <Zap className="h-4 w-4" />
            Upgrade Plan
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

interface BillingSubscriptionManagementCardProps {
  subscription: SubscriptionInfo | null;
  currentTier: BillingPlanTier;
  nextPlanTier: BillingPlanTier | null;
  portalLoading: boolean;
  cancelDialogOpen: boolean;
  canceling: boolean;
  onOpenPortal: () => void;
  onCancelDialogOpenChange: (open: boolean) => void;
  onCancelSubscription: () => void;
  onChoosePlan: () => void;
}

export function BillingSubscriptionManagementCard({
  subscription,
  currentTier,
  nextPlanTier,
  portalLoading,
  cancelDialogOpen,
  canceling,
  onOpenPortal,
  onCancelDialogOpenChange,
  onCancelSubscription,
  onChoosePlan,
}: BillingSubscriptionManagementCardProps) {
  return (
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
        <Button onClick={onOpenPortal} disabled={portalLoading}>
          {portalLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          {portalLoading
            ? "Opening..."
            : subscription
              ? "Manage in Stripe"
              : "Payment History"}
        </Button>
        {subscription &&
          !subscription.cancelAtPeriodEnd &&
          subscription.status === "active" && (
            <Dialog
              open={cancelDialogOpen}
              onOpenChange={onCancelDialogOpenChange}
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
                    Your subscription will remain active until the end of the
                    current billing period. You won&apos;t be charged again.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => onCancelDialogOpenChange(false)}
                  >
                    Keep Subscription
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={onCancelSubscription}
                    disabled={canceling}
                  >
                    {canceling && <Loader2 className="h-4 w-4 animate-spin" />}
                    {canceling ? "Canceling..." : "Yes, cancel"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        {!subscription && currentTier === "free" && nextPlanTier && (
          <Button onClick={onChoosePlan}>
            <Zap className="h-4 w-4" />
            Choose a Plan
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

interface BillingAvailablePlansCardProps {
  currentTier: BillingPlanTier;
  upgrading: BillingPlanTier | null;
  promoCode: string;
  promoValid: PromoInfo | null;
  promoError: string | null;
  validatingPromo: boolean;
  onPlanAction: (planTier: BillingPlanTier) => void;
  onPromoCodeChange: (value: string) => void;
  onValidatePromo: () => void;
}

export function BillingAvailablePlansCard({
  currentTier,
  upgrading,
  promoCode,
  promoValid,
  promoError,
  validatingPromo,
  onPlanAction,
  onPromoCodeChange,
  onValidatePromo,
}: BillingAvailablePlansCardProps) {
  const currentTierIndex = BILLING_PLANS.findIndex(
    (plan) => plan.tier === currentTier,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Available Plans</CardTitle>
        <CardDescription>
          Compare plans and choose the best fit for your needs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BILLING_PLANS.map((plan, index) => {
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
                    onClick={() => onPlanAction(plan.tier)}
                  >
                    {upgrading === plan.tier ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Processing...
                      </>
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

        <div className="mt-4 flex items-center gap-2">
          <Input
            placeholder="Promo code"
            value={promoCode}
            onChange={(event) => onPromoCodeChange(event.target.value)}
            className="max-w-[200px]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={onValidatePromo}
            disabled={validatingPromo || !promoCode.trim()}
          >
            {validatingPromo ? "Checking..." : "Apply"}
          </Button>
          {promoValid && (
            <Badge variant="default">{getPromoBadgeText(promoValid)}</Badge>
          )}
          {promoError && (
            <span className="text-sm text-destructive">{promoError}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BillingDowngradeDialog({
  open,
  downgradingTo,
  canceling,
  downgrading,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  downgradingTo: BillingPlanTier | null;
  canceling: boolean;
  downgrading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Downgrade to{" "}
            {BILLING_PLAN_NAME_MAP[downgradingTo ?? "free"] ?? "Free"}?
          </DialogTitle>
          <DialogDescription>
            {downgradingTo
              ? `Your plan will change to ${BILLING_PLAN_NAME_MAP[downgradingTo]} at the next billing cycle.`
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep Current Plan
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={canceling || downgrading}
          >
            {(canceling || downgrading) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {canceling || downgrading
              ? "Processing..."
              : `Downgrade to ${BILLING_PLAN_NAME_MAP[downgradingTo ?? "free"] ?? "Free"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BillingPaymentHistoryCard({
  payments,
  onOpenPortal,
}: {
  payments: PaymentRecord[];
  onOpenPortal: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Payment History</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenPortal}>
            <ExternalLink className="h-3.5 w-3.5" />
            View all in Stripe
          </Button>
        </div>
        <CardDescription>Your recent payments and invoices.</CardDescription>
      </CardHeader>
      <CardContent>
        {payments.length > 0 ? (
          <div className="divide-y">
            {payments.map((payment) => (
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
                <Badge variant={getPaymentStatusVariant(payment.status)}>
                  {payment.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No payments yet. Payment history will appear here when you subscribe
            to a paid plan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
