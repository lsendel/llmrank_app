import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { SignedIn, SignedOut } from "@/lib/auth-hooks";
import { PricingCards } from "../billing-toggle";
import {
  PRICING_FAQ,
  PRICING_FEATURES,
  PRICING_FOOTER_LINKS,
  PRICING_PLANS,
} from "../pricing-page-helpers";

export function PricingPageLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
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

      <PricingCards />

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
                  {PRICING_PLANS.map((plan) => (
                    <th
                      key={plan.tier}
                      className={`pb-3 text-center font-semibold ${
                        plan.highlight ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICING_FEATURES.map((feature) => (
                  <tr key={feature.label} className="border-b border-border/50">
                    <td className="py-3 pr-4 text-muted-foreground">
                      {feature.label}
                    </td>
                    {PRICING_PLANS.map((plan) => {
                      const value = feature.getValue(PLAN_LIMITS[plan.tier]);

                      return (
                        <td key={plan.tier} className="py-3 text-center">
                          {value === true ? (
                            <Check className="mx-auto h-4 w-4 text-success" />
                          ) : value === false ? (
                            <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />
                          ) : (
                            <span className="text-foreground">{value}</span>
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

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} LLM Rank</span>
          {PRICING_FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
