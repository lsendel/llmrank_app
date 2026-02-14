"use client";

import { useCallback, useState } from "react";
import { useClerk } from "@clerk/nextjs";
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
import { Separator } from "@/components/ui/separator";
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
  Bell,
  Shield,
  Zap,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type BillingInfo,
  type SubscriptionInfo,
  type PaymentRecord,
} from "@/lib/api";

const plans = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
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
    price: "$79/mo",
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
    price: "$149/mo",
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
    price: "$299/mo",
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

export default function SettingsPage() {
  const { withToken } = useApi();
  const { signOut } = useClerk();

  const { data: billing, isLoading: loading } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback((token: string) => api.billing.getInfo(token), []),
  );
  const { data: subscription } = useApiSWR<SubscriptionInfo | null>(
    "billing-subscription",
    useCallback((token: string) => api.billing.getSubscription(token), []),
  );
  const { data: payments } = useApiSWR<PaymentRecord[]>(
    "billing-payments",
    useCallback((token: string) => api.billing.getPayments(token), []),
  );

  const [emailNotifications, setEmailNotifications] = useState({
    crawlComplete: true,
    weeklyReport: true,
    scoreDrops: true,
    newIssues: false,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  async function handleCancelSubscription() {
    setCanceling(true);
    try {
      await withToken(async (token) => {
        await api.billing.cancelSubscription(token);
      });
      setCancelDialogOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCanceling(false);
    }
  }

  function handleToggle(key: keyof typeof emailNotifications) {
    setEmailNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function handleUpgrade(planTier: string) {
    setUpgrading(planTier);
    try {
      await withToken(async (token) => {
        const result = await api.billing.createCheckoutSession(
          token,
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

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await withToken(async (token) => {
        await api.account.deleteAccount(token);
      });
      await signOut();
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  const currentTier = billing?.plan ?? "free";
  const currentPlanName = planNameMap[currentTier] ?? "Free";
  const crawlsUsed =
    billing != null
      ? billing.crawlCreditsTotal - billing.crawlCreditsRemaining
      : 0;
  const crawlsTotal = billing?.crawlCreditsTotal ?? 0;
  const creditsRemaining = billing?.crawlCreditsRemaining ?? 0;
  const creditsPercentUsed =
    crawlsTotal > 0 ? (crawlsUsed / crawlsTotal) * 100 : 0;
  const currentTierIndex = plans.findIndex((p) => p.tier === currentTier);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account, plan, and notification preferences.
        </p>
      </div>

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
                handleUpgrade(plans[currentTierIndex + 1]?.tier ?? "starter")
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
                  await withToken(async (token) => {
                    const result = await api.billing.createPortalSession(
                      token,
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
            {plans.map((plan, index) => (
              <div
                key={plan.tier}
                className={`rounded-lg border p-4 ${
                  plan.tier === currentTier
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {plan.tier === currentTier && (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
                <p className="mb-3 text-2xl font-bold">{plan.price}</p>
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
                {plan.tier !== currentTier && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                    disabled={upgrading === plan.tier}
                    onClick={() => handleUpgrade(plan.tier)}
                  >
                    {upgrading === plan.tier
                      ? "Redirecting..."
                      : index > currentTierIndex
                        ? "Upgrade"
                        : "Downgrade"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Payment History</CardTitle>
            </div>
            <CardDescription>
              Your recent payments and invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              Notification Preferences
            </CardTitle>
          </div>
          <CardDescription>
            Choose which email notifications you want to receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {[
            {
              key: "crawlComplete" as const,
              label: "Crawl Complete",
              description: "Get notified when a crawl finishes.",
            },
            {
              key: "weeklyReport" as const,
              label: "Weekly Report",
              description: "Receive a weekly summary of your project scores.",
            },
            {
              key: "scoreDrops" as const,
              label: "Score Drops",
              description:
                "Get alerted when a project score drops by 10+ points.",
            },
            {
              key: "newIssues" as const,
              label: "New Critical Issues",
              description:
                "Get notified when new critical issues are detected.",
            },
          ].map((notification, index) => (
            <div key={notification.key}>
              {index > 0 && <Separator className="my-0" />}
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium">{notification.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {notification.description}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailNotifications[notification.key]}
                  onClick={() => handleToggle(notification.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    emailNotifications[notification.key]
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      emailNotifications[notification.key]
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base text-destructive">
              Danger Zone
            </CardTitle>
          </div>
          <CardDescription>
            Irreversible actions that will permanently affect your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account, all projects, and crawl data.
              </p>
            </div>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete
                    your account, all projects, crawl history, and associated
                    data.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive">
                    All data will be permanently lost.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Yes, delete my account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
