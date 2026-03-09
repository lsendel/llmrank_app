import { CreditCard, Receipt, Zap, type LucideIcon } from "lucide-react";
import type {
  BillingInfo,
  PaymentRecord,
  PromoInfo,
  SubscriptionInfo,
} from "@/lib/api";

export type BillingPlanTier = BillingInfo["plan"];

export interface BillingWorkflowStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const BILLING_PLANS = [
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
] as const satisfies ReadonlyArray<{
  tier: BillingPlanTier;
  name: string;
  price: string;
  priceNote: string;
  popular: boolean;
  features: string[];
}>;

export type BillingPlan = (typeof BILLING_PLANS)[number];

export const BILLING_PLAN_NAME_MAP: Record<BillingPlanTier, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

export const BILLING_PLAN_PRICE_MAP: Record<BillingPlanTier, number> = {
  free: 0,
  starter: 79,
  pro: 149,
  agency: 299,
};

export const BILLING_WORKFLOW_ACTIONS = [
  {
    label: "Open Projects",
    href: "/dashboard/projects",
    variant: "outline" as const,
  },
  { label: "Settings", href: "/dashboard/settings", variant: "ghost" as const },
];

export const BILLING_WORKFLOW_STEPS: BillingWorkflowStep[] = [
  {
    title: "Track remaining crawl capacity",
    description:
      "Review credit usage and project limits so priority scans keep running.",
    icon: Zap,
  },
  {
    title: "Evaluate plan fit",
    description:
      "Compare included features and limits against current operating needs.",
    icon: CreditCard,
  },
  {
    title: "Keep payment records audit-ready",
    description:
      "Use payment history and invoices for finance and procurement workflows.",
    icon: Receipt,
  },
];

export function getNextBillingPlanTier(
  currentTier: BillingPlanTier,
): BillingPlanTier | null {
  const currentTierIndex = BILLING_PLANS.findIndex(
    (plan) => plan.tier === currentTier,
  );
  return BILLING_PLANS[currentTierIndex + 1]?.tier ?? null;
}

export function getBillingSubscriptionBadgeVariant(
  subscription: SubscriptionInfo,
): "default" | "secondary" | "destructive" {
  if (subscription.cancelAtPeriodEnd) {
    return "secondary";
  }

  return subscription.status === "active" ? "default" : "destructive";
}

export function getBillingSubscriptionLabel(
  subscription: SubscriptionInfo,
): string {
  if (subscription.cancelAtPeriodEnd) {
    return "Canceling";
  }

  return subscription.status === "past_due" ? "Past Due" : "Active";
}

export function getPromoBadgeText(promo: PromoInfo): string {
  if (promo.discountType === "percent_off") {
    return `${promo.discountValue}% off`;
  }

  if (promo.discountType === "free_months") {
    return `${promo.discountValue} free months`;
  }

  return `$${(promo.discountValue / 100).toFixed(2)} off`;
}

export function getPaymentStatusVariant(
  status: PaymentRecord["status"],
): "default" | "secondary" | "destructive" {
  if (status === "succeeded") {
    return "default";
  }

  return status === "failed" ? "destructive" : "secondary";
}

export function buildBillingUpgradeUrls(origin: string) {
  return {
    successUrl: `${origin}/dashboard/billing?upgraded=true`,
    cancelUrl: `${origin}/dashboard/billing`,
  };
}
