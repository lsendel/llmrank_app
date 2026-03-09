import type { Metadata } from "next";
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";

type PricingLimits = (typeof PLAN_LIMITS)[PlanTier];

type PricingLink = {
  href: string;
  label: string;
};

type PricingOffer = {
  name: string;
  price: number;
  description: string;
  features: string[];
};

export type PricingPlanCard = {
  tier: PlanTier;
  name: string;
  price: number | null;
  tagline: string;
  highlight?: boolean;
};

export type PricingFeatureRow = {
  label: string;
  getValue: (limits: PricingLimits) => string | boolean;
};

export type PricingFaqItem = {
  question: string;
  answer: string;
};

export const PRICING_PAGE_METADATA: Metadata = {
  title: "AI-Readiness SEO Pricing Plans",
  description:
    "LLM Rank pricing plans from Free to Agency ($299/mo). All plans include 37-factor AI-readiness scoring, automated crawling, and Lighthouse audits.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | LLM Rank",
    description:
      "Start free, upgrade when you need more pages, crawls, or integrations. Plans from $0 to $299/month.",
    url: "https://llmrank.app/pricing",
  },
};

export const PRICING_PLANS: PricingPlanCard[] = [
  { tier: "free", name: "Free", price: 0, tagline: "Try a quick site audit" },
  {
    tier: "starter",
    name: "Starter",
    price: 79,
    tagline: "For solo sites & blogs",
  },
  {
    tier: "pro",
    name: "Pro",
    price: 149,
    tagline: "For growing businesses",
    highlight: true,
  },
  {
    tier: "agency",
    name: "Agency",
    price: 299,
    tagline: "For teams & client work",
  },
];

export const PRICING_FEATURES: PricingFeatureRow[] = [
  {
    label: "Pages per crawl",
    getValue: (limits) => limits.pagesPerCrawl.toLocaleString(),
  },
  {
    label: "Crawls per month",
    getValue: (limits) =>
      limits.crawlsPerMonth === Infinity
        ? "Unlimited"
        : String(limits.crawlsPerMonth),
  },
  { label: "Projects", getValue: (limits) => String(limits.projects) },
  {
    label: "Visibility checks / mo",
    getValue: (limits) => String(limits.visibilityChecks),
  },
  {
    label: "Lighthouse audits",
    getValue: (limits) =>
      limits.lighthousePages === "all"
        ? "All pages"
        : `${limits.lighthousePages} pages`,
  },
  {
    label: "LLM content scoring",
    getValue: (limits) =>
      limits.llmScoringTier === "basic"
        ? "Basic"
        : limits.llmScoringTier === "full"
          ? "Full"
          : "Full + Custom",
  },
  {
    label: "Score history",
    getValue: (limits) =>
      limits.historyDays >= 365
        ? `${Math.round(limits.historyDays / 365)} year${limits.historyDays >= 730 ? "s" : ""}`
        : `${limits.historyDays} days`,
  },
  { label: "API access", getValue: (limits) => limits.apiAccess },
  {
    label: "Integrations",
    getValue: (limits) =>
      limits.integrations.length === 0
        ? false
        : limits.integrations
            .map((integration) => integration.toUpperCase())
            .join(", "),
  },
];

export const PRICING_PRODUCT_OFFERS: PricingOffer[] = [
  {
    name: "Free",
    price: 0,
    description: "Try a quick site audit with 10 pages per crawl",
    features: ["10 pages/crawl", "2 crawls/month", "1 project"],
  },
  {
    name: "Starter",
    price: 79,
    description: "For solo sites and blogs with up to 100 pages per crawl",
    features: ["100 pages/crawl", "10 crawls/month", "5 projects"],
  },
  {
    name: "Pro",
    price: 149,
    description: "For growing businesses with up to 500 pages per crawl",
    features: ["500 pages/crawl", "30 crawls/month", "20 projects"],
  },
  {
    name: "Agency",
    price: 299,
    description: "For teams and client work with up to 2,000 pages per crawl",
    features: ["2,000 pages/crawl", "Unlimited crawls", "50 projects"],
  },
];

export const PRICING_BREADCRUMB_ITEMS = [
  { name: "Home", path: "/" },
  { name: "Pricing", path: "/pricing" },
];

export const PRICING_FAQ: PricingFaqItem[] = [
  {
    question: "Can I change plans at any time?",
    answer:
      "Yes. You can upgrade or downgrade anytime from the dashboard settings page. Upgrades take effect immediately and we bill only the prorated difference. Downgrades start at the next billing cycle so you keep current access until then.",
  },
  {
    question: "What happens when I hit my crawl limit?",
    answer:
      "When you reach your monthly crawl limit, you can still view every score, report, and recommendation. New crawls become available as soon as your billing cycle resets. Upgrade for more capacity — Pro includes 30 crawls per month and Agency offers unlimited crawls.",
  },
  {
    question: "Do I need a credit card for the free plan?",
    answer:
      "No credit card required. The free plan only needs an email address and includes 10 pages per crawl, 2 crawls per month, and 1 project. Upgrade when you need more projects or scheduled crawls.",
  },
  {
    question: "What is an AI visibility check?",
    answer:
      "Visibility checks query ChatGPT, Claude, Perplexity, and Gemini with relevant prompts to see if your brand is mentioned or your URLs are cited. They show how visible your content is in AI-generated answers, not just traditional search results. We track citation position, sentiment, and competitor share of voice.",
  },
  {
    question: "Do you offer an SLA or uptime guarantee?",
    answer:
      "Yes. Agency plans include a 99.9% uptime SLA and priority support. Pro and Starter plans are monitored 24/7 but do not include financial SLAs. You can check our system status at any time from the dashboard footer.",
  },
  {
    question: "Can I export reports for my clients?",
    answer:
      "Absolutely. The Agency plan includes white-labeled PDF and DOCX reporting. You can upload your own agency logo, set custom colors, and remove all LLM Rank branding from the reports you send to clients.",
  },
];

export const PRICING_FOOTER_LINKS: PricingLink[] = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/pricing", label: "Pricing" },
];

export function formatPricingHistory(days: number): string {
  if (days >= 365) {
    const years = Math.round(days / 365);
    return `${years} year${years > 1 ? "s" : ""} score history`;
  }

  return `${days}-day score history`;
}

export function getPricingDisplayPrice(price: number | null, annual: boolean) {
  const monthlyPrice = price ?? 0;

  return {
    displayPrice: annual ? Math.round(monthlyPrice * 12 * 0.8) : monthlyPrice,
    period: annual ? "/year" : "/month",
  };
}
