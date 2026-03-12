/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";
import { MarketingPage } from "../../views/marketing";
import type { AppEnv } from "../../index";

const PLANS: {
  tier: PlanTier;
  name: string;
  price: number;
  tagline: string;
  highlight?: boolean;
}[] = [
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

const PRICING_FAQ = [
  {
    q: "Can I change plans at any time?",
    a: "Yes. You can upgrade or downgrade anytime from the dashboard settings page. Upgrades take effect immediately and we bill only the prorated difference. Downgrades start at the next billing cycle.",
  },
  {
    q: "What happens when I hit my crawl limit?",
    a: "You can still view every score, report, and recommendation. New crawls become available when your billing cycle resets. Upgrade for more capacity.",
  },
  {
    q: "Do I need a credit card for the free plan?",
    a: "No credit card required. The free plan only needs an email address and includes 10 pages per crawl, 2 crawls per month, and 1 project.",
  },
  {
    q: "What is an AI visibility check?",
    a: "Visibility checks query ChatGPT, Claude, Perplexity, and Gemini with relevant prompts to see if your brand is mentioned or your URLs are cited. They show how visible your content is in AI-generated answers.",
  },
  {
    q: "Do you offer an SLA or uptime guarantee?",
    a: "Yes. Agency plans include a 99.9% uptime SLA and priority support. Pro and Starter plans are monitored 24/7 but do not include financial SLAs.",
  },
  {
    q: "Can I export reports for my clients?",
    a: "Absolutely. The Agency plan includes white-labeled PDF and DOCX reporting. You can upload your own agency logo, set custom colors, and remove all LLM Rank branding.",
  },
];

export const marketingPricingRoutes = new Hono<AppEnv>();

marketingPricingRoutes.get("/pricing", (c) => {
  return c.html(
    <MarketingPage title="AI-Readiness SEO Pricing Plans">
      <section class="px-6 pb-12 pt-20 text-center">
        <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p class="mx-auto mt-4 max-w-2xl text-base font-semibold text-blue-600">
          Use Free for quick audits, Starter for sites under 100 pages, Pro for
          500-page crawls, and Agency for multiple client domains.
        </p>
        <p class="mx-auto mt-4 max-w-xl text-lg text-gray-500">
          Start free, upgrade when you need more pages, crawls, or integrations.
          All plans include the full 37-factor scoring engine.
        </p>
      </section>

      <section class="mx-auto w-full max-w-6xl px-6 pb-20">
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const limits = PLAN_LIMITS[plan.tier];
            return (
              <div
                class={`relative flex flex-col rounded-xl border p-6 ${plan.highlight ? "border-blue-600 shadow-lg" : "border-gray-200"}`}
              >
                {plan.highlight && (
                  <span class="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}
                <h2 class="text-lg font-semibold">{plan.name}</h2>
                <p class="mt-1 text-sm text-gray-500">{plan.tagline}</p>
                <div class="mt-6">
                  <span class="text-4xl font-bold tracking-tight">
                    ${plan.price}
                  </span>
                  {plan.price > 0 && (
                    <span class="ml-1 text-sm text-gray-500">/month</span>
                  )}
                </div>
                <ul class="mt-6 flex flex-col gap-2.5 text-sm">
                  <li class="flex items-center gap-2">
                    <span class="text-green-600">&#10003;</span>
                    {limits.pagesPerCrawl.toLocaleString()} pages / crawl
                  </li>
                  <li class="flex items-center gap-2">
                    <span class="text-green-600">&#10003;</span>
                    {limits.crawlsPerMonth === Infinity
                      ? "Unlimited"
                      : limits.crawlsPerMonth}{" "}
                    crawls / month
                  </li>
                  <li class="flex items-center gap-2">
                    <span class="text-green-600">&#10003;</span>
                    {limits.projects} project{limits.projects > 1 ? "s" : ""}
                  </li>
                  <li class="flex items-center gap-2">
                    <span class="text-green-600">&#10003;</span>
                    {limits.visibilityChecks} visibility checks
                  </li>
                </ul>
                <div class="mt-auto pt-8">
                  {plan.tier === "free" ? (
                    <a
                      href="/sign-up"
                      class="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-semibold hover:bg-gray-50"
                    >
                      Start Free
                    </a>
                  ) : (
                    <a
                      href="/sign-up"
                      class={`block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${plan.highlight ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-gray-300 hover:bg-gray-50"}`}
                    >
                      Get Started
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section class="border-t border-gray-200 bg-gray-50 px-6 py-20">
        <div class="mx-auto max-w-5xl">
          <h2 class="mb-10 text-center text-2xl font-bold">
            Full feature comparison
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200">
                  <th class="pb-3 pr-4 text-left font-medium text-gray-500">
                    Feature
                  </th>
                  {PLANS.map((plan) => (
                    <th
                      class={`pb-3 text-center font-semibold ${plan.highlight ? "text-blue-600" : ""}`}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "Pages per crawl",
                    fn: (limit: (typeof PLAN_LIMITS)[PlanTier]) =>
                      limit.pagesPerCrawl.toLocaleString(),
                  },
                  {
                    label: "Crawls per month",
                    fn: (limit: (typeof PLAN_LIMITS)[PlanTier]) =>
                      limit.crawlsPerMonth === Infinity
                        ? "Unlimited"
                        : String(limit.crawlsPerMonth),
                  },
                  {
                    label: "Projects",
                    fn: (limit: (typeof PLAN_LIMITS)[PlanTier]) =>
                      String(limit.projects),
                  },
                  {
                    label: "Visibility checks / mo",
                    fn: (limit: (typeof PLAN_LIMITS)[PlanTier]) =>
                      String(limit.visibilityChecks),
                  },
                  {
                    label: "Lighthouse audits",
                    fn: (limit: (typeof PLAN_LIMITS)[PlanTier]) =>
                      limit.lighthousePages === "all"
                        ? "All pages"
                        : `${limit.lighthousePages} pages`,
                  },
                  {
                    label: "LLM content scoring",
                    fn: (limit: (typeof PLAN_LIMITS)[PlanTier]) =>
                      limit.llmScoringTier === "basic"
                        ? "Basic"
                        : limit.llmScoringTier === "full"
                          ? "Full"
                          : "Full + Custom",
                  },
                  {
                    label: "Score history",
                    fn: (limit: (typeof PLAN_LIMITS)[PlanTier]) =>
                      limit.historyDays >= 365
                        ? `${Math.round(limit.historyDays / 365)} year${limit.historyDays >= 730 ? "s" : ""}`
                        : `${limit.historyDays} days`,
                  },
                  {
                    label: "API access",
                    fn: (limit: (typeof PLAN_LIMITS)[PlanTier]) =>
                      String(limit.apiAccess),
                  },
                ].map((row) => (
                  <tr class="border-b border-gray-100">
                    <td class="py-3 pr-4 text-gray-500">{row.label}</td>
                    {PLANS.map((plan) => (
                      <td class="py-3 text-center">
                        {row.fn(PLAN_LIMITS[plan.tier])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="px-6 py-20">
        <div class="mx-auto max-w-3xl">
          <h2 class="text-center text-2xl font-bold">Pricing FAQ</h2>
          <div class="mt-8 space-y-6">
            {PRICING_FAQ.map((item) => (
              <details class="group rounded-lg border border-gray-200 p-5">
                <summary class="cursor-pointer text-base font-semibold">
                  {item.q}
                </summary>
                <p class="mt-3 text-sm leading-relaxed text-gray-500">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div class="mx-auto max-w-3xl px-6 pb-12 text-center">
        <p class="text-sm text-gray-500">
          Not sure which plan is right for you?{" "}
          <a href="/scan" class="font-medium text-blue-600 hover:underline">
            Try a free scan
          </a>{" "}
          first.
        </p>
      </div>
    </MarketingPage>,
  );
});
