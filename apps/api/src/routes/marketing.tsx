/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { PLAN_LIMITS, type PlanTier } from "@llm-boost/shared";
import {
  projects as projectsTable,
  crawlJobs,
  pageScores,
} from "@llm-boost/db";
import { eq, and, sql } from "drizzle-orm";

export const marketingRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// Shared layout components
// ---------------------------------------------------------------------------

const MarketingHeader = () => (
  <header class="border-b border-gray-200 bg-white">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
      <a href="/" class="text-xl font-bold tracking-tight text-blue-600">
        LLM Rank
      </a>
      <nav class="flex items-center gap-6">
        <a
          href="/ai-seo-tool"
          class="hidden text-sm font-medium text-gray-500 hover:text-gray-900 md:block"
        >
          AI SEO Tool
        </a>
        <a
          href="/pricing"
          class="hidden text-sm font-medium text-gray-500 hover:text-gray-900 md:block"
        >
          Pricing
        </a>
        <a
          href="/sign-in"
          class="hidden text-sm font-medium text-gray-500 hover:text-gray-900 sm:block"
        >
          Sign in
        </a>
        <a
          href="/scan"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Get Started
        </a>
      </nav>
    </div>
  </header>
);

const MarketingFooter = () => (
  <footer class="border-t border-gray-200 bg-gray-50 py-12">
    <div class="mx-auto grid max-w-7xl gap-8 px-6 text-sm md:grid-cols-4">
      <div class="col-span-1 md:col-span-2">
        <span class="mb-4 text-lg font-bold">LLM Rank</span>
        <p class="mt-2 max-w-xs text-gray-500">
          The first B2B platform for AI Search Optimization (AISO). Helping
          brands become the cited source for the world's knowledge models.
        </p>
      </div>
      <div>
        <h3 class="mb-4 font-bold">Platform</h3>
        <ul class="space-y-3 text-gray-500">
          <li>
            <a href="/scan" class="hover:text-gray-900">
              Free Audit
            </a>
          </li>
          <li>
            <a href="/pricing" class="hover:text-gray-900">
              Pricing
            </a>
          </li>
          <li>
            <a href="/ai-seo-tool" class="hover:text-gray-900">
              AI SEO Tool
            </a>
          </li>
        </ul>
      </div>
      <div>
        <h3 class="mb-4 font-bold">Resources</h3>
        <ul class="space-y-3 text-gray-500">
          <li>
            <a href="/chatgpt-seo" class="hover:text-gray-900">
              ChatGPT SEO Guide
            </a>
          </li>
          <li>
            <a href="/privacy" class="hover:text-gray-900">
              Privacy Policy
            </a>
          </li>
          <li>
            <a href="/terms" class="hover:text-gray-900">
              Terms
            </a>
          </li>
        </ul>
      </div>
    </div>
    <div class="mx-auto mt-12 max-w-7xl border-t border-gray-200 px-6 pt-8 text-center text-sm text-gray-500">
      &copy; {new Date().getFullYear()} LLM Rank. All rights reserved.
    </div>
  </footer>
);

const MarketingPage = ({
  title,
  children,
}: {
  title: string;
  children: any;
}) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — LLM Rank</title>
      <script src="https://unpkg.com/htmx.org@2.0.4"></script>
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    </head>
    <body class="min-h-screen bg-white text-gray-900">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </body>
  </html>
);

// ---------------------------------------------------------------------------
// Home page (/)
// ---------------------------------------------------------------------------

marketingRoutes.get("/", (c) => {
  return c.html(
    <MarketingPage title="Rank in ChatGPT, Claude & Perplexity | AI Search Optimization Platform">
      {/* Hero */}
      <section class="px-6 py-24 text-center sm:py-32">
        <div class="mx-auto max-w-4xl">
          <div class="mb-8 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600">
            The AI Search Optimization Platform
          </div>
          <h1 class="text-4xl font-bold tracking-tight sm:text-6xl">
            Rank in ChatGPT, Claude &amp; Perplexity
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
            LLM Rank analyzes your website across{" "}
            <strong class="text-gray-900">37 AI ranking factors</strong> and
            shows you exactly how to improve visibility in AI-powered search
            engines.
          </p>
          <div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/scan"
              class="rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-xl hover:bg-blue-700"
            >
              Run Free AI Audit
            </a>
            <a
              href="/ai-seo-tool"
              class="rounded-lg border border-gray-300 px-8 py-4 text-lg font-semibold hover:bg-gray-50"
            >
              See Sample Report
            </a>
          </div>
          <p class="mt-6 text-sm text-gray-500">
            No credit card required. Analyzes Technical SEO, Content Depth &amp;
            AI Readiness.
          </p>
        </div>
      </section>

      {/* The Problem */}
      <section class="border-y border-gray-200 bg-gray-50 px-6 py-24">
        <div class="mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-2">
          <div>
            <h2 class="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
              Traditional SEO optimizes for Google.{" "}
              <span class="text-blue-600">
                AI search uses different signals.
              </span>
            </h2>
            <p class="text-lg text-gray-500">
              Google ranks links. AI models synthesize answers. If your content
              isn't citation-ready, you get ignored by the algorithms powering
              the future of search.
            </p>
            <ul class="mt-6 space-y-3">
              <li class="flex items-start gap-3">
                <span class="text-red-500">&#10005;</span>
                Most sites are invisible to ChatGPT due to "fluff" content.
              </li>
              <li class="flex items-start gap-3">
                <span class="text-red-500">&#10005;</span>
                Poor entity structuring confuses LLM context windows.
              </li>
              <li class="flex items-start gap-3">
                <span class="text-red-500">&#10005;</span>
                Technical blocks prevent AI bots from crawling critical data.
              </li>
            </ul>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl">
            <div class="space-y-6">
              <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div class="mb-2 text-xs font-semibold uppercase text-gray-400">
                  Old Way (Google)
                </div>
                <div class="mt-4 flex gap-2">
                  <div class="flex h-20 w-full items-center justify-center rounded border border-blue-200 bg-blue-50 text-xs font-medium text-blue-500">
                    Blue Link 1
                  </div>
                  <div class="flex h-20 w-full items-center justify-center rounded border border-blue-200 bg-blue-50 text-xs font-medium text-blue-500">
                    Blue Link 2
                  </div>
                </div>
              </div>
              <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div class="mb-2 text-xs font-semibold uppercase text-blue-600">
                  New Way (AI Search)
                </div>
                <div class="rounded border border-gray-200 bg-white p-4 shadow-sm">
                  <p class="text-sm italic text-gray-700">
                    "According to [Your Brand], the best practice for..."
                  </p>
                </div>
                <div class="mt-2 text-center text-xs text-gray-500">
                  Direct Citation &amp; Answer Synthesis
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 37 Factors */}
      <section class="px-6 py-24">
        <div class="mx-auto max-w-7xl">
          <div class="mx-auto mb-16 max-w-3xl text-center">
            <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
              The 37 AI Ranking Factors
            </h2>
            <p class="mt-4 text-lg text-gray-500">
              We reverse-engineered how Large Language Models evaluate trust and
              authority.
            </p>
          </div>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "Technical SEO",
                weight: "25%",
                desc: "Schema, Robots, Canonical",
                color: "blue",
              },
              {
                name: "Content Structure",
                weight: "30%",
                desc: "Entity Clarity, Direct Answers",
                color: "green",
              },
              {
                name: "AI Readiness",
                weight: "30%",
                desc: "Citation Worthiness, Context",
                color: "purple",
              },
              {
                name: "Performance",
                weight: "15%",
                desc: "Crawlability, Core Web Vitals",
                color: "orange",
              },
            ].map((f) => (
              <div class="overflow-hidden rounded-xl border border-gray-200 p-6">
                <div class={`text-xl font-bold text-${f.color}-500`}>
                  {f.weight}
                </div>
                <div class="mt-2 text-lg font-semibold">{f.name}</div>
                <p class="mt-1 text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section class="bg-blue-50 px-6 py-24">
        <div class="mx-auto max-w-7xl">
          <div class="mb-16 text-center">
            <h2 class="text-3xl font-bold">How It Works</h2>
            <p class="mt-4 text-gray-500">
              From invisible to cited in three steps.
            </p>
          </div>
          <div class="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Enter your domain",
                desc: "Our crawlers simulate GPTBot and ClaudeBot to analyze your public pages.",
              },
              {
                step: "2",
                title: "Get your AI Score",
                desc: "See your site through the eyes of an LLM. Identify technical and content gaps.",
              },
              {
                step: "3",
                title: "Fix & Rank",
                desc: "Implement prioritized recommendations to become a trusted data source.",
              },
            ].map((item) => (
              <div class="relative rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                <div class="absolute -top-6 left-8 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-lg">
                  {item.step}
                </div>
                <h3 class="mt-6 text-xl font-bold">{item.title}</h3>
                <p class="mt-2 text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for B2B */}
      <section class="px-6 py-24">
        <div class="mx-auto max-w-7xl">
          <h2 class="mb-16 text-center text-3xl font-bold">
            Built for B2B Growth Teams
          </h2>
          <div class="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "SEO Agencies",
                desc: "Offer a new high-value service: 'AI Visibility Audits' for your clients.",
              },
              {
                title: "SaaS Marketing",
                desc: "Ensure your product is recommended when users ask 'Best tool for X'.",
              },
              {
                title: "Content Teams",
                desc: "Write content that LLMs love to read, understand, and cite.",
              },
            ].map((team) => (
              <div class="rounded-xl p-6 text-center transition-colors hover:bg-gray-50">
                <h3 class="text-xl font-bold">{team.title}</h3>
                <p class="mt-2 text-gray-500">{team.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section class="bg-gray-900 px-6 py-24 text-white">
        <div class="mx-auto max-w-4xl text-center">
          <h2 class="mb-8 text-3xl font-bold sm:text-4xl">
            Why AI Search Optimization Matters
          </h2>
          <div class="grid gap-8 text-center sm:grid-cols-3">
            <div>
              <div class="mb-2 text-5xl font-bold text-blue-400">40%+</div>
              <p class="text-blue-100">Queries influenced by AI by 2026</p>
            </div>
            <div>
              <div class="mb-2 text-5xl font-bold text-purple-400">0</div>
              <p class="text-purple-100">Clicks for "Zero-Click" answers</p>
            </div>
            <div>
              <div class="mb-2 text-5xl font-bold text-green-400">37</div>
              <p class="text-green-100">Specific signals LLMs look for</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section class="mx-auto max-w-3xl px-6 py-24">
        <h2 class="mb-12 text-center text-3xl font-bold">
          Frequently Asked Questions
        </h2>
        <div class="space-y-6">
          {[
            {
              q: "How do you rank in ChatGPT?",
              a: "Websites rank in AI search engines by being technically optimized, well-structured, and citation-ready. LLMs prioritize authoritative content with clear entity relationships and direct answers.",
            },
            {
              q: "What is AI SEO?",
              a: "AI SEO (or AISO) is the process of optimizing content to be found, understood, and cited by Generative AI models like ChatGPT, Claude, and Perplexity, rather than just ranking blue links in Google.",
            },
            {
              q: "How is AI search different from Google?",
              a: "Google ranks links based on keywords and backlinks. AI search engines synthesize answers from multiple sources. To win in AI search, your content must be structured as reliable facts that an LLM can easily ingest and reference.",
            },
            {
              q: "What is an AI-Readiness score?",
              a: "It is a proprietary metric from LLM Rank that evaluates a page across 37 factors including Technical SEO, Content Quality, AI Readiness, and Performance into a single 0-100 score.",
            },
          ].map((item) => (
            <details class="group rounded-lg border border-gray-200 bg-white p-6">
              <summary class="cursor-pointer text-lg font-bold">
                {item.q}
              </summary>
              <p class="mt-4 leading-relaxed text-gray-500">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section class="border-t border-gray-200 px-6 py-24 text-center">
        <div class="mx-auto max-w-3xl">
          <h2 class="mb-6 text-4xl font-bold">Ready to rank in the AI Era?</h2>
          <p class="mb-10 text-xl text-gray-500">
            Join 5,000+ marketers optimizing for ChatGPT &amp; Perplexity.
          </p>
          <a
            href="/scan"
            class="rounded-lg bg-blue-600 px-10 py-4 text-xl font-semibold text-white hover:bg-blue-700"
          >
            Get Your AI Score
          </a>
        </div>
      </section>
    </MarketingPage>,
  );
});

// ---------------------------------------------------------------------------
// Pricing page (/pricing)
// ---------------------------------------------------------------------------

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

marketingRoutes.get("/pricing", (c) => {
  return c.html(
    <MarketingPage title="AI-Readiness SEO Pricing Plans">
      {/* Hero */}
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

      {/* Plan Cards */}
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

      {/* Comparison Table */}
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
                  {PLANS.map((p) => (
                    <th
                      class={`pb-3 text-center font-semibold ${p.highlight ? "text-blue-600" : ""}`}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "Pages per crawl",
                    fn: (l: (typeof PLAN_LIMITS)[PlanTier]) =>
                      l.pagesPerCrawl.toLocaleString(),
                  },
                  {
                    label: "Crawls per month",
                    fn: (l: (typeof PLAN_LIMITS)[PlanTier]) =>
                      l.crawlsPerMonth === Infinity
                        ? "Unlimited"
                        : String(l.crawlsPerMonth),
                  },
                  {
                    label: "Projects",
                    fn: (l: (typeof PLAN_LIMITS)[PlanTier]) =>
                      String(l.projects),
                  },
                  {
                    label: "Visibility checks / mo",
                    fn: (l: (typeof PLAN_LIMITS)[PlanTier]) =>
                      String(l.visibilityChecks),
                  },
                  {
                    label: "Lighthouse audits",
                    fn: (l: (typeof PLAN_LIMITS)[PlanTier]) =>
                      l.lighthousePages === "all"
                        ? "All pages"
                        : `${l.lighthousePages} pages`,
                  },
                  {
                    label: "LLM content scoring",
                    fn: (l: (typeof PLAN_LIMITS)[PlanTier]) =>
                      l.llmScoringTier === "basic"
                        ? "Basic"
                        : l.llmScoringTier === "full"
                          ? "Full"
                          : "Full + Custom",
                  },
                  {
                    label: "Score history",
                    fn: (l: (typeof PLAN_LIMITS)[PlanTier]) =>
                      l.historyDays >= 365
                        ? `${Math.round(l.historyDays / 365)} year${l.historyDays >= 730 ? "s" : ""}`
                        : `${l.historyDays} days`,
                  },
                  {
                    label: "API access",
                    fn: (l: (typeof PLAN_LIMITS)[PlanTier]) =>
                      String(l.apiAccess),
                  },
                ].map((row) => (
                  <tr class="border-b border-gray-100">
                    <td class="py-3 pr-4 text-gray-500">{row.label}</td>
                    {PLANS.map((p) => (
                      <td class="py-3 text-center">
                        {row.fn(PLAN_LIMITS[p.tier])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing FAQ */}
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

// ---------------------------------------------------------------------------
// Scan page (/scan) — form posts via HTMX to /scan, returns results inline
// ---------------------------------------------------------------------------

marketingRoutes.get("/scan", (c) => {
  return c.html(
    <MarketingPage title="Free AI-Readiness Scan">
      <div class="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
        <div class="w-full max-w-2xl space-y-8 text-center">
          <div class="space-y-3">
            <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
              Is your site AI-ready?
            </h1>
            <p class="text-lg text-gray-500">
              Enter any URL to get an instant AI-readiness score with actionable
              recommendations. No signup required.
            </p>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <form
              hx-post="/scan"
              hx-target="#scan-results"
              hx-swap="innerHTML"
              hx-indicator="#scan-loading"
              class="flex gap-3"
            >
              <input
                type="text"
                name="url"
                placeholder="https://example.com"
                required
                class="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                class="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Scan
              </button>
            </form>
            <div
              id="scan-loading"
              class="htmx-indicator mt-3 text-sm text-blue-600"
            >
              Scanning... this may take 10-20 seconds.
            </div>
            <p class="mt-3 text-xs text-gray-400">
              Include the full URL (e.g., https://yourdomain.com/blog) so the
              crawler can fetch the page without redirects.
            </p>
          </div>

          <div id="scan-results"></div>

          <div class="grid gap-4 text-left sm:grid-cols-3">
            <div class="space-y-1">
              <p class="font-semibold">37+ Factors</p>
              <p class="text-sm text-gray-500">
                Technical SEO, content quality, AI readiness, and performance
                checks.
              </p>
            </div>
            <div class="space-y-1">
              <p class="font-semibold">Quick Wins</p>
              <p class="text-sm text-gray-500">
                Prioritized fixes ranked by impact and effort with copy-paste
                code.
              </p>
            </div>
            <div class="space-y-1">
              <p class="font-semibold">Free &amp; Instant</p>
              <p class="text-sm text-gray-500">
                Results in seconds. Sign up for deeper crawls and monitoring.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MarketingPage>,
  );
});

// POST /scan — HTMX handler that calls the existing scan API internally
marketingRoutes.post("/scan", async (c) => {
  const formData = await c.req.parseBody();
  const url = String(formData.url || "").trim();

  if (!url) {
    return c.html(
      <div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Please enter a URL to scan.
      </div>,
    );
  }

  // Call the existing scan API route internally
  try {
    const apiUrl = new URL("/api/public/scan", c.req.url);
    const res = await fetch(apiUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const err = (await res.json()) as any;
      return c.html(
        <div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {err?.error?.message ||
            "Scan failed. Please check the URL and try again."}
        </div>,
      );
    }

    const data = (await res.json()) as any;
    const result = data.data;
    const scores = result.scores;

    const gradeColor = (grade: string) => {
      if (grade === "A") return "text-green-600 bg-green-50 border-green-200";
      if (grade === "B") return "text-blue-600 bg-blue-50 border-blue-200";
      if (grade === "C")
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      if (grade === "D")
        return "text-orange-600 bg-orange-50 border-orange-200";
      return "text-red-600 bg-red-50 border-red-200";
    };

    return c.html(
      <div class="mt-6 space-y-6 text-left">
        {/* Score hero */}
        <div class="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p class="text-sm font-medium text-gray-500">
            AI-Readiness Score for {result.domain}
          </p>
          <div
            class={`mx-auto mt-2 inline-flex h-20 w-20 items-center justify-center rounded-full border-4 text-3xl font-bold ${gradeColor(scores.letterGrade)}`}
          >
            {scores.letterGrade}
          </div>
          <p class="mt-2 text-2xl font-bold">{scores.overall}/100</p>
        </div>

        {/* Category scores */}
        <div class="grid gap-3 sm:grid-cols-2">
          {[
            { label: "Technical", score: scores.technical },
            { label: "Content", score: scores.content },
            { label: "AI Readiness", score: scores.aiReadiness },
            { label: "Performance", score: scores.performance },
          ].map((cat) => (
            <div class="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <span class="text-sm font-medium text-gray-700">{cat.label}</span>
              <span class="font-bold">{cat.score}/100</span>
            </div>
          ))}
        </div>

        {/* Top issues */}
        {result.issues && result.issues.length > 0 && (
          <div>
            <h3 class="mb-2 font-semibold">Top Issues</h3>
            <div class="space-y-2">
              {result.issues.map((issue: any) => (
                <div class="flex items-start gap-2 rounded-lg border border-gray-200 p-3 text-sm">
                  <span
                    class={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${issue.severity === "critical" ? "bg-red-100 text-red-700" : issue.severity === "warning" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}
                  >
                    {issue.severity}
                  </span>
                  <span class="text-gray-700">{issue.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
          <p class="text-sm text-blue-800">
            Want deeper analysis with up to 2,000 pages?{" "}
            <a href="/pricing" class="font-semibold underline">
              View plans
            </a>{" "}
            or{" "}
            <a href="/sign-up" class="font-semibold underline">
              sign up free
            </a>
            .
          </p>
        </div>
      </div>,
    );
  } catch {
    return c.html(
      <div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to scan. Please check the URL and try again.
      </div>,
    );
  }
});

// ---------------------------------------------------------------------------
// Leaderboard (/leaderboard) — server-rendered with HTMX grade filtering
// ---------------------------------------------------------------------------

function gradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function gradeColorClass(grade: string): string {
  if (grade === "A") return "bg-green-100 text-green-700";
  if (grade === "B") return "bg-blue-100 text-blue-700";
  if (grade === "C") return "bg-yellow-100 text-yellow-700";
  if (grade === "D") return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 80) return "text-blue-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 60) return "text-orange-600";
  return "text-red-600";
}

const LeaderboardList = ({
  entries,
  gradeFilter,
}: {
  entries: any[];
  gradeFilter: string;
}) => {
  const filtered =
    gradeFilter === "all"
      ? entries
      : entries.filter(
          (e: any) => gradeFromScore(e.overallScore) === gradeFilter,
        );

  if (filtered.length === 0) {
    return (
      <div class="rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        {gradeFilter === "all"
          ? "No sites have opted in to the leaderboard yet."
          : `No sites with grade ${gradeFilter} found.`}
      </div>
    );
  }

  return (
    <div class="space-y-2">
      {filtered.map((entry: any, index: number) => {
        const grade = gradeFromScore(entry.overallScore);
        return (
          <div class="flex items-center gap-4 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50">
            <span class="w-8 text-center text-lg font-bold text-gray-400">
              {index + 1}
            </span>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium">{entry.domain}</span>
                <span
                  class={`rounded px-2 py-0.5 text-xs font-medium ${gradeColorClass(grade)}`}
                >
                  {grade}
                </span>
              </div>
              <p class="text-xs text-gray-500">
                AI Readiness: {entry.aiReadinessScore ?? "—"}/100
              </p>
            </div>
            <span
              class={`text-2xl font-bold ${scoreColor(entry.overallScore)}`}
            >
              {entry.overallScore}
            </span>
          </div>
        );
      })}
    </div>
  );
};

marketingRoutes.get("/leaderboard", async (c) => {
  const db = c.get("db");
  const gradeFilter = c.req.query("grade") || "all";

  // Get projects that opted in to leaderboard with avg scores from latest crawl
  const leaderboardProjects = await db
    .select({
      projectId: projectsTable.id,
      domain: projectsTable.domain,
      overallScore:
        sql<number>`coalesce(avg(${pageScores.overallScore}), 0)`.as(
          "overall_score",
        ),
      aiReadinessScore:
        sql<number>`coalesce(avg(${pageScores.aiReadinessScore}), 0)`.as(
          "ai_readiness_score",
        ),
    })
    .from(projectsTable)
    .innerJoin(
      crawlJobs,
      and(
        eq(crawlJobs.projectId, projectsTable.id),
        eq(crawlJobs.status, "complete"),
      ),
    )
    .innerJoin(pageScores, eq(pageScores.jobId, crawlJobs.id))
    .where(eq(projectsTable.leaderboardOptIn, true))
    .groupBy(projectsTable.id, projectsTable.domain)
    .orderBy(sql`avg(${pageScores.overallScore}) desc`)
    .limit(50)
    .catch(() => [] as any[]);

  const isHtmx = c.req.header("HX-Request") === "true";

  if (isHtmx) {
    return c.html(
      <LeaderboardList
        entries={leaderboardProjects}
        gradeFilter={gradeFilter}
      />,
    );
  }

  const grades = ["all", "A", "B", "C", "D", "F"];

  return c.html(
    <MarketingPage title="AI Readiness Leaderboard">
      <div class="mx-auto max-w-4xl px-6 py-12">
        <div class="mb-6 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <span class="text-xl">&#127942;</span>
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight">
              AI Readiness Leaderboard
            </h1>
            <p class="text-sm text-gray-500">
              Top-scoring sites that opted in to public ranking
            </p>
          </div>
        </div>

        {/* Grade filter */}
        <div class="mb-6 flex gap-2">
          {grades.map((grade) => (
            <button
              hx-get={`/leaderboard?grade=${grade}`}
              hx-target="#leaderboard-list"
              hx-swap="innerHTML"
              class={`rounded-lg px-3 py-1.5 text-sm font-medium ${grade === gradeFilter ? "bg-blue-600 text-white" : "border border-gray-300 hover:bg-gray-50"}`}
            >
              {grade === "all" ? "All" : `Grade ${grade}`}
            </button>
          ))}
        </div>

        <div id="leaderboard-list">
          <LeaderboardList
            entries={leaderboardProjects}
            gradeFilter={gradeFilter}
          />
        </div>

        {/* Explanation */}
        <div class="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h3 class="font-semibold">How we rank sites</h3>
          <p class="mt-2 text-sm text-gray-500">
            Sites are ranked by their overall AI-readiness score, calculated
            from Technical SEO (25%), Content Quality (30%), AI Readiness (30%),
            and Performance (15%). Only projects that have opted in appear here.
          </p>
        </div>

        <div class="mt-6 text-center">
          <a href="/scan" class="text-sm text-blue-600 hover:underline">
            Scan your site to see where you'd rank
          </a>
        </div>
      </div>
    </MarketingPage>,
  );
});

// ---------------------------------------------------------------------------
// ChatGPT SEO guide (/chatgpt-seo)
// ---------------------------------------------------------------------------

marketingRoutes.get("/chatgpt-seo", (c) => {
  return c.html(
    <MarketingPage title="ChatGPT SEO Guide - How to Rank in ChatGPT Answers">
      <section class="px-6 py-24 text-center">
        <div class="mx-auto max-w-4xl">
          <h1 class="text-4xl font-bold tracking-tight sm:text-6xl">
            How to Rank in <span class="text-blue-600">ChatGPT</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
            Optimization for Large Language Models (LLMs) is the new SEO. Audit
            your site to see if ChatGPT trusts your content.
          </p>
          <div class="mt-10">
            <a
              href="/scan"
              class="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700"
            >
              Check My ChatGPT Visibility
            </a>
          </div>
        </div>
      </section>

      <section class="bg-gray-50 px-6 py-20">
        <div class="mx-auto grid max-w-6xl gap-12 md:grid-cols-3">
          {[
            {
              title: "Entity Optimization",
              desc: "ChatGPT understands concepts, not just keywords. We check if your content clearly defines entities and relationships.",
            },
            {
              title: "Citation Worthiness",
              desc: "To be cited, you need stats, original data, and clear 'direct answer' formatting. We score your content against these patterns.",
            },
            {
              title: "Technical Access",
              desc: "Ensure GPTBot can crawl your site. We validate your robots.txt, sitemap, and page speed to ensure AI accessibility.",
            },
          ].map((step) => (
            <div class="space-y-4 text-center">
              <h3 class="text-xl font-bold">{step.title}</h3>
              <p class="text-gray-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section class="px-6 py-20">
        <div class="mx-auto max-w-3xl space-y-8">
          <div>
            <h2 class="text-3xl font-bold">Optimization for the Chat Era</h2>
            <p class="mt-4 text-lg leading-relaxed text-gray-500">
              Users trust ChatGPT to summarize complex topics. If your content
              is too verbose, poorly structured, or technically inaccessible,
              ChatGPT will skip it in favor of a competitor.
            </p>
          </div>
          <div>
            <h3 class="text-2xl font-bold">What LLM Rank checks</h3>
            <p class="mt-4 leading-relaxed text-gray-500">
              We simulate an AI crawler on your site immediately. We check for
              Open Graph tags, schema markup, semantic HTML tags, and answer
              brevity—all key factors for AI citation.
            </p>
          </div>
        </div>
      </section>

      <section class="border-t border-gray-200 bg-gray-50 px-6 py-20">
        <div class="mx-auto max-w-3xl">
          <h2 class="mb-10 text-center text-3xl font-bold">
            ChatGPT SEO Questions
          </h2>
          <div class="space-y-6">
            {[
              {
                q: "Does ChatGPT use live data from the web?",
                a: "Yes. ChatGPT with browsing (SearchGPT) can access the live web to answer timely questions. It cites sources with links.",
              },
              {
                q: "How do I get cited in ChatGPT answers?",
                a: "You need comprehensive coverage of your topic, clear logical structure, and avoiding 'fluff'. LLM Rank identifies the exact content gaps preventing you from being cited.",
              },
              {
                q: "Can I block ChatGPT from my site?",
                a: "Yes, you can disallow 'GPTBot' in your robots.txt file. However, this means you will not be cited in ChatGPT answers.",
              },
            ].map((item) => (
              <div class="rounded-lg border border-gray-200 bg-white p-6">
                <h3 class="font-bold">{item.q}</h3>
                <p class="mt-2 text-gray-500">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section class="border-t border-gray-200 py-20 text-center">
        <h2 class="text-3xl font-bold">Audit your site for ChatGPT</h2>
        <p class="mt-4 text-gray-500">
          See exactly how AI models view your content.
        </p>
        <div class="mt-8">
          <a
            href="/scan"
            class="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Run Free Audit
          </a>
        </div>
      </section>
    </MarketingPage>,
  );
});

// ---------------------------------------------------------------------------
// AI SEO Tool page (/ai-seo-tool)
// ---------------------------------------------------------------------------

marketingRoutes.get("/ai-seo-tool", (c) => {
  return c.html(
    <MarketingPage title="AI SEO Tool - How to Rank in ChatGPT & Perplexity">
      <section class="px-6 py-24 text-center">
        <div class="mx-auto max-w-4xl">
          <h1 class="text-4xl font-bold tracking-tight sm:text-6xl">
            The AI SEO Tool for the{" "}
            <span class="text-blue-600">Generative Search Era</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
            Don't leave your AI visibility to chance. Audit your site, fix
            technical gaps, and become the trusted source for ChatGPT, Claude,
            and Perplexity.
          </p>
          <div class="mt-10 flex items-center justify-center gap-4">
            <a
              href="/scan"
              class="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700"
            >
              Audit My Site Free
            </a>
            <a
              href="/pricing"
              class="rounded-lg border border-gray-300 px-8 py-3 text-base font-semibold hover:bg-gray-50"
            >
              View Plans
            </a>
          </div>
        </div>
      </section>

      <section class="bg-gray-50 px-6 py-20">
        <div class="mx-auto grid max-w-6xl gap-12 md:grid-cols-3">
          {[
            {
              title: "Visibility Analysis",
              desc: "We query ChatGPT, Claude, Perplexity, and Gemini with brand-specific prompts to see if your content is cited, mentioned, or ignored.",
            },
            {
              title: "37-Factor Scoring",
              desc: "Our engine checks Technical SEO, Content Depth, readability, and structural elements that LLMs rely on to understand and trust your content.",
            },
            {
              title: "Actionable Fixes",
              desc: "Don't just get a score. Get code snippets and content recommendations prioritized by impact-to-effort ratio.",
            },
          ].map((f) => (
            <div class="space-y-4 text-center">
              <h3 class="text-xl font-bold">{f.title}</h3>
              <p class="text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section class="px-6 py-20">
        <div class="mx-auto max-w-3xl space-y-8">
          <div>
            <h2 class="text-3xl font-bold">
              Why you need an AI SEO Tool today
            </h2>
            <p class="mt-4 text-lg leading-relaxed text-gray-500">
              Search behavior is changing. Users are asking detailed questions
              to AI instead of typing keywords into Google. If your site isn't
              optimized for these models, you are invisible to this new wave of
              traffic.
            </p>
          </div>
          <div>
            <h3 class="text-2xl font-bold">Optimization beyond keywords</h3>
            <p class="mt-4 leading-relaxed text-gray-500">
              LLM Rank checks for things Google might ignore but AI loves: clear
              semantic HTML, direct answer formatting, logical content
              hierarchy, and authoritative entity coverage.
            </p>
          </div>
        </div>
      </section>

      <section class="border-t border-gray-200 bg-gray-50 px-6 py-20">
        <div class="mx-auto max-w-3xl">
          <h2 class="mb-10 text-center text-3xl font-bold">
            Common Questions about AI SEO
          </h2>
          <div class="space-y-6">
            {[
              {
                q: "What is an AI SEO Tool?",
                a: "An AI SEO tool optimizes for citation-worthiness in generative search engines like ChatGPT, Claude, Perplexity, and Gemini, not just traditional blue links.",
              },
              {
                q: "How is AI SEO different from traditional SEO?",
                a: "Traditional SEO optimizes for keywords and backlinks. AI SEO optimizes for entities, context, and structural clarity to be 'read' and 'understood' by an AI model.",
              },
              {
                q: "Does this tool work for any website?",
                a: "Yes. LLM Rank can audit any publicly accessible URL. It is particularly effective for content-heavy sites, SaaS documentation, and blogs.",
              },
            ].map((item) => (
              <div class="rounded-lg border border-gray-200 bg-white p-6">
                <h3 class="font-bold">{item.q}</h3>
                <p class="mt-2 text-gray-500">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section class="border-t border-gray-200 py-20 text-center">
        <h2 class="text-3xl font-bold">Start your AI SEO journey</h2>
        <p class="mt-4 text-gray-500">
          Get your baseline AI-readiness score in under 2 minutes.
        </p>
        <div class="mt-8">
          <a
            href="/scan"
            class="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Run Free Audit
          </a>
        </div>
      </section>
    </MarketingPage>,
  );
});

// ---------------------------------------------------------------------------
// Privacy page (/privacy)
// ---------------------------------------------------------------------------

marketingRoutes.get("/privacy", (c) => {
  return c.html(
    <MarketingPage title="Privacy Policy">
      <main class="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 class="text-3xl font-bold">Privacy Policy</h1>
        <p class="mt-2 text-sm text-gray-500">Last updated: February 2026</p>

        <div class="mt-10 space-y-8 text-gray-700 leading-7">
          <section>
            <h2 class="text-xl font-semibold">1. Information We Collect</h2>
            <p class="mt-4 text-gray-500">
              <strong class="text-gray-700">Account data:</strong> Email
              address, name, and phone number provided during registration.
            </p>
            <p class="mt-4 text-gray-500">
              <strong class="text-gray-700">Crawl data:</strong> Publicly
              accessible HTML content, metadata, and Lighthouse performance
              metrics from websites you authorize us to crawl.
            </p>
            <p class="mt-4 text-gray-500">
              <strong class="text-gray-700">Usage data:</strong> API request
              logs, feature usage patterns, and session timestamps.
            </p>
            <p class="mt-4 text-gray-500">
              <strong class="text-gray-700">Billing data:</strong> Payment
              information is processed by Stripe. We store subscription status,
              plan type, and invoice references — never raw card numbers.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">2. How We Use Your Data</h2>
            <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-500">
              <li>Score your pages across 37 AI-readiness factors.</li>
              <li>Generate visibility reports and recommendations.</li>
              <li>Send transactional emails via Resend.</li>
              <li>Enforce plan limits and billing.</li>
              <li>Improve the Service based on aggregate usage patterns.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold">3. Third-Party Services</h2>
            <div class="mt-4 overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200">
                    <th class="pb-2 pr-6 text-left font-medium">Service</th>
                    <th class="pb-2 pr-6 text-left font-medium">Purpose</th>
                    <th class="pb-2 text-left font-medium">Data shared</th>
                  </tr>
                </thead>
                <tbody class="text-gray-500">
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-6">Clerk</td>
                    <td class="py-2 pr-6">Authentication</td>
                    <td class="py-2">Email, name, session tokens</td>
                  </tr>
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-6">Stripe</td>
                    <td class="py-2 pr-6">Billing</td>
                    <td class="py-2">Payment method, email</td>
                  </tr>
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-6">Neon</td>
                    <td class="py-2 pr-6">Database</td>
                    <td class="py-2">
                      All application data (encrypted at rest)
                    </td>
                  </tr>
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-6">Cloudflare</td>
                    <td class="py-2 pr-6">Hosting, CDN</td>
                    <td class="py-2">Request metadata, crawled HTML</td>
                  </tr>
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-6">Anthropic / OpenAI</td>
                    <td class="py-2 pr-6">Content scoring</td>
                    <td class="py-2">Page text snippets (no PII)</td>
                  </tr>
                  <tr>
                    <td class="py-2 pr-6">Resend</td>
                    <td class="py-2 pr-6">Email</td>
                    <td class="py-2">Email address, email content</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 class="text-xl font-semibold">4. Data Storage and Security</h2>
            <p class="mt-4 text-gray-500">
              Data is stored in Neon PostgreSQL (encrypted at rest, TLS
              connections). Crawled HTML goes to Cloudflare R2 (encrypted at
              rest). All API calls use HTTPS. Services use HMAC-SHA256 signed
              messages.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">5. Data Retention</h2>
            <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-500">
              <li>Active accounts: data kept while account is open.</li>
              <li>
                Crawl data: stored for your plan's history window (30 days to 2
                years).
              </li>
              <li>Deleted accounts: data removed within 30 days.</li>
              <li>Billing records: kept for 7 years as required by law.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold">6. Your Rights</h2>
            <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-500">
              <li>Access and export your data via the dashboard or API.</li>
              <li>Correct your account information in Settings.</li>
              <li>Delete your account and all associated data.</li>
              <li>Request a copy of all data we hold about you.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold">7. Cookies</h2>
            <p class="mt-4 text-gray-500">
              We only use cookies to keep you logged in. No advertising or
              tracking cookies.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">8. Children</h2>
            <p class="mt-4 text-gray-500">
              This Service is not for anyone under 16. We do not knowingly
              collect data from children.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">9. Changes to This Policy</h2>
            <p class="mt-4 text-gray-500">
              We may update this policy. We will email you about major changes.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">10. Contact</h2>
            <p class="mt-4 text-gray-500">
              Email us at{" "}
              <a
                href="mailto:privacy@llmboost.app"
                class="text-blue-600 underline"
              >
                privacy@llmboost.app
              </a>
              . See also our{" "}
              <a
                href="/terms"
                class="font-medium text-blue-600 hover:underline"
              >
                terms of service
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </MarketingPage>,
  );
});

// ---------------------------------------------------------------------------
// Terms page (/terms)
// ---------------------------------------------------------------------------

marketingRoutes.get("/terms", (c) => {
  return c.html(
    <MarketingPage title="Terms of Service">
      <main class="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 class="text-3xl font-bold">Terms of Service</h1>
        <p class="mt-2 text-sm text-gray-500">Last updated: February 2026</p>

        <div class="mt-10 space-y-8 text-gray-700 leading-7">
          <section>
            <h2 class="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p class="mt-4 text-gray-500">
              By using LLM Rank ("the Service"), you agree to these Terms. LLM
              Boost Inc. operates the Service. If you do not agree, please do
              not use the Service.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">2. Service Description</h2>
            <p class="mt-4 text-gray-500">
              LLM Rank provides website crawling, AI-readiness scoring, and
              visibility analysis tools. The Service crawls publicly accessible
              web pages you authorize, scores them across 37 factors, and
              provides recommendations.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">3. Account Registration</h2>
            <p class="mt-4 text-gray-500">
              You must create an account to use the Service. You are responsible
              for maintaining account credential confidentiality and all
              activity under your account.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">4. Subscriptions and Billing</h2>
            <p class="mt-4 text-gray-500">
              Paid plans are billed monthly via Stripe. You may cancel at any
              time; access continues through the current billing period.
            </p>
            <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-500">
              <li>Free: 10 pages/crawl, 2 crawls/month, 1 project.</li>
              <li>
                Starter ($79/mo), Pro ($149/mo), Agency ($299/mo): see{" "}
                <a href="/pricing" class="text-blue-600 underline">
                  Pricing
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold">5. Acceptable Use</h2>
            <p class="mt-4 text-gray-500">You agree not to:</p>
            <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-500">
              <li>
                Crawl domains you do not own or have authorization to crawl.
              </li>
              <li>Attempt to circumvent rate limits or plan restrictions.</li>
              <li>Use the Service for spam, phishing, or malicious content.</li>
              <li>Reverse-engineer or extract source code from the Service.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold">6. Intellectual Property</h2>
            <p class="mt-4 text-gray-500">
              You own your website content. We own the Service, scoring
              algorithms, and generated reports. Scores and recommendations are
              licensed for your internal use.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">7. Data Handling</h2>
            <p class="mt-4 text-gray-500">
              We do not sell your data. See our{" "}
              <a href="/privacy" class="text-blue-600 underline">
                Privacy Policy
              </a>{" "}
              for details.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">8. Limitation of Liability</h2>
            <p class="mt-4 text-gray-500">
              We provide the Service "as is" without warranties. Maximum
              liability is limited to fees paid in the 12 months before the
              claim.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">9. Termination</h2>
            <p class="mt-4 text-gray-500">
              We may suspend accounts that violate these Terms. You can delete
              your account at any time; data is removed within 30 days.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">10. Changes to Terms</h2>
            <p class="mt-4 text-gray-500">
              We may update these Terms. Continued use constitutes acceptance of
              changes.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">11. Contact</h2>
            <p class="mt-4 text-gray-500">
              Email us at{" "}
              <a
                href="mailto:legal@llmboost.app"
                class="text-blue-600 underline"
              >
                legal@llmboost.app
              </a>
              . See also our{" "}
              <a
                href="/privacy"
                class="font-medium text-blue-600 hover:underline"
              >
                privacy policy
              </a>{" "}
              and{" "}
              <a
                href="/pricing"
                class="font-medium text-blue-600 hover:underline"
              >
                pricing plans
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </MarketingPage>,
  );
});
