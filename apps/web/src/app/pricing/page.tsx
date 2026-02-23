import type { Metadata } from "next";
import Link from "next/link";
import { SignedIn, SignedOut } from "@/lib/auth-hooks";
import { Check, Minus } from "lucide-react";
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";
import {
  JsonLd,
  productOffersSchema,
  breadcrumbSchema,
  faqSchema,
} from "@/components/seo/json-ld";
import { PricingCards } from "./billing-toggle";

export const metadata: Metadata = {
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

const PRICING_FAQ = [
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
      <JsonLd
        data={faqSchema(
          PRICING_FAQ.map((item) => ({
            question: item.question,
            answer: item.answer,
          })),
        )}
      />
      {/* Nav — matches landing page */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            LLM Rank
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
        <p className="mx-auto mt-4 max-w-2xl text-base font-semibold text-primary">
          Direct answer: use Free for quick audits, Starter for sites under 100
          pages, Pro for 500-page crawls, and Agency when you manage multiple
          client domains.
        </p>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Start free, upgrade when you need more pages, crawls, or integrations.
          All plans include the full 37-factor scoring engine built on{" "}
          <a
            href="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Google Search Central standards
          </a>
          .
        </p>
      </section>

      <div className="mx-auto mt-6 max-w-3xl space-y-4 px-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every plan uses the full 37-factor scoring engine across Technical
          SEO, Content Quality, AI Readiness, and Performance. The free tier
          scans 10 pages with two crawls per month — perfect for a proof of
          concept. Starter and Pro add more pages, crawl frequency, visibility
          checks, and the{" "}
          <Link
            href="/integrations"
            className="font-medium text-primary hover:underline"
          >
            Google Search Console and GA4 integrations
          </Link>
          . Agency unlocks unlimited crawls, 50 projects, and white-labeled
          PDF/DOCX exports so agencies can ship reports without extra tools.
        </p>
        <div className="rounded-lg border border-border bg-muted/40 p-5 text-left text-sm leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">
            How I pick plans for clients
          </p>
          <p className="mt-2">
            I audit SaaS and media sites every week. Free covers quick QA before
            launch, Pro is the sweet spot when we monitor 300–500 URLs, and
            Agency handles multi-client retainers with scheduled crawls and
            executive-ready decks. The tiers mirror exactly how our consulting
            team buys the product.
          </p>
          <p className="mt-2">
            Not sure where to start? Run a{" "}
            <Link
              href="/scan"
              className="font-medium text-primary hover:underline"
            >
              free scan
            </Link>{" "}
            and check your grade on the{" "}
            <Link
              href="/leaderboard"
              className="font-medium text-primary hover:underline"
            >
              AI-readiness leaderboard
            </Link>
            . Upgrade only when you need more scale.
          </p>
        </div>
      </div>

      {/* Cards with billing toggle */}
      <PricingCards />

      {/* Comparison table */}
      <section className="border-t border-border bg-muted/40 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground">
            Full feature comparison
          </h2>
          <p className="mb-8 text-center text-sm font-semibold text-foreground">
            Quick answer: Starter fits single sites under 100 pages, Pro covers
            most growing teams at 500 pages per crawl, and Agency is designed
            for agencies that need unlimited crawls plus white-labeled exports.
          </p>

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

      {/* FAQ */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-foreground">
            Pricing FAQ
          </h2>
          <p className="mt-4 text-center text-sm font-semibold text-foreground">
            Quick answers: you can change plans anytime, unused data stays
            visible even if crawls pause, the free plan needs no credit card,
            and AI visibility checks ping ChatGPT, Claude, Perplexity, and
            Gemini.
          </p>
          <div className="mt-8 space-y-6">
            {PRICING_FAQ.map((item) => (
              <details
                key={item.question}
                className="group rounded-lg border border-border p-5"
              >
                <summary className="cursor-pointer text-base font-semibold text-foreground">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-muted/30 px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Not sure which plan? Start free.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Run a free AI audit on your site — no credit card required. Upgrade
            when you need more pages, crawls, or integrations.
          </p>
          <Link
            href="/scan"
            className="mt-6 inline-block rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
          >
            Start Free Audit
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} LLM Rank</span>
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
