/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../index";
import {
  projects as projectsTable,
  crawlJobs,
  pageScores,
} from "@llm-boost/db";
import { eq, and, sql } from "drizzle-orm";
import { MarketingPage } from "../views/marketing";
import { marketingLegalRoutes } from "./marketing/legal";
import { marketingToolRoutes } from "./marketing/tool";
import { marketingPricingRoutes } from "./marketing/pricing";
import { marketingChatgptSeoRoutes } from "./marketing/chatgpt-seo";
export const marketingRoutes = new Hono<AppEnv>();
marketingRoutes.route("/", marketingPricingRoutes);
marketingRoutes.route("/", marketingChatgptSeoRoutes);

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

marketingRoutes.route("/", marketingToolRoutes);
marketingRoutes.route("/", marketingLegalRoutes);






