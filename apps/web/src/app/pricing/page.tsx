import type { Metadata } from "next";
import Link from "next/link";
import { SignedIn, SignedOut } from "@/lib/auth-hooks";
import { Check, Minus, Sparkles } from "lucide-react";
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";
import {
  JsonLd,
  productOffersSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "LLM Boost pricing plans from Free to Agency ($299/mo). All plans include 37-factor AI-readiness scoring, automated crawling, and Lighthouse audits.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | LLM Boost",
    description:
      "Start free, upgrade when you need more pages, crawls, or integrations. Plans from $0 to $299/month.",
    url: "https://llmrank.app/pricing",
  },
};

// ---------------------------------------------------------------------------
// Plan data
// ---------------------------------------------------------------------------

interface PlanCard {
  tier: PlanTier;
  name: string;
  price: number | null;
  tagline: string;
  highlight?: boolean;
}

const plans: PlanCard[] = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    tagline: "Try a quick site audit",
  },
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

interface FeatureRow {
  label: string;
  getValue: (limits: (typeof PLAN_LIMITS)[PlanTier]) => string | boolean;
}

const features: FeatureRow[] = [
  {
    label: "Pages per crawl",
    getValue: (l) => l.pagesPerCrawl.toLocaleString(),
  },
  {
    label: "Crawls per month",
    getValue: (l) =>
      l.crawlsPerMonth === Infinity ? "Unlimited" : String(l.crawlsPerMonth),
  },
  { label: "Projects", getValue: (l) => String(l.projects) },
  {
    label: "Visibility checks / mo",
    getValue: (l) => String(l.visibilityChecks),
  },
  {
    label: "Lighthouse audits",
    getValue: (l) =>
      l.lighthousePages === "all" ? "All pages" : `${l.lighthousePages} pages`,
  },
  {
    label: "LLM content scoring",
    getValue: (l) =>
      l.llmScoringTier === "basic"
        ? "Basic"
        : l.llmScoringTier === "full"
          ? "Full"
          : "Full + Custom",
  },
  {
    label: "Score history",
    getValue: (l) =>
      l.historyDays >= 365
        ? `${Math.round(l.historyDays / 365)} year${l.historyDays >= 730 ? "s" : ""}`
        : `${l.historyDays} days`,
  },
  { label: "API access", getValue: (l) => l.apiAccess },
  {
    label: "Integrations",
    getValue: (l) =>
      l.integrations.length === 0
        ? false
        : l.integrations.map((i) => i.toUpperCase()).join(", "),
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const pricingJsonLd = productOffersSchema([
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
]);

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={pricingJsonLd} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />
      {/* Nav — matches landing page */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            LLM Boost
          </Link>
          <nav className="flex items-center gap-4">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Dashboard
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Start free, upgrade when you need more pages, crawls, or integrations.
          All plans include the full 37-factor scoring engine.
        </p>
      </section>

      {/* Cards */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const limits = PLAN_LIMITS[plan.tier];
            return (
              <div
                key={plan.tier}
                className={`relative flex flex-col rounded-xl border p-6 ${
                  plan.highlight
                    ? "border-primary shadow-lg shadow-primary/10"
                    : "border-border"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> Most Popular
                  </span>
                )}

                <h2 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.tagline}
                </p>

                <div className="mt-6">
                  <span className="text-4xl font-bold tracking-tight text-foreground">
                    ${plan.price}
                  </span>
                  {plan.price !== 0 && (
                    <span className="ml-1 text-sm text-muted-foreground">
                      /month
                    </span>
                  )}
                </div>

                {/* Quick stats */}
                <ul className="mt-6 flex flex-col gap-2.5 text-sm">
                  <li className="flex items-center gap-2 text-foreground">
                    <Check className="h-4 w-4 shrink-0 text-success" />
                    {limits.pagesPerCrawl.toLocaleString()} pages / crawl
                  </li>
                  <li className="flex items-center gap-2 text-foreground">
                    <Check className="h-4 w-4 shrink-0 text-success" />
                    {limits.crawlsPerMonth === Infinity
                      ? "Unlimited"
                      : limits.crawlsPerMonth}{" "}
                    crawls / month
                  </li>
                  <li className="flex items-center gap-2 text-foreground">
                    <Check className="h-4 w-4 shrink-0 text-success" />
                    {limits.projects} project{limits.projects > 1 ? "s" : ""}
                  </li>
                  <li className="flex items-center gap-2 text-foreground">
                    <Check className="h-4 w-4 shrink-0 text-success" />
                    {limits.visibilityChecks} visibility checks
                  </li>
                </ul>

                {/* CTA */}
                <div className="mt-auto pt-8">
                  <PlanCTA tier={plan.tier} highlight={plan.highlight} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparison table */}
      <section className="border-t border-border bg-muted/40 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground">
            Full feature comparison
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 pr-4 text-left font-medium text-muted-foreground">
                    Feature
                  </th>
                  {plans.map((p) => (
                    <th
                      key={p.tier}
                      className={`pb-3 text-center font-semibold ${
                        p.highlight ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((feature) => (
                  <tr key={feature.label} className="border-b border-border/50">
                    <td className="py-3 pr-4 text-muted-foreground">
                      {feature.label}
                    </td>
                    {plans.map((p) => {
                      const val = feature.getValue(PLAN_LIMITS[p.tier]);
                      return (
                        <td key={p.tier} className="py-3 text-center">
                          {val === true ? (
                            <Check className="mx-auto h-4 w-4 text-success" />
                          ) : val === false ? (
                            <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />
                          ) : (
                            <span className="text-foreground">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} LLM Boost</span>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CTA button — varies based on auth state
// ---------------------------------------------------------------------------

function PlanCTA({ tier, highlight }: { tier: PlanTier; highlight?: boolean }) {
  const base =
    "block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-opacity hover:opacity-90";

  const filled = `${base} bg-primary text-primary-foreground`;
  const outlined = `${base} border border-border text-foreground hover:bg-secondary`;

  if (tier === "free") {
    return (
      <>
        <SignedOut>
          <Link href="/sign-up" className={outlined}>
            Start Free
          </Link>
        </SignedOut>
        <SignedIn>
          <span className="block w-full rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-center text-sm font-semibold text-primary">
            Current Plan
          </span>
        </SignedIn>
      </>
    );
  }

  return (
    <>
      <SignedOut>
        <Link href="/sign-up" className={highlight ? filled : outlined}>
          Get Started
        </Link>
      </SignedOut>
      <SignedIn>
        <Link
          href={`/dashboard/settings?upgrade=${tier}`}
          className={highlight ? filled : outlined}
        >
          Upgrade to {tier.charAt(0).toUpperCase() + tier.slice(1)}
        </Link>
      </SignedIn>
    </>
  );
}
