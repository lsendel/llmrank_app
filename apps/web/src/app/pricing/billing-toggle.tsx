"use client";

import { useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@/lib/auth-hooks";
import { Check, Sparkles } from "lucide-react";
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";

interface PlanCard {
  tier: PlanTier;
  name: string;
  price: number | null;
  tagline: string;
  highlight?: boolean;
}

const plans: PlanCard[] = [
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

function formatHistory(days: number): string {
  if (days >= 365) {
    const years = Math.round(days / 365);
    return `${years} year${years > 1 ? "s" : ""} score history`;
  }
  return `${days}-day score history`;
}

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

export function PricingCards() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-20">
      {/* Billing toggle */}
      <div className="mb-10 flex items-center justify-center gap-3">
        <span
          className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual(!annual)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            annual ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
              annual ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}
        >
          Annual
        </span>
        <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
          Save 20%
        </span>
      </div>

      {/* Plan cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const limits = PLAN_LIMITS[plan.tier];
          const monthlyPrice = plan.price ?? 0;
          const displayPrice = annual
            ? Math.round(monthlyPrice * 12 * 0.8)
            : monthlyPrice;
          const period = annual ? "/year" : "/month";

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
                  ${displayPrice}
                </span>
                {monthlyPrice !== 0 && (
                  <span className="ml-1 text-sm text-muted-foreground">
                    {period}
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
                <li className="flex items-center gap-2 text-foreground">
                  <Check className="h-4 w-4 shrink-0 text-success" />
                  {formatHistory(limits.historyDays)}
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
  );
}
