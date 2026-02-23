# AI-Readiness Score Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 35 issues identified in the AI-readiness report to push llmrank.app from 89 (B) to 95+ (A).

**Architecture:** Three-phase approach — (1) fix cross-cutting technical SEO infrastructure (OG tags, title lengths, missing metadata), (2) expand content on all public pages to 500+ words with FAQ sections and authoritative citations, (3) fix the Performance 0 bug in the report data aggregator.

**Tech Stack:** Next.js Metadata API, JSON-LD structured data, packages/reports data-aggregator

---

### Task 1: Add Default OG Image to Root Layout

**Issue:** MISSING_OG_TAGS — 8 pages missing og:image (-2 pts each, -16 total)

**Files:**

- Create: `apps/web/public/og-default.png` (placeholder — will need a real 1200x630 image)
- Modify: `apps/web/src/app/layout.tsx:26-33`

**Step 1: Create a placeholder OG image**

Create a simple 1200x630 SVG-based placeholder at `apps/web/public/og-default.png`. For now, this can be a solid branded image. The user should replace it with a proper social card later.

```
# Use any method to create a 1200x630 PNG. For now, create the file path:
# apps/web/public/og-default.png
```

**Step 2: Add og:image to root layout metadata**

In `apps/web/src/app/layout.tsx`, update the `openGraph` and `twitter` sections:

```typescript
openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "LLM Rank",
    title: "LLM Rank - AI-Readiness SEO Platform",
    description:
      "Audit your website for AI-readiness across 37 factors. Improve visibility in ChatGPT, Claude, Perplexity, and Gemini.",
    url: BASE_URL,
    images: [
      {
        url: `${BASE_URL}/og-default.png`,
        width: 1200,
        height: 630,
        alt: "LLM Rank — AI-Readiness SEO Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Rank - AI-Readiness SEO Platform",
    description:
      "Audit your website for AI-readiness across 37 factors. Improve visibility in ChatGPT, Claude, Perplexity, and Gemini.",
    images: [`${BASE_URL}/og-default.png`],
  },
```

**Step 3: Verify build succeeds**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds without errors

**Step 4: Commit**

```bash
git add apps/web/public/og-default.png apps/web/src/app/layout.tsx
git commit -m "fix(seo): add default og:image to root layout metadata"
```

---

### Task 2: Fix Title Tags for 30-60 Character Range

**Issue:** MISSING_TITLE — 3 pages have titles outside 30-60 chars (-8 pts each, -24 total)

The root layout template is `"%s | LLM Rank"` (adds 12 chars). Pages must set titles between 18-48 chars (so rendered title is 30-60).

**Files:**

- Modify: `apps/web/src/app/pricing/page.tsx:13` — "Pricing" → too short (20 rendered)
- Modify: `apps/web/src/app/integrations/page.tsx:13` — "Integrations" → too short (25 rendered)
- Modify: `apps/web/src/app/terms/page.tsx:6` — title too long with template (>60 rendered)
- Modify: `apps/web/src/app/privacy/page.tsx:6` — title too long with template (>60 rendered)

**Step 1: Fix pricing title**

In `apps/web/src/app/pricing/page.tsx`, change:

```typescript
// OLD
title: "Pricing",

// NEW
title: "AI-Readiness SEO Pricing Plans",
```

Rendered: "AI-Readiness SEO Pricing Plans | LLM Rank" = 44 chars ✓

**Step 2: Fix integrations title**

In `apps/web/src/app/integrations/page.tsx`, change:

```typescript
// OLD
title: "Integrations",

// NEW
title: "SEO Integrations & Connections",
```

Rendered: "SEO Integrations & Connections | LLM Rank" = 43 chars ✓

**Step 3: Fix terms title (use absolute to bypass template)**

In `apps/web/src/app/terms/page.tsx`, change:

```typescript
// OLD
title: "Terms of Service — LLM Rank AI-Readiness Platform",

// NEW
title: "Terms of Service — LLM Rank",
```

Rendered: "Terms of Service — LLM Rank | LLM Rank" = 41 chars ✓
(Or use `title: { absolute: "Terms of Service — LLM Rank" }` if you want no template = 29 chars, slightly short)

Better approach:

```typescript
title: "Terms of Service",
```

Rendered: "Terms of Service | LLM Rank" = 28 chars — still too short.

Best:

```typescript
title: "Terms of Service — AI-Readiness",
```

Rendered: "Terms of Service — AI-Readiness | LLM Rank" = 44 chars ✓

**Step 4: Fix privacy title**

In `apps/web/src/app/privacy/page.tsx`, change:

```typescript
// OLD
title: "Privacy Policy — LLM Rank AI-Readiness Platform",

// NEW
title: "Privacy Policy — AI-Readiness",
```

Rendered: "Privacy Policy — AI-Readiness | LLM Rank" = 42 chars ✓

**Step 5: Verify build**

Run: `cd apps/web && pnpm build`

**Step 6: Commit**

```bash
git add apps/web/src/app/pricing/page.tsx apps/web/src/app/integrations/page.tsx apps/web/src/app/terms/page.tsx apps/web/src/app/privacy/page.tsx
git commit -m "fix(seo): adjust page titles to 30-60 character range"
```

---

### Task 3: Add FAQPage JSON-LD Schema Builder

**Issue:** MISSING_FAQ_STRUCTURE — 2 pages need FAQ format (-2 pts each). We'll also need this for content expansion tasks.

**Files:**

- Modify: `apps/web/src/components/seo/json-ld.tsx`

**Step 1: Add faqSchema builder**

Add to `apps/web/src/components/seo/json-ld.tsx`:

```typescript
export function faqSchema(questions: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/seo/json-ld.tsx
git commit -m "feat(seo): add FAQPage JSON-LD schema builder"
```

---

### Task 4: Add Metadata to /scan/results Page

**Files:**

- Modify: `apps/web/src/app/scan/results/page.tsx`

Since this is a `"use client"` component, we can't export metadata directly. Two options:

1. Create a `layout.tsx` wrapper for /scan/results with metadata
2. Convert to server component wrapper + client component

**Step 1: Create scan/results layout with metadata**

Create `apps/web/src/app/scan/results/layout.tsx`:

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your AI-Readiness Scan Results",
  description:
    "View your website's AI-readiness score across 37 factors with actionable recommendations to improve visibility in ChatGPT, Claude, and Perplexity.",
  alternates: { canonical: "/scan/results" },
  openGraph: {
    title: "AI-Readiness Scan Results | LLM Rank",
    description:
      "See how your website scores for AI search visibility across 37 factors.",
    url: "https://llmrank.app/scan/results",
  },
};

export default function ScanResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

**Step 2: Verify build**

Run: `cd apps/web && pnpm build`

**Step 3: Commit**

```bash
git add apps/web/src/app/scan/results/layout.tsx
git commit -m "fix(seo): add metadata to /scan/results page"
```

---

### Task 5: Add Metadata to /leaderboard Page

**Files:**

- Create: `apps/web/src/app/leaderboard/layout.tsx`

**Step 1: Create leaderboard layout with metadata**

Create `apps/web/src/app/leaderboard/layout.tsx`:

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI-Readiness Leaderboard",
  description:
    "See which websites score highest for AI-readiness. Compare domains across 37 factors and find out who leads in AI search visibility.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "AI-Readiness Leaderboard | LLM Rank",
    description:
      "Compare websites by AI-readiness score. See who leads in visibility across ChatGPT, Claude, and Perplexity.",
    url: "https://llmrank.app/leaderboard",
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/leaderboard/layout.tsx
git commit -m "fix(seo): add metadata to /leaderboard page"
```

---

### Task 6: Homepage Content Expansion + FAQ

**Issues addressed:** THIN_CONTENT, POOR_READABILITY, MISSING_FAQ_STRUCTURE, NO_DIRECT_ANSWERS

**Files:**

- Modify: `apps/web/src/app/page.tsx`

**Step 1: Add direct answer paragraph to hero**

After the hero `<p>` tag (line 121), add a direct-answer paragraph:

```tsx
<p className="mt-4 text-base leading-7 text-muted-foreground">
  LLM Rank is an AI-readiness SEO platform that crawls your website and scores
  every page across 37 factors in four categories: Technical SEO, Content
  Quality, AI Readiness, and Performance. Each page gets a letter grade from A
  to F, along with prioritized quick wins sorted by impact and effort. The
  platform checks your visibility in ChatGPT, Claude, Perplexity, and Gemini,
  tracks changes over time, and generates detailed PDF reports. Start with a
  free scan — no signup required.
</p>
```

**Step 2: Expand "How it works" step descriptions**

Update the STEPS array to have longer, more readable descriptions (aim for 40-50 words each instead of 25-30):

```typescript
const STEPS = [
  {
    step: "1",
    title: "Enter your URL",
    description:
      "Paste any website URL into the scanner. LLM Rank crawls your pages, checks technical SEO factors like meta tags and structured data, runs Lighthouse performance audits, and extracts content signals. The free scan covers up to 10 pages. Paid plans handle up to 2,000 pages per crawl.",
  },
  {
    step: "2",
    title: "Get your AI-readiness score",
    description:
      "Each page is scored across 37 factors in four categories: Technical SEO (25% weight), Content Quality (30%), AI Readiness (30%), and Performance (15%). You get a letter grade from A to F. The dashboard shows which pages need the most work and how your scores compare to industry benchmarks.",
  },
  {
    step: "3",
    title: "Fix what matters most",
    description:
      "Prioritized quick wins show you exactly what to fix first. Each recommendation is sorted by impact and effort. Common fixes include adding structured data, improving meta tags, expanding thin content, and adding authoritative citations. Track your progress as scores improve with each crawl.",
  },
];
```

**Step 3: Expand feature descriptions**

Update the FEATURES array with longer descriptions (50-60 words each):

```typescript
const FEATURES = [
  {
    title: "37-Factor Scoring Engine",
    description:
      "Every page is evaluated across Technical SEO (25%), Content Quality (30%), AI Readiness (30%), and Performance (15%). Factors include structured data validation, canonical tag checks, content depth analysis, citation-worthiness scoring, and Lighthouse metrics. The engine follows Google's Search Central guidelines and Schema.org standards to ensure recommendations align with search engine best practices.",
  },
  {
    title: "AI Visibility Checks",
    description:
      "See how your brand appears across ChatGPT, Claude, Perplexity, and Gemini. Track mention rates, citation positions, and competitor presence in AI-generated responses. Understand which queries trigger mentions of your brand and where competitors appear instead. Visibility data updates with each crawl so you can measure the impact of your changes over time.",
  },
  {
    title: "Actionable Recommendations",
    description:
      "Every issue comes with a specific fix and an estimated score impact. Quick wins are ranked by impact-to-effort ratio so you know where to start. Export detailed PDF or DOCX reports for clients, stakeholders, or your content team. Reports include score trends, issue catalogs, and a prioritized action plan organized by urgency.",
  },
  {
    title: "Integrations That Matter",
    description:
      "Connect Google Search Console to correlate traditional search performance with AI readiness scores. Link Google Analytics 4 to track how AI-driven traffic converts on your site. A WordPress plugin is coming soon for real-time content scoring directly in the editor. Slack integration delivers score alerts and weekly summaries to your team.",
  },
];
```

**Step 4: Add FAQ section before the CTA**

Insert a FAQ section after the Features section and before the CTA section:

```tsx
{
  /* FAQ */
}
<section className="border-t border-border bg-muted/40 px-6 py-20">
  <div className="mx-auto max-w-3xl">
    <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
      Frequently asked questions
    </h2>
    <div className="mt-10 space-y-6">
      {FAQ_ITEMS.map((item) => (
        <details
          key={item.question}
          className="group rounded-lg border border-border bg-background p-5"
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
</section>;
```

Add the FAQ data array:

```typescript
const FAQ_ITEMS = [
  {
    question: "What is AI-readiness and why does it matter?",
    answer:
      "AI-readiness measures how well your website content can be understood, cited, and recommended by large language models like ChatGPT, Claude, Perplexity, and Gemini. As more users turn to AI-powered search for answers, websites that score higher for AI-readiness are more likely to appear in AI-generated responses. This is the next frontier of SEO beyond traditional Google rankings.",
  },
  {
    question: "How does the 37-factor scoring engine work?",
    answer:
      "Each page is evaluated across four categories: Technical SEO (25% of the total score), Content Quality (30%), AI Readiness (30%), and Performance (15%). Factors include structured data presence, meta tag quality, content depth, readability, citation-worthiness, internal linking, and Lighthouse performance metrics. Scores start at 100 per category and deductions are applied for each issue found.",
  },
  {
    question: "Is the free scan really free?",
    answer:
      "Yes. The free scan analyzes up to 10 pages on any website with no signup required. You get a full AI-readiness score, letter grade, issue catalog, and prioritized quick wins. For deeper analysis covering up to 2,000 pages, recurring crawls, AI visibility tracking, and integrations, you can upgrade to a paid plan starting at $79 per month.",
  },
  {
    question: "Which AI search engines do you track?",
    answer:
      "LLM Rank tracks your brand visibility across four major AI platforms: OpenAI ChatGPT, Anthropic Claude, Perplexity, and Google Gemini. Visibility checks monitor whether your brand is mentioned, whether your URLs are cited, and where you rank relative to competitors in AI-generated responses.",
  },
  {
    question: "How often should I run a crawl?",
    answer:
      "We recommend running a crawl after every significant content update or at least once per month. The Pro plan includes 30 crawls per month, which is enough for weekly monitoring of a mid-size site. Score trends help you see whether your changes are improving your AI-readiness over time.",
  },
];
```

**Step 5: Add FAQPage JSON-LD and authoritative citations**

Import `faqSchema` and add it after the existing `JsonLd`:

```tsx
import { JsonLd, softwareApplicationSchema, faqSchema } from "@/components/seo/json-ld";

// In the component:
<JsonLd data={softwareApplicationSchema()} />
<JsonLd
  data={faqSchema(
    FAQ_ITEMS.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
  )}
/>
```

**Step 6: Add authoritative citations to the "Everything you need" section description**

Update the section intro paragraph to include authoritative links:

```tsx
<p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
  Traditional SEO tools optimize for Google. LLM Rank optimizes for the next
  generation of search: large language models that synthesize answers from
  across the web. Our scoring methodology is built on{" "}
  <a
    href="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data"
    target="_blank"
    rel="noopener noreferrer"
    className="font-medium text-primary hover:underline"
  >
    Google&apos;s structured data guidelines
  </a>{" "}
  and{" "}
  <a
    href="https://schema.org/"
    target="_blank"
    rel="noopener noreferrer"
    className="font-medium text-primary hover:underline"
  >
    Schema.org standards
  </a>
  .
</p>
```

**Step 7: Add internal links section above footer**

Add more internal links in the footer area and in the CTA:

```tsx
{
  /* CTA — update to include internal links */
}
<section className="border-t border-border px-6 py-20">
  <div className="mx-auto max-w-2xl text-center">
    <h2 className="text-3xl font-bold tracking-tight text-foreground">
      Ready to see your AI-readiness score?
    </h2>
    <p className="mt-4 text-muted-foreground">
      Run a free scan on any URL in seconds. No signup required. See exactly
      what AI search engines think of your content and what to fix first.
    </p>
    <div className="mt-8 flex items-center justify-center gap-4">
      <Link
        href="/scan"
        className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
      >
        Scan Your Site Free
      </Link>
      <Link
        href="/pricing"
        className="text-sm font-semibold text-foreground hover:text-primary"
      >
        View pricing &rarr;
      </Link>
    </div>
    <p className="mt-6 text-sm text-muted-foreground">
      Or explore our{" "}
      <Link
        href="/integrations"
        className="font-medium text-primary hover:underline"
      >
        integrations
      </Link>
      ,{" "}
      <Link
        href="/leaderboard"
        className="font-medium text-primary hover:underline"
      >
        AI-readiness leaderboard
      </Link>
      , and{" "}
      <Link
        href="/pricing"
        className="font-medium text-primary hover:underline"
      >
        pricing plans
      </Link>
      .
    </p>
  </div>
</section>;
```

**Step 8: Verify build**

Run: `cd apps/web && pnpm build`

**Step 9: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(seo): expand homepage content with FAQ, citations, and direct answers"
```

---

### Task 7: Pricing Page Content Expansion + FAQ

**Issues addressed:** THIN_CONTENT, POOR_READABILITY, MISSING_FAQ_STRUCTURE

**Files:**

- Modify: `apps/web/src/app/pricing/page.tsx`

**Step 1: Add intro prose after the hero section**

After the hero `<p>` tag and before the Cards section, add an explanatory paragraph:

```tsx
<p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
  Every plan includes access to our full 37-factor scoring engine, which
  evaluates Technical SEO, Content Quality, AI Readiness, and Performance. The
  free tier lets you scan up to 10 pages per crawl with 2 monthly crawls and 1
  project. Paid plans unlock more pages per crawl, higher crawl frequency,
  additional projects, AI visibility checks, integrations with Google Search
  Console and Google Analytics, and detailed report exports. All plans include
  prioritized quick wins, issue catalogs, and score trend tracking.
</p>
```

**Step 2: Add FAQ section after the comparison table**

```tsx
{
  /* FAQ */
}
<section className="px-6 py-20">
  <div className="mx-auto max-w-3xl">
    <h2 className="text-center text-2xl font-bold text-foreground">
      Pricing FAQ
    </h2>
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
</section>;
```

Add data:

```typescript
const PRICING_FAQ = [
  {
    question: "Can I change plans at any time?",
    answer:
      "Yes. You can upgrade or downgrade your plan at any time from the dashboard settings page. When upgrading, the new plan takes effect immediately and you are billed the prorated difference. When downgrading, the change takes effect at the start of your next billing cycle.",
  },
  {
    question: "What happens when I hit my crawl limit?",
    answer:
      "When you reach your monthly crawl limit, you can still view all existing scores, reports, and recommendations. New crawls will be available when your billing cycle resets. Upgrade to a higher plan for more crawls — the Pro plan includes 30 per month and Agency offers unlimited crawls.",
  },
  {
    question: "Do I need a credit card for the free plan?",
    answer:
      "No. The free plan requires only an email address to sign up. You get 10 pages per crawl, 2 crawls per month, and 1 project — no credit card needed. Upgrade when you need more capacity.",
  },
  {
    question: "What is an AI visibility check?",
    answer:
      "Visibility checks query major AI platforms — ChatGPT, Claude, Perplexity, and Gemini — with relevant queries to see if your brand is mentioned or your URLs are cited. This helps you understand how visible your content is in AI-generated answers, not just in traditional search results.",
  },
];
```

**Step 3: Add FAQPage JSON-LD**

Import `faqSchema` and add the JSON-LD:

```tsx
import {
  JsonLd,
  productOffersSchema,
  breadcrumbSchema,
  faqSchema,
} from "@/components/seo/json-ld";

// Inside the component, add after existing JsonLd tags:
<JsonLd
  data={faqSchema(
    PRICING_FAQ.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
  )}
/>;
```

**Step 4: Add authoritative citation**

In the hero section intro paragraph, add a reference:

```tsx
<p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
  Start free, upgrade when you need more pages, crawls, or integrations. All
  plans include the full 37-factor scoring engine built on{" "}
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
```

**Step 5: Add internal links in a footer CTA**

After the comparison table and before the footer, add:

```tsx
<div className="mx-auto max-w-3xl px-6 pb-12 text-center">
  <p className="text-sm text-muted-foreground">
    Not sure which plan is right for you?{" "}
    <Link href="/scan" className="font-medium text-primary hover:underline">
      Try a free scan
    </Link>{" "}
    first, or{" "}
    <Link
      href="/integrations"
      className="font-medium text-primary hover:underline"
    >
      explore our integrations
    </Link>{" "}
    to see what connects with your workflow.
  </p>
</div>
```

**Step 6: Commit**

```bash
git add apps/web/src/app/pricing/page.tsx
git commit -m "feat(seo): expand pricing page with FAQ, citations, and internal links"
```

---

### Task 8: Integrations Page Content Expansion

**Issues addressed:** THIN_CONTENT, POOR_READABILITY, NO_INTERNAL_LINKS

**Files:**

- Modify: `apps/web/src/app/integrations/page.tsx`

**Step 1: Add detailed intro paragraph**

After the existing `<p>` subtitle, add:

```tsx
<p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
  LLM Rank integrations connect your AI-readiness workflow with the tools your
  team already uses. Import search analytics from Google Search Console to
  correlate traditional rankings with AI visibility scores. Track conversions
  from AI-driven traffic with Google Analytics 4. Our upcoming WordPress plugin
  will let you score content in real time as you write. Slack integration keeps
  your team informed with automated alerts when scores change or your brand gets
  cited by an AI engine.
</p>
```

**Step 2: Expand integration descriptions in the INTEGRATIONS array**

```typescript
const INTEGRATIONS = [
  {
    name: "Google Search Console",
    description:
      "Connect GSC to analyze actual search performance data alongside AI-readiness scores. Import impressions, clicks, and average position for every page. Identify which pages rank well in traditional search but score poorly for AI visibility — these are your biggest opportunities for quick improvement.",
    features: [
      "Import search analytics (impressions, clicks, CTR)",
      "Correlate traditional rankings with AI scores",
      "Identify high-opportunity keywords for AI optimization",
      "Track performance trends alongside readiness scores",
    ],
    status: "Available",
  },
  {
    name: "Google Analytics 4",
    description:
      "Link GA4 to track how AI-driven traffic converts on your site. As AI search engines begin citing URLs directly, understanding which pages receive AI referral traffic — and how those visitors behave — is critical for measuring the ROI of AI-readiness improvements.",
    features: [
      "Track AI referral traffic sources",
      "Measure engagement and bounce rates from AI visitors",
      "Conversion attribution for AI-driven sessions",
      "Compare AI vs. organic traffic quality",
    ],
    status: "Available",
  },
  {
    name: "WordPress Plugin",
    description:
      "Automatically score your content for AI-readiness directly from the WordPress editor. Get real-time feedback on structured data, content depth, readability, and citation-worthiness as you write. Manage your robots.txt and generate Schema.org markup without touching code.",
    features: [
      "Real-time content scoring in the editor",
      "One-click Schema.org markup generation",
      "Robots.txt management for AI crawlers",
      "Bulk optimization suggestions for existing posts",
    ],
    status: "Coming Soon",
  },
  {
    name: "Slack",
    description:
      "Get notified instantly when your AI visibility score changes, when you are cited by an LLM, or when a competitor gains ground. Weekly summary reports keep the whole team aligned on AI SEO priorities without needing to check the dashboard.",
    features: [
      "Real-time score change alerts",
      "Weekly AI-readiness summary reports",
      "Competitor movement notifications",
      "Team collaboration and assignment workflows",
    ],
    status: "Coming Soon",
  },
];
```

**Step 3: Add authoritative citation section after integration cards**

```tsx
<div className="mt-8 rounded-lg border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
  <p>
    Our integrations follow{" "}
    <a
      href="https://developers.google.com/search/docs"
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
    >
      Google Search Central documentation
    </a>{" "}
    for search analytics and{" "}
    <a
      href="https://developers.google.com/analytics"
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
    >
      Google Analytics best practices
    </a>{" "}
    for traffic measurement. Data is fetched securely via OAuth 2.0 and never
    stored beyond your active session.
  </p>
</div>
```

**Step 4: Commit**

```bash
git add apps/web/src/app/integrations/page.tsx
git commit -m "feat(seo): expand integrations page content with details and citations"
```

---

### Task 9: Scan Page Content Expansion

**Issues addressed:** THIN_CONTENT, POOR_READABILITY

**Files:**

- Modify: `apps/web/src/app/scan/page.tsx`

Since the scan page is `"use client"`, we need to expand content within the existing component.

**Step 1: Add "What we check" section below the feature highlights**

After the existing 3-column grid of features, add:

```tsx
<div className="mt-10 w-full max-w-2xl space-y-4 text-left">
  <h2 className="text-xl font-bold text-foreground">
    What does the AI-readiness scan check?
  </h2>
  <p className="text-sm leading-relaxed text-muted-foreground">
    The free scan evaluates your page across 37 factors in four categories. Technical SEO (25% weight) checks meta tags, structured data, canonical URLs, robots directives, internal linking, and HTTP status codes. Content Quality (30%) analyzes word count, readability, heading structure, and content depth. AI Readiness (30%) evaluates citation-worthiness, direct answers, FAQ structure, and Open Graph tags. Performance (15%) measures Lighthouse scores including page speed, accessibility, and best practices.
  </p>
  <p className="text-sm leading-relaxed text-muted-foreground">
    Each factor starts with a perfect score and applies deductions for issues found. Critical issues like missing titles or noindex directives carry the heaviest penalties. The scan produces a letter grade from A to F and a prioritized list of quick wins sorted by impact and effort. Results are based on{" "}
    <a
      href="https://developers.google.com/search/docs"
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
    >
      Google Search Central guidelines
    </a>
    ,{" "}
    <a
      href="https://schema.org/"
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
    >
      Schema.org standards
    </a>
    , and{" "}
    <a
      href="https://developer.chrome.com/docs/lighthouse"
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
    >
      Chrome Lighthouse methodology
    </a>
    .
  </p>
</div>

<div className="mt-8 w-full max-w-2xl text-center">
  <p className="text-sm text-muted-foreground">
    Want deeper analysis?{" "}
    <Link href="/pricing" className="font-medium text-primary hover:underline">
      View pricing plans
    </Link>{" "}
    for up to 2,000 pages per crawl, AI visibility tracking, and integrations.
  </p>
</div>
```

Note: You'll need to add `import Link from "next/link";` at the top of the file.

**Step 2: Commit**

```bash
git add apps/web/src/app/scan/page.tsx
git commit -m "feat(seo): expand scan page with 'what we check' content and citations"
```

---

### Task 10: Terms Page Readability Improvements

**Issue:** POOR_READABILITY (Flesch < 50)

**Files:**

- Modify: `apps/web/src/app/terms/page.tsx`

**Step 1: Read the full terms page content**

Read the entire file first to understand the current content and identify dense paragraphs.

**Step 2: Simplify language throughout**

Key readability fixes:

- Break long sentences (>25 words) into shorter ones
- Replace jargon: "notwithstanding" → "despite", "herein" → "in this document", "pursuant to" → "under"
- Use active voice: "may be terminated by us" → "we may terminate"
- Add paragraph breaks for walls of text
- Target Flesch Reading Ease 60+ (shorter sentences, common words)

**Step 3: Add internal links at the bottom**

```tsx
<p className="mt-8 text-sm text-muted-foreground">
  Questions about these terms? Contact us at{" "}
  <a
    href="mailto:support@llmrank.app"
    className="font-medium text-primary hover:underline"
  >
    support@llmrank.app
  </a>
  . You can also review our{" "}
  <Link href="/privacy" className="font-medium text-primary hover:underline">
    privacy policy
  </Link>{" "}
  or{" "}
  <Link href="/pricing" className="font-medium text-primary hover:underline">
    pricing plans
  </Link>
  .
</p>
```

**Step 4: Commit**

```bash
git add apps/web/src/app/terms/page.tsx
git commit -m "fix(seo): improve terms page readability and add internal links"
```

---

### Task 11: Privacy Page Readability Improvements

**Issue:** POOR_READABILITY (Flesch < 50)

**Files:**

- Modify: `apps/web/src/app/privacy/page.tsx`

**Step 1: Read the full privacy page and simplify language**

Same approach as Task 10:

- Break long sentences
- Use plain language
- Active voice
- Add paragraph breaks

**Step 2: Add internal links at the bottom**

```tsx
<p className="mt-8 text-sm text-muted-foreground">
  Questions about your data? Contact us at{" "}
  <a
    href="mailto:privacy@llmrank.app"
    className="font-medium text-primary hover:underline"
  >
    privacy@llmrank.app
  </a>
  . See also our{" "}
  <Link href="/terms" className="font-medium text-primary hover:underline">
    terms of service
  </Link>
  .
</p>
```

**Step 3: Commit**

```bash
git add apps/web/src/app/privacy/page.tsx
git commit -m "fix(seo): improve privacy page readability and add internal links"
```

---

### Task 12: Fix Performance Score Bug in Data Aggregator

**Issue:** Performance shows 0 in reports when Lighthouse data is null

**Root Cause:** `packages/reports/src/data-aggregator.ts:287-293` defaults null lighthouse values to 0 instead of excluding them from the average.

**Files:**

- Modify: `packages/reports/src/data-aggregator.ts:287-293`
- Modify: `packages/reports/src/data-aggregator.ts:432-434` (per-page performance)

**Step 1: Write a failing test (if test file exists)**

Check for existing tests in `packages/reports/src/__tests__/` and add a test case where lighthouse data is null:

```typescript
it("should handle null lighthouse data in performance average", () => {
  const raw = makeRawDbResults({
    pageScores: [
      { url: "/", overallScore: 89, lighthousePerf: null, lighthouseSeo: null },
    ],
  });
  const result = aggregateReportData(raw, { type: "summary" });
  // Performance should not be 0 when data is missing
  // It should either be null or match the scoring engine's output
  expect(result.scores.performance).not.toBe(0);
});
```

**Step 2: Fix the performanceAvg calculation**

Replace lines 287-293 in `data-aggregator.ts`:

```typescript
// OLD (buggy — defaults null lighthouse to 0)
const performanceAvg = average(
  pageScores.map((p) => {
    const perf = p.lighthousePerf ?? 0;
    const seo = p.lighthouseSeo ?? 0;
    return Math.round(((perf + seo) / 2) * 100);
  }),
);

// NEW — exclude pages without lighthouse data
const lighthousePages = pageScores.filter(
  (p) => p.lighthousePerf != null || p.lighthouseSeo != null,
);
const performanceAvg =
  lighthousePages.length > 0
    ? average(
        lighthousePages.map((p) => {
          const perf = p.lighthousePerf ?? 0;
          const seo = p.lighthouseSeo ?? 0;
          return Math.round(((perf + seo) / 2) * 100);
        }),
      )
    : null;
```

**Step 3: Fix per-page performance**

Update lines 432-434:

```typescript
// OLD
performance: Math.round(
  (((p.lighthousePerf ?? 0) + (p.lighthouseSeo ?? 0)) / 2) * 100,
),

// NEW
performance:
  p.lighthousePerf != null || p.lighthouseSeo != null
    ? Math.round(
        (((p.lighthousePerf ?? 0) + (p.lighthouseSeo ?? 0)) / 2) * 100,
      )
    : null,
```

**Step 4: Update the ReportData types to allow null performance**

Check `packages/reports/src/types.ts` — update the performance field to `number | null` in relevant types.

**Step 5: Update the report template to handle null performance**

In the PDF/report template, show "N/A" or "No data" when performance is null instead of 0.

**Step 6: Run tests**

```bash
cd packages/reports && pnpm test
```

**Step 7: Run typecheck**

```bash
pnpm typecheck
```

**Step 8: Commit**

```bash
git add packages/reports/
git commit -m "fix(reports): handle null lighthouse data in performance score calculation"
```

---

### Task 13: Verify All Changes Build Successfully

**Files:** None (verification only)

**Step 1: Run full build**

```bash
pnpm build
```

**Step 2: Run full test suite**

```bash
pnpm test
```

**Step 3: Run typecheck**

```bash
pnpm typecheck
```

**Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "chore: fix build issues from SEO improvements"
```

---

## Summary of Expected Score Impact

| Task      | Issue Fixed                                              | Points Recovered           |
| --------- | -------------------------------------------------------- | -------------------------- |
| 1         | MISSING_OG_TAGS (8 pages)                                | +16                        |
| 2         | MISSING_TITLE (3 pages)                                  | +24                        |
| 3         | FAQPage schema builder                                   | (enables FAQ fixes)        |
| 4-5       | Missing metadata on extra pages                          | (prevents future issues)   |
| 6         | Homepage: THIN_CONTENT, READABILITY, FAQ, DIRECT_ANSWERS | +14                        |
| 7         | Pricing: THIN_CONTENT, FAQ                               | +6                         |
| 8         | Integrations: THIN_CONTENT, INTERNAL_LINKS, CITATIONS    | +10                        |
| 9         | Scan: THIN_CONTENT, READABILITY, CITATIONS               | +8                         |
| 10-11     | Terms/Privacy: READABILITY                               | +8                         |
| 12        | Performance 0 bug                                        | Display fix                |
| **Total** |                                                          | **~86 points distributed** |
