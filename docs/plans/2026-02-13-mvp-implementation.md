# LLM Rank Full Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete LLM Rank platform — crawl websites, score pages for AI-readiness across 37 factors, track AI visibility across 5 LLM providers, full Stripe billing with 4 tiers, scheduled crawls, competitor tracking, PDF reports, agency white-labeling, marketing site, and launch-ready production deployment.

**Architecture:** Turborepo monorepo with Next.js frontend on Cloudflare Pages, Hono API on Cloudflare Workers (D1/R2/KV), Rust crawler on Hetzner VPS with Lighthouse. Clerk auth, Stripe billing, Anthropic/OpenAI for LLM scoring. PostHog analytics, Sentry error tracking.

**Tech Stack:** Next.js 15, Hono, Drizzle ORM, Cloudflare D1/R2/KV/Cron Triggers, Rust (Axum/Tokio), Lighthouse, Clerk, Stripe, shadcn/ui, Tailwind, Recharts, @react-pdf/renderer, PostHog, Sentry, pnpm, Turborepo

**Design doc:** `docs/plans/2026-02-13-mvp-design.md`
**Requirements doc:** `ai-seo-requirements.md` (all sections — Sections 7-12 for scoring/DB/API/crawler, Section 16 for analytics, Section 17-18 for phasing, Section 22 for CI/CD)

**Total Tasks:** 28 (Tasks 1-15: MVP foundation, Tasks 16-28: Full platform)

---

## Phase A: Monorepo Foundation

### Task 1: Scaffold Turborepo Monorepo

**Files:**

- Create: `package.json` (workspace root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `tsconfig.base.json`

**Step 1: Initialize pnpm workspace root**

```bash
pnpm init
```

Edit `package.json` to:

```json
{
  "name": "llm-boost",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "test": "turbo test",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7"
  },
  "packageManager": "pnpm@9.15.0"
}
```

**Step 2: Create pnpm workspace config**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Step 4: Create shared TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 5: Create .gitignore and .nvmrc**

`.gitignore`:

```
node_modules/
dist/
.next/
.turbo/
.wrangler/
.env
.env.local
*.local
target/
```

`.nvmrc`:

```
20
```

**Step 6: Install dependencies and commit**

```bash
pnpm install
git add -A
git commit -m "feat: scaffold Turborepo monorepo with pnpm workspaces"
```

---

### Task 2: Create packages/shared — Types, Schemas, Constants

**Files:**

- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/schemas/crawl.ts`
- Create: `packages/shared/src/schemas/project.ts`
- Create: `packages/shared/src/schemas/scoring.ts`
- Create: `packages/shared/src/schemas/api.ts`
- Create: `packages/shared/src/constants/issues.ts`
- Create: `packages/shared/src/constants/plans.ts`

**Step 1: Initialize package**

Create `packages/shared/package.json`:

```json
{
  "name": "@llm-boost/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^3.24"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

Create `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

```bash
cd packages/shared && pnpm install && cd ../..
```

**Step 2: Define issue codes constant**

Reference: `ai-seo-requirements.md` Sections 7.2-7.5 (all 37 scoring factors).

Create `packages/shared/src/constants/issues.ts`:

```typescript
export const IssueSeverity = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info",
} as const;

export type IssueSeverity = (typeof IssueSeverity)[keyof typeof IssueSeverity];

export const IssueCategory = {
  TECHNICAL: "technical",
  CONTENT: "content",
  AI_READINESS: "ai_readiness",
  PERFORMANCE: "performance",
} as const;

export type IssueCategory = (typeof IssueCategory)[keyof typeof IssueCategory];

export interface IssueDefinition {
  code: string;
  category: IssueCategory;
  severity: IssueSeverity;
  scoreImpact: number;
  message: string;
  recommendation: string;
}

// All 37 issue codes from requirements Section 7
export const ISSUE_DEFINITIONS: Record<string, IssueDefinition> = {
  // --- Technical SEO (13 factors) ---
  MISSING_TITLE: {
    code: "MISSING_TITLE",
    category: "technical",
    severity: "critical",
    scoreImpact: -15,
    message: "Page is missing a title tag or title is outside 30-60 characters",
    recommendation:
      "Add a unique, descriptive title tag between 30-60 characters that includes the page's primary topic.",
  },
  MISSING_META_DESC: {
    code: "MISSING_META_DESC",
    category: "technical",
    severity: "warning",
    scoreImpact: -10,
    message:
      "Page is missing a meta description or it is outside 120-160 characters",
    recommendation:
      "Add a meta description of 120-160 characters that summarizes this page's key topic.",
  },
  MISSING_H1: {
    code: "MISSING_H1",
    category: "technical",
    severity: "warning",
    scoreImpact: -8,
    message: "Page is missing an H1 heading",
    recommendation:
      "Add exactly one H1 heading that clearly describes the page's main topic.",
  },
  MULTIPLE_H1: {
    code: "MULTIPLE_H1",
    category: "technical",
    severity: "warning",
    scoreImpact: -5,
    message: "Page has multiple H1 headings",
    recommendation:
      "Reduce to a single H1 heading. Convert additional H1s to H2 or lower.",
  },
  HEADING_HIERARCHY: {
    code: "HEADING_HIERARCHY",
    category: "technical",
    severity: "info",
    scoreImpact: -3,
    message: "Heading hierarchy has skipped levels (e.g., H1 to H3 without H2)",
    recommendation:
      "Ensure headings follow a logical hierarchy: H1 > H2 > H3 without skipping levels.",
  },
  BROKEN_LINKS: {
    code: "BROKEN_LINKS",
    category: "technical",
    severity: "warning",
    scoreImpact: -5, // per broken link, max -20
    message: "Page contains broken internal links",
    recommendation:
      "Fix or remove broken internal links to improve crawlability.",
  },
  MISSING_CANONICAL: {
    code: "MISSING_CANONICAL",
    category: "technical",
    severity: "warning",
    scoreImpact: -8,
    message: "Page is missing a canonical URL tag",
    recommendation:
      "Add a canonical tag pointing to the preferred URL for this page.",
  },
  NOINDEX_SET: {
    code: "NOINDEX_SET",
    category: "technical",
    severity: "critical",
    scoreImpact: -20,
    message: "Page has a noindex robots directive",
    recommendation:
      "Remove the noindex directive if this page should be discoverable by AI search engines.",
  },
  MISSING_ALT_TEXT: {
    code: "MISSING_ALT_TEXT",
    category: "technical",
    severity: "warning",
    scoreImpact: -3, // per image, max -15
    message: "Images are missing alt text attributes",
    recommendation:
      "Add descriptive alt text to all images to improve accessibility and AI understanding.",
  },
  HTTP_STATUS: {
    code: "HTTP_STATUS",
    category: "technical",
    severity: "critical",
    scoreImpact: -25,
    message: "Page returned a 4xx or 5xx HTTP status code",
    recommendation:
      "Fix the server error or redirect. Pages must return 200 status to be indexed.",
  },
  MISSING_OG_TAGS: {
    code: "MISSING_OG_TAGS",
    category: "technical",
    severity: "info",
    scoreImpact: -5,
    message:
      "Page is missing Open Graph tags (og:title, og:description, og:image)",
    recommendation:
      "Add og:title, og:description, and og:image meta tags for better social and AI sharing.",
  },
  SLOW_RESPONSE: {
    code: "SLOW_RESPONSE",
    category: "technical",
    severity: "warning",
    scoreImpact: -10,
    message: "Server response time exceeds 2 seconds",
    recommendation:
      "Optimize server response time to under 2 seconds. Check hosting, caching, and database queries.",
  },
  MISSING_SITEMAP: {
    code: "MISSING_SITEMAP",
    category: "technical",
    severity: "info",
    scoreImpact: -5,
    message: "No valid sitemap.xml found",
    recommendation:
      "Create and submit a sitemap.xml to help crawlers discover all pages.",
  },

  // --- Content Quality (9 factors) ---
  THIN_CONTENT: {
    code: "THIN_CONTENT",
    category: "content",
    severity: "warning",
    scoreImpact: -15, // -15 if < 200 words, -8 if 200-499
    message: "Page has insufficient content",
    recommendation:
      "Expand content to at least 500 words of substantive, topic-relevant text.",
  },
  CONTENT_DEPTH: {
    code: "CONTENT_DEPTH",
    category: "content",
    severity: "warning",
    scoreImpact: 0, // Mapped from LLM score 0-100 to 0-20 range
    message: "Content lacks depth and comprehensive topic coverage",
    recommendation:
      "Expand coverage of subtopics, add supporting data, examples, and expert analysis.",
  },
  CONTENT_CLARITY: {
    code: "CONTENT_CLARITY",
    category: "content",
    severity: "warning",
    scoreImpact: 0,
    message: "Content readability and structure need improvement",
    recommendation:
      "Improve clarity with shorter paragraphs, subheadings, bullet points, and plain language.",
  },
  CONTENT_AUTHORITY: {
    code: "CONTENT_AUTHORITY",
    category: "content",
    severity: "warning",
    scoreImpact: 0,
    message:
      "Content lacks authority signals (citations, data, expert language)",
    recommendation:
      "Add citations, statistics, expert quotes, and authoritative sources to build credibility.",
  },
  DUPLICATE_CONTENT: {
    code: "DUPLICATE_CONTENT",
    category: "content",
    severity: "warning",
    scoreImpact: -15,
    message: "Page content is a duplicate of another page in this project",
    recommendation:
      "Consolidate duplicate pages using canonical tags or merge the content.",
  },
  STALE_CONTENT: {
    code: "STALE_CONTENT",
    category: "content",
    severity: "info",
    scoreImpact: -5,
    message: "Content appears to be over 12 months old without updates",
    recommendation:
      "Update content with current information, statistics, and recent developments.",
  },
  NO_INTERNAL_LINKS: {
    code: "NO_INTERNAL_LINKS",
    category: "content",
    severity: "warning",
    scoreImpact: -8,
    message: "Page has fewer than 2 internal links to relevant content",
    recommendation:
      "Add at least 2-3 internal links to related pages to improve discoverability.",
  },
  EXCESSIVE_LINKS: {
    code: "EXCESSIVE_LINKS",
    category: "content",
    severity: "info",
    scoreImpact: -3,
    message: "External links exceed internal links by more than 3:1 ratio",
    recommendation:
      "Balance your link profile by adding more internal links relative to external ones.",
  },
  MISSING_FAQ_STRUCTURE: {
    code: "MISSING_FAQ_STRUCTURE",
    category: "content",
    severity: "info",
    scoreImpact: -5,
    message: "Content addressing questions does not use Q&A format",
    recommendation:
      "Structure common questions using FAQ format with clear question headings and concise answers.",
  },

  // --- AI Readiness (10 factors) ---
  MISSING_LLMS_TXT: {
    code: "MISSING_LLMS_TXT",
    category: "ai_readiness",
    severity: "critical",
    scoreImpact: -20,
    message: "No llms.txt file found at /llms.txt",
    recommendation:
      "Create an llms.txt file at /llms.txt to explicitly permit AI crawlers and provide structured metadata about your site.",
  },
  AI_CRAWLER_BLOCKED: {
    code: "AI_CRAWLER_BLOCKED",
    category: "ai_readiness",
    severity: "critical",
    scoreImpact: -25,
    message:
      "robots.txt blocks one or more AI crawlers (GPTBot, ClaudeBot, PerplexityBot)",
    recommendation:
      "Remove Disallow rules for AI user agents (GPTBot, ClaudeBot, PerplexityBot) in robots.txt.",
  },
  NO_STRUCTURED_DATA: {
    code: "NO_STRUCTURED_DATA",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -15,
    message: "Page has no JSON-LD structured data",
    recommendation:
      "Add JSON-LD structured data (at minimum: Organization, WebPage, and Article/FAQPage as appropriate).",
  },
  INCOMPLETE_SCHEMA: {
    code: "INCOMPLETE_SCHEMA",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -8,
    message: "Structured data is present but missing required properties",
    recommendation:
      "Complete all required properties in your JSON-LD schema markup.",
  },
  CITATION_WORTHINESS: {
    code: "CITATION_WORTHINESS",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: 0, // Mapped from LLM score
    message: "Content has low citation worthiness for AI assistants",
    recommendation:
      "Add unique data, original research, clear definitions, and expert analysis that AI would want to cite.",
  },
  NO_DIRECT_ANSWERS: {
    code: "NO_DIRECT_ANSWERS",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -10,
    message:
      "Content does not contain direct, concise answers to likely queries",
    recommendation:
      "Add clear, concise answer paragraphs at the top of sections that directly address likely user questions.",
  },
  MISSING_ENTITY_MARKUP: {
    code: "MISSING_ENTITY_MARKUP",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: -5,
    message: "Key named entities are not marked up in schema",
    recommendation:
      "Add schema markup for key entities (people, organizations, products) mentioned in your content.",
  },
  NO_SUMMARY_SECTION: {
    code: "NO_SUMMARY_SECTION",
    category: "ai_readiness",
    severity: "info",
    scoreImpact: -5,
    message: "Page lacks a summary or key takeaway section",
    recommendation:
      "Add a TL;DR or key takeaways section that summarizes the page's main points.",
  },
  POOR_QUESTION_COVERAGE: {
    code: "POOR_QUESTION_COVERAGE",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -10,
    message:
      "Content does not adequately address likely search queries for this topic",
    recommendation:
      "Research common questions about this topic and ensure your content addresses them directly.",
  },
  INVALID_SCHEMA: {
    code: "INVALID_SCHEMA",
    category: "ai_readiness",
    severity: "warning",
    scoreImpact: -8,
    message: "JSON-LD structured data contains parse errors",
    recommendation:
      "Fix JSON-LD syntax errors. Validate at schema.org or Google Rich Results Test.",
  },

  // --- Performance (5 factors) ---
  LH_PERF_LOW: {
    code: "LH_PERF_LOW",
    category: "performance",
    severity: "warning",
    scoreImpact: -20, // -20 if < 0.5, -10 if 0.5-0.79
    message: "Lighthouse Performance score is below threshold",
    recommendation:
      "Improve page performance: optimize images, reduce JavaScript, enable caching, minimize render-blocking resources.",
  },
  LH_SEO_LOW: {
    code: "LH_SEO_LOW",
    category: "performance",
    severity: "warning",
    scoreImpact: -15,
    message: "Lighthouse SEO score is below 0.8",
    recommendation:
      "Address Lighthouse SEO audit failures: ensure crawlable links, valid hreflang, proper meta tags.",
  },
  LH_A11Y_LOW: {
    code: "LH_A11Y_LOW",
    category: "performance",
    severity: "info",
    scoreImpact: -5,
    message: "Lighthouse Accessibility score is below 0.7",
    recommendation:
      "Improve accessibility: add alt text, ensure color contrast, use semantic HTML, add ARIA labels.",
  },
  LH_BP_LOW: {
    code: "LH_BP_LOW",
    category: "performance",
    severity: "info",
    scoreImpact: -5,
    message: "Lighthouse Best Practices score is below 0.8",
    recommendation:
      "Address Lighthouse best practice issues: use HTTPS, avoid deprecated APIs, fix console errors.",
  },
  LARGE_PAGE_SIZE: {
    code: "LARGE_PAGE_SIZE",
    category: "performance",
    severity: "warning",
    scoreImpact: -10,
    message: "Total page size exceeds 3MB",
    recommendation:
      "Reduce page weight below 3MB: compress images, minify CSS/JS, lazy-load below-the-fold content.",
  },
} as const;

export type IssueCode = keyof typeof ISSUE_DEFINITIONS;
```

**Step 3: Define plan tier limits**

Create `packages/shared/src/constants/plans.ts`:

```typescript
export const PlanTier = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
  AGENCY: "agency",
} as const;

export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier];

export interface PlanLimits {
  pagesPerCrawl: number;
  maxCrawlDepth: number;
  crawlsPerMonth: number;
  projects: number;
  lighthousePages: number | "all";
  llmScoringTier: "basic" | "full" | "full_custom";
  visibilityChecks: number;
  historyDays: number;
  apiAccess: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    pagesPerCrawl: 10,
    maxCrawlDepth: 2,
    crawlsPerMonth: 2,
    projects: 1,
    lighthousePages: 5,
    llmScoringTier: "basic",
    visibilityChecks: 3,
    historyDays: 30,
    apiAccess: false,
  },
  starter: {
    pagesPerCrawl: 100,
    maxCrawlDepth: 3,
    crawlsPerMonth: 10,
    projects: 5,
    lighthousePages: "all",
    llmScoringTier: "full",
    visibilityChecks: 25,
    historyDays: 90,
    apiAccess: false,
  },
  pro: {
    pagesPerCrawl: 500,
    maxCrawlDepth: 5,
    crawlsPerMonth: 30,
    projects: 20,
    lighthousePages: "all",
    llmScoringTier: "full",
    visibilityChecks: 100,
    historyDays: 365,
    apiAccess: true,
  },
  agency: {
    pagesPerCrawl: 2000,
    maxCrawlDepth: 10,
    crawlsPerMonth: Infinity,
    projects: 50,
    lighthousePages: "all",
    llmScoringTier: "full_custom",
    visibilityChecks: 500,
    historyDays: 730,
    apiAccess: true,
  },
};
```

**Step 4: Define Zod schemas for API payloads**

Create `packages/shared/src/schemas/project.ts`:

```typescript
import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z
    .string()
    .min(1)
    .transform((d) => {
      if (!d.startsWith("http://") && !d.startsWith("https://")) {
        return `https://${d}`;
      }
      return d;
    })
    .pipe(z.string().url()),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z
    .object({
      maxPages: z.number().int().min(1).optional(),
      maxDepth: z.number().int().min(1).max(10).optional(),
      schedule: z.enum(["manual", "daily", "weekly", "monthly"]).optional(),
    })
    .optional(),
});

export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type UpdateProject = z.infer<typeof UpdateProjectSchema>;
```

Create `packages/shared/src/schemas/crawl.ts`:

```typescript
import { z } from "zod";

// Cloudflare -> Hetzner: Job submission payload
export const CrawlJobPayloadSchema = z.object({
  job_id: z.string(),
  callback_url: z.string().url(),
  config: z.object({
    seed_urls: z.array(z.string().url()),
    max_pages: z.number().int().min(1).max(2000),
    max_depth: z.number().int().min(1).max(10),
    respect_robots: z.boolean().default(true),
    run_lighthouse: z.boolean().default(true),
    extract_schema: z.boolean().default(true),
    extract_links: z.boolean().default(true),
    check_llms_txt: z.boolean().default(true),
    user_agent: z.string().default("AISEOBot/1.0"),
    rate_limit_ms: z.number().int().default(1000),
    timeout_s: z.number().int().default(30),
  }),
});

// Extracted data from a single page
export const ExtractedDataSchema = z.object({
  h1: z.array(z.string()),
  h2: z.array(z.string()),
  h3: z.array(z.string()),
  h4: z.array(z.string()),
  h5: z.array(z.string()),
  h6: z.array(z.string()),
  schema_types: z.array(z.string()),
  internal_links: z.array(z.string()),
  external_links: z.array(z.string()),
  images_without_alt: z.number().int(),
  has_robots_meta: z.boolean(),
  robots_directives: z.array(z.string()),
  og_tags: z.record(z.string()).optional(),
  structured_data: z.array(z.unknown()).optional(),
});

// Lighthouse results for a page
export const LighthouseResultSchema = z.object({
  performance: z.number().min(0).max(1),
  seo: z.number().min(0).max(1),
  accessibility: z.number().min(0).max(1),
  best_practices: z.number().min(0).max(1),
  lh_r2_key: z.string().optional(),
});

// Single page result from crawler
export const CrawlPageResultSchema = z.object({
  url: z.string().url(),
  status_code: z.number().int(),
  title: z.string().nullable(),
  meta_description: z.string().nullable(),
  canonical_url: z.string().nullable(),
  word_count: z.number().int(),
  content_hash: z.string(),
  html_r2_key: z.string(),
  extracted: ExtractedDataSchema,
  lighthouse: LighthouseResultSchema.nullable(),
  timing_ms: z.number(),
});

// Hetzner -> Cloudflare: Batch result callback
export const CrawlResultBatchSchema = z.object({
  job_id: z.string(),
  batch_index: z.number().int(),
  is_final: z.boolean(),
  pages: z.array(CrawlPageResultSchema),
  stats: z.object({
    pages_found: z.number().int(),
    pages_crawled: z.number().int(),
    pages_errored: z.number().int(),
    elapsed_s: z.number(),
  }),
});

export type CrawlJobPayload = z.infer<typeof CrawlJobPayloadSchema>;
export type ExtractedData = z.infer<typeof ExtractedDataSchema>;
export type LighthouseResult = z.infer<typeof LighthouseResultSchema>;
export type CrawlPageResult = z.infer<typeof CrawlPageResultSchema>;
export type CrawlResultBatch = z.infer<typeof CrawlResultBatchSchema>;
```

Create `packages/shared/src/schemas/scoring.ts`:

```typescript
import { z } from "zod";

export const LetterGrade = z.enum(["A", "B", "C", "D", "F"]);
export type LetterGrade = z.infer<typeof LetterGrade>;

export const PageScoreSchema = z.object({
  overall_score: z.number().min(0).max(100),
  technical_score: z.number().min(0).max(100),
  content_score: z.number().min(0).max(100),
  ai_readiness_score: z.number().min(0).max(100),
  performance_score: z.number().min(0).max(100),
  letter_grade: LetterGrade,
});

export const IssueSchema = z.object({
  code: z.string(),
  category: z.enum(["technical", "content", "ai_readiness", "performance"]),
  severity: z.enum(["critical", "warning", "info"]),
  message: z.string(),
  recommendation: z.string(),
  data: z.record(z.unknown()).optional(),
});

export const LLMContentScoresSchema = z.object({
  clarity: z.number().min(0).max(100),
  authority: z.number().min(0).max(100),
  comprehensiveness: z.number().min(0).max(100),
  structure: z.number().min(0).max(100),
  citation_worthiness: z.number().min(0).max(100),
});

export type PageScore = z.infer<typeof PageScoreSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type LLMContentScores = z.infer<typeof LLMContentScoresSchema>;
```

Create `packages/shared/src/schemas/api.ts`:

```typescript
import { z } from "zod";

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;

// Error codes from requirements Section 11.6
export const ERROR_CODES = {
  UNAUTHORIZED: { status: 401, message: "Missing or invalid auth token" },
  FORBIDDEN: { status: 403, message: "Insufficient permissions" },
  NOT_FOUND: { status: 404, message: "Resource does not exist" },
  PLAN_LIMIT_REACHED: { status: 403, message: "Feature requires higher plan" },
  CRAWL_LIMIT_REACHED: {
    status: 429,
    message: "Monthly crawl credits exhausted",
  },
  CRAWL_IN_PROGRESS: {
    status: 409,
    message: "Another crawl is already running",
  },
  INVALID_DOMAIN: {
    status: 422,
    message: "Domain URL is unreachable or invalid",
  },
  HMAC_INVALID: { status: 401, message: "HMAC signature verification failed" },
  RATE_LIMITED: { status: 429, message: "Too many requests" },
} as const;
```

**Step 5: Create barrel export**

Create `packages/shared/src/index.ts`:

```typescript
export * from "./schemas/crawl";
export * from "./schemas/project";
export * from "./schemas/scoring";
export * from "./schemas/api";
export * from "./constants/issues";
export * from "./constants/plans";
```

**Step 6: Write tests for Zod schemas**

Create `packages/shared/src/__tests__/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  CreateProjectSchema,
  CrawlJobPayloadSchema,
  CrawlResultBatchSchema,
  PageScoreSchema,
} from "../index";

describe("CreateProjectSchema", () => {
  it("accepts valid project with domain auto-prefix", () => {
    const result = CreateProjectSchema.parse({
      name: "My Site",
      domain: "example.com",
    });
    expect(result.domain).toBe("https://example.com");
  });

  it("accepts domain with https", () => {
    const result = CreateProjectSchema.parse({
      name: "My Site",
      domain: "https://example.com",
    });
    expect(result.domain).toBe("https://example.com");
  });

  it("rejects empty name", () => {
    expect(() =>
      CreateProjectSchema.parse({ name: "", domain: "example.com" }),
    ).toThrow();
  });
});

describe("PageScoreSchema", () => {
  it("accepts valid score", () => {
    const result = PageScoreSchema.parse({
      overall_score: 85,
      technical_score: 90,
      content_score: 80,
      ai_readiness_score: 85,
      performance_score: 75,
      letter_grade: "B",
    });
    expect(result.letter_grade).toBe("B");
  });

  it("rejects score > 100", () => {
    expect(() =>
      PageScoreSchema.parse({
        overall_score: 101,
        technical_score: 90,
        content_score: 80,
        ai_readiness_score: 85,
        performance_score: 75,
        letter_grade: "A",
      }),
    ).toThrow();
  });
});
```

**Step 7: Run tests and commit**

```bash
pnpm --filter @llm-boost/shared test
git add packages/shared/
git commit -m "feat: add shared package with Zod schemas, issue codes, and plan limits"
```

---

### Task 3: Create packages/db — Drizzle Schema & Migrations

**Files:**

- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/queries/users.ts`
- Create: `packages/db/src/queries/projects.ts`
- Create: `packages/db/src/queries/crawls.ts`
- Create: `packages/db/src/queries/pages.ts`
- Create: `packages/db/src/queries/scores.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/migrations/0001_initial.sql`
- Create: `packages/db/drizzle.config.ts`

**Step 1: Initialize package**

Create `packages/db/package.json`:

```json
{
  "name": "@llm-boost/db",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "generate": "drizzle-kit generate",
    "migrate:local": "wrangler d1 migrations apply ai-seo-db --local",
    "migrate:remote": "wrangler d1 migrations apply ai-seo-db --remote"
  },
  "dependencies": {
    "drizzle-orm": "^0.38",
    "@llm-boost/shared": "workspace:*"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30",
    "typescript": "^5.7"
  }
}
```

**Step 2: Define Drizzle schema**

Reference: `ai-seo-requirements.md` Section 10 (Database Schema).

Create `packages/db/src/schema.ts`:

```typescript
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID().replace(/-/g, ""));

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`);

const updatedAt = () =>
  text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`);

// --- Users ---
export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  plan: text("plan", { enum: ["free", "starter", "pro", "agency"] })
    .notNull()
    .default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubId: text("stripe_sub_id"),
  crawlCreditsRemaining: integer("crawl_credits_remaining")
    .notNull()
    .default(100),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// --- Projects ---
export const projects = sqliteTable(
  "projects",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    settings: text("settings", { mode: "json" }).default("{}"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_projects_user").on(t.userId)],
);

// --- Crawl Jobs ---
export const crawlJobs = sqliteTable(
  "crawl_jobs",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: [
        "pending",
        "queued",
        "crawling",
        "scoring",
        "complete",
        "failed",
        "cancelled",
      ],
    })
      .notNull()
      .default("pending"),
    config: text("config", { mode: "json" }).notNull(),
    pagesFound: integer("pages_found").default(0),
    pagesCrawled: integer("pages_crawled").default(0),
    pagesScored: integer("pages_scored").default(0),
    errorMessage: text("error_message"),
    r2Prefix: text("r2_prefix"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_jobs_project").on(t.projectId),
    index("idx_jobs_status").on(t.status),
  ],
);

// --- Pages ---
export const pages = sqliteTable(
  "pages",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url"),
    statusCode: integer("status_code"),
    title: text("title"),
    metaDesc: text("meta_desc"),
    contentHash: text("content_hash"),
    wordCount: integer("word_count"),
    r2RawKey: text("r2_raw_key"),
    r2LhKey: text("r2_lh_key"),
    crawledAt: text("crawled_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_pages_job").on(t.jobId),
    index("idx_pages_url").on(t.projectId, t.url),
  ],
);

// --- Page Scores ---
export const pageScores = sqliteTable("page_scores", {
  id: id(),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  jobId: text("job_id")
    .notNull()
    .references(() => crawlJobs.id, { onDelete: "cascade" }),
  overallScore: real("overall_score").notNull(),
  technicalScore: real("technical_score"),
  contentScore: real("content_score"),
  aiReadinessScore: real("ai_readiness_score"),
  lighthousePerf: real("lighthouse_perf"),
  lighthouseSeo: real("lighthouse_seo"),
  detail: text("detail", { mode: "json" }),
  createdAt: createdAt(),
});

// --- Issues ---
export const issues = sqliteTable(
  "issues",
  {
    id: id(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: [
        "technical",
        "content",
        "ai_readiness",
        "performance",
        "schema",
        "llm_visibility",
      ],
    }).notNull(),
    severity: text("severity", {
      enum: ["critical", "warning", "info"],
    }).notNull(),
    code: text("code").notNull(),
    message: text("message").notNull(),
    recommendation: text("recommendation"),
    data: text("data", { mode: "json" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_issues_page").on(t.pageId),
    index("idx_issues_severity").on(t.jobId, t.severity),
  ],
);

// --- Visibility Checks ---
export const visibilityChecks = sqliteTable(
  "visibility_checks",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    llmProvider: text("llm_provider", {
      enum: ["chatgpt", "claude", "perplexity", "gemini", "copilot"],
    }).notNull(),
    query: text("query").notNull(),
    responseText: text("response_text"),
    brandMentioned: integer("brand_mentioned", { mode: "boolean" }).default(
      false,
    ),
    urlCited: integer("url_cited", { mode: "boolean" }).default(false),
    citationPosition: integer("citation_position"),
    competitorMentions: text("competitor_mentions", { mode: "json" }),
    r2ResponseKey: text("r2_response_key"),
    checkedAt: text("checked_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("idx_vis_project").on(t.projectId, t.checkedAt)],
);
```

**Step 3: Create SQL migration**

Create `packages/db/migrations/0001_initial.sql` matching the raw SQL from requirements Section 10. Generate this from the Drizzle schema:

```bash
pnpm --filter @llm-boost/db generate
```

Or write manually based on Section 10 of `ai-seo-requirements.md`.

**Step 4: Create client factory**

Create `packages/db/src/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

**Step 5: Create query helpers**

Create `packages/db/src/queries/users.ts`:

```typescript
import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { users } from "../schema";

export function userQueries(db: Database) {
  return {
    async getById(id: string) {
      return db.query.users.findFirst({ where: eq(users.id, id) });
    },
    async getByEmail(email: string) {
      return db.query.users.findFirst({ where: eq(users.email, email) });
    },
    async create(data: { email: string; name?: string; avatarUrl?: string }) {
      const [user] = await db.insert(users).values(data).returning();
      return user;
    },
    async updatePlan(id: string, plan: string, stripeSubId?: string) {
      await db
        .update(users)
        .set({ plan, stripeSubId, updatedAt: new Date().toISOString() })
        .where(eq(users.id, id));
    },
    async decrementCrawlCredits(id: string) {
      const user = await db.query.users.findFirst({ where: eq(users.id, id) });
      if (!user || user.crawlCreditsRemaining <= 0) return false;
      await db
        .update(users)
        .set({ crawlCreditsRemaining: user.crawlCreditsRemaining - 1 })
        .where(eq(users.id, id));
      return true;
    },
  };
}
```

Create similarly for `projects.ts`, `crawls.ts`, `pages.ts`, `scores.ts` — each exporting a factory function that takes `Database` and returns typed query methods. Follow the same pattern. Key queries:

- `projects`: `listByUser`, `getById`, `create`, `update`, `delete`
- `crawls`: `create`, `updateStatus`, `getById`, `getLatestByProject`, `listByProject`
- `pages`: `createBatch`, `getById`, `listByJob`
- `scores`: `create`, `getByPage`, `listByJob`, `getSiteAggregates`

**Step 6: Create barrel export and commit**

Create `packages/db/src/index.ts`:

```typescript
export * from "./schema";
export { createDb, type Database } from "./client";
export { userQueries } from "./queries/users";
export { projectQueries } from "./queries/projects";
export { crawlQueries } from "./queries/crawls";
export { pageQueries } from "./queries/pages";
export { scoreQueries } from "./queries/scores";
```

```bash
pnpm install
git add packages/db/
git commit -m "feat: add database package with Drizzle schema, migrations, and query helpers"
```

---

## Phase B: Scoring Engine & LLM

### Task 4: Create packages/scoring — 37-Factor Scoring Engine

**Files:**

- Create: `packages/scoring/package.json`
- Create: `packages/scoring/tsconfig.json`
- Create: `packages/scoring/src/index.ts`
- Create: `packages/scoring/src/types.ts`
- Create: `packages/scoring/src/factors/technical.ts`
- Create: `packages/scoring/src/factors/content.ts`
- Create: `packages/scoring/src/factors/ai-readiness.ts`
- Create: `packages/scoring/src/factors/performance.ts`
- Create: `packages/scoring/src/engine.ts`
- Test: `packages/scoring/src/__tests__/technical.test.ts`
- Test: `packages/scoring/src/__tests__/content.test.ts`
- Test: `packages/scoring/src/__tests__/ai-readiness.test.ts`
- Test: `packages/scoring/src/__tests__/performance.test.ts`
- Test: `packages/scoring/src/__tests__/engine.test.ts`

This is TDD-heavy. Target: 90%+ coverage, 50+ test cases.

**Step 1: Initialize package**

```json
{
  "name": "@llm-boost/scoring",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llm-boost/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3",
    "@vitest/coverage-v8": "^3"
  }
}
```

**Step 2: Define scoring input types**

Create `packages/scoring/src/types.ts`:

```typescript
import type {
  ExtractedData,
  LighthouseResult,
  LLMContentScores,
  Issue,
} from "@llm-boost/shared";

export interface PageData {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  wordCount: number;
  contentHash: string;
  extracted: ExtractedData;
  lighthouse: LighthouseResult | null;
  llmScores: LLMContentScores | null;
  // Site-level data passed in for cross-page checks
  siteContext?: {
    hasLlmsTxt: boolean;
    aiCrawlersBlocked: string[];
    hasSitemap: boolean;
    contentHashes: Map<string, string>; // hash -> other page URL (for duplicate detection)
    responseTimeMs?: number;
    pageSizeBytes?: number;
  };
}

export interface ScoringResult {
  overallScore: number;
  technicalScore: number;
  contentScore: number;
  aiReadinessScore: number;
  performanceScore: number;
  letterGrade: "A" | "B" | "C" | "D" | "F";
  issues: Issue[];
}
```

**Step 3: Write failing tests for technical factors**

Create `packages/scoring/src/__tests__/technical.test.ts` with tests for each of the 13 technical factors. Example pattern:

```typescript
import { describe, it, expect } from "vitest";
import { scoreTechnicalFactors } from "../factors/technical";
import type { PageData } from "../types";

function makePageData(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/test",
    statusCode: 200,
    title: "Test Page Title - Example",
    metaDescription:
      "A valid meta description that is between 120 and 160 characters long for testing purposes and validation of the scoring engine",
    canonicalUrl: "https://example.com/test",
    wordCount: 800,
    contentHash: "abc123",
    extracted: {
      h1: ["Main Heading"],
      h2: ["Section 1", "Section 2"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: ["WebPage"],
      internal_links: ["/about", "/contact", "/blog"],
      external_links: ["https://external.com"],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {
        "og:title": "Test",
        "og:description": "Desc",
        "og:image": "/img.png",
      },
      structured_data: [{ "@type": "WebPage" }],
    },
    lighthouse: {
      performance: 0.9,
      seo: 0.95,
      accessibility: 0.88,
      best_practices: 0.92,
    },
    llmScores: null,
    siteContext: {
      hasLlmsTxt: true,
      aiCrawlersBlocked: [],
      hasSitemap: true,
      contentHashes: new Map(),
    },
    ...overrides,
  };
}

describe("Technical SEO Factors", () => {
  it("passes all checks for a well-optimized page", () => {
    const result = scoreTechnicalFactors(makePageData());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("MISSING_TITLE: deducts 15 for missing title", () => {
    const result = scoreTechnicalFactors(makePageData({ title: null }));
    expect(result.score).toBe(85);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_TITLE", severity: "critical" }),
    );
  });

  it("MISSING_TITLE: deducts 15 for title outside 30-60 chars", () => {
    const result = scoreTechnicalFactors(makePageData({ title: "Short" }));
    expect(result.score).toBe(85);
  });

  it("MISSING_META_DESC: deducts 10 for missing meta description", () => {
    const result = scoreTechnicalFactors(
      makePageData({ metaDescription: null }),
    );
    expect(result.score).toBe(90);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_META_DESC" }),
    );
  });

  it("MISSING_H1: deducts 8 for no H1", () => {
    const page = makePageData();
    page.extracted.h1 = [];
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(92);
  });

  it("MULTIPLE_H1: deducts 5 for multiple H1s", () => {
    const page = makePageData();
    page.extracted.h1 = ["Heading 1", "Heading 2"];
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(95);
  });

  it("HTTP_STATUS: deducts 25 for 404", () => {
    const result = scoreTechnicalFactors(makePageData({ statusCode: 404 }));
    expect(result.score).toBe(75);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "HTTP_STATUS", severity: "critical" }),
    );
  });

  it("NOINDEX_SET: deducts 20 for noindex", () => {
    const page = makePageData();
    page.extracted.has_robots_meta = true;
    page.extracted.robots_directives = ["noindex"];
    const result = scoreTechnicalFactors(page);
    expect(result.score).toBe(80);
  });

  it("MISSING_ALT_TEXT: deducts 3 per image without alt, max 15", () => {
    const page = makePageData();
    page.extracted.images_without_alt = 6;
    const result = scoreTechnicalFactors(page);
    // 6 * -3 = -18, capped at -15
    expect(result.score).toBe(85);
  });

  // Continue for: HEADING_HIERARCHY, BROKEN_LINKS, MISSING_CANONICAL,
  // MISSING_OG_TAGS, SLOW_RESPONSE, MISSING_SITEMAP
});
```

**Step 4: Run tests to verify they fail**

```bash
pnpm --filter @llm-boost/scoring test
```

Expected: FAIL — `scoreTechnicalFactors` does not exist yet.

**Step 5: Implement technical factors**

Create `packages/scoring/src/factors/technical.ts`:

```typescript
import { ISSUE_DEFINITIONS, type Issue } from "@llm-boost/shared";
import type { PageData } from "../types";

interface FactorResult {
  score: number;
  issues: Issue[];
}

export function scoreTechnicalFactors(page: PageData): FactorResult {
  let score = 100;
  const issues: Issue[] = [];

  function deduct(
    code: string,
    amount: number,
    data?: Record<string, unknown>,
  ) {
    const def = ISSUE_DEFINITIONS[code];
    if (!def) return;
    score = Math.max(0, score + amount); // amount is negative
    issues.push({
      code: def.code,
      category: def.category,
      severity: def.severity,
      message: def.message,
      recommendation: def.recommendation,
      data,
    });
  }

  // MISSING_TITLE
  if (!page.title || page.title.length < 30 || page.title.length > 60) {
    deduct("MISSING_TITLE", -15, { titleLength: page.title?.length ?? 0 });
  }

  // MISSING_META_DESC
  if (
    !page.metaDescription ||
    page.metaDescription.length < 120 ||
    page.metaDescription.length > 160
  ) {
    deduct("MISSING_META_DESC", -10, {
      descLength: page.metaDescription?.length ?? 0,
    });
  }

  // MISSING_H1
  if (page.extracted.h1.length === 0) {
    deduct("MISSING_H1", -8);
  }

  // MULTIPLE_H1
  if (page.extracted.h1.length > 1) {
    deduct("MULTIPLE_H1", -5, { h1Count: page.extracted.h1.length });
  }

  // HEADING_HIERARCHY - check for skipped levels
  const headingLevels: number[] = [];
  if (page.extracted.h1.length > 0) headingLevels.push(1);
  if (page.extracted.h2.length > 0) headingLevels.push(2);
  if (page.extracted.h3.length > 0) headingLevels.push(3);
  if (page.extracted.h4.length > 0) headingLevels.push(4);
  if (page.extracted.h5.length > 0) headingLevels.push(5);
  if (page.extracted.h6.length > 0) headingLevels.push(6);
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      deduct("HEADING_HIERARCHY", -3, {
        skippedFrom: `H${headingLevels[i - 1]}`,
        skippedTo: `H${headingLevels[i]}`,
      });
      break;
    }
  }

  // HTTP_STATUS
  if (page.statusCode >= 400) {
    deduct("HTTP_STATUS", -25, { statusCode: page.statusCode });
  }

  // NOINDEX_SET
  if (
    page.extracted.has_robots_meta &&
    page.extracted.robots_directives.includes("noindex")
  ) {
    deduct("NOINDEX_SET", -20);
  }

  // MISSING_CANONICAL
  if (!page.canonicalUrl) {
    deduct("MISSING_CANONICAL", -8);
  }

  // MISSING_ALT_TEXT
  if (page.extracted.images_without_alt > 0) {
    const penalty = Math.min(page.extracted.images_without_alt * 3, 15);
    deduct("MISSING_ALT_TEXT", -penalty, {
      imagesWithoutAlt: page.extracted.images_without_alt,
    });
  }

  // MISSING_OG_TAGS
  const ogTags = page.extracted.og_tags ?? {};
  if (!ogTags["og:title"] || !ogTags["og:description"] || !ogTags["og:image"]) {
    deduct("MISSING_OG_TAGS", -5);
  }

  // SLOW_RESPONSE
  if (
    page.siteContext?.responseTimeMs &&
    page.siteContext.responseTimeMs > 2000
  ) {
    deduct("SLOW_RESPONSE", -10, {
      responseTimeMs: page.siteContext.responseTimeMs,
    });
  }

  // MISSING_SITEMAP
  if (page.siteContext && !page.siteContext.hasSitemap) {
    deduct("MISSING_SITEMAP", -5);
  }

  return { score: Math.max(0, score), issues };
}
```

**Step 6: Run tests to verify they pass**

```bash
pnpm --filter @llm-boost/scoring test
```

Expected: All technical factor tests PASS.

**Step 7: Repeat TDD cycle for content, AI readiness, and performance factors**

Follow the same pattern for:

- `packages/scoring/src/factors/content.ts` — 9 factors (THIN_CONTENT, CONTENT_DEPTH, etc.)
- `packages/scoring/src/factors/ai-readiness.ts` — 10 factors (MISSING_LLMS_TXT, AI_CRAWLER_BLOCKED, etc.)
- `packages/scoring/src/factors/performance.ts` — 5 factors (LH_PERF_LOW, etc.)

With corresponding test files. Write the test first, run to verify failure, implement, run to verify pass.

**Step 8: Implement the scoring engine (weighted aggregation)**

Create `packages/scoring/src/engine.ts`:

```typescript
import type { PageData, ScoringResult } from "./types";
import { scoreTechnicalFactors } from "./factors/technical";
import { scoreContentFactors } from "./factors/content";
import { scoreAiReadinessFactors } from "./factors/ai-readiness";
import { scorePerformanceFactors } from "./factors/performance";
import type { Issue } from "@llm-boost/shared";

const WEIGHTS = {
  technical: 0.25,
  content: 0.3,
  ai_readiness: 0.3,
  performance: 0.15,
};

function getLetterGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function scorePage(page: PageData): ScoringResult {
  // Special case: 4xx/5xx pages get 0
  if (page.statusCode >= 400) {
    return {
      overallScore: 0,
      technicalScore: 0,
      contentScore: 0,
      aiReadinessScore: 0,
      performanceScore: 0,
      letterGrade: "F",
      issues: [
        {
          code: "HTTP_STATUS",
          category: "technical",
          severity: "critical",
          message: `Page returned HTTP ${page.statusCode}`,
          recommendation: "Fix the server error or set up a redirect.",
          data: { statusCode: page.statusCode },
        },
      ],
    };
  }

  const technical = scoreTechnicalFactors(page);
  const content = scoreContentFactors(page);
  const aiReadiness = scoreAiReadinessFactors(page);
  const performance = scorePerformanceFactors(page);

  const overallScore = Math.round(
    technical.score * WEIGHTS.technical +
      content.score * WEIGHTS.content +
      aiReadiness.score * WEIGHTS.ai_readiness +
      performance.score * WEIGHTS.performance,
  );

  const allIssues: Issue[] = [
    ...technical.issues,
    ...content.issues,
    ...aiReadiness.issues,
    ...performance.issues,
  ];

  // Sort: critical > warning > info, then by score impact
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  allIssues.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  return {
    overallScore,
    technicalScore: technical.score,
    contentScore: content.score,
    aiReadinessScore: aiReadiness.score,
    performanceScore: performance.score,
    letterGrade: getLetterGrade(overallScore),
    issues: allIssues,
  };
}
```

**Step 9: Write engine integration tests**

Create `packages/scoring/src/__tests__/engine.test.ts` testing the full `scorePage` function:

- Perfect page → score ~100, grade A, no issues
- Page with 404 → score 0, grade F
- Page with multiple issues → correct weighted score, sorted issues
- Boundary grade tests (89 → B, 90 → A, etc.)

**Step 10: Run all tests with coverage and commit**

```bash
pnpm --filter @llm-boost/scoring test:coverage
git add packages/scoring/
git commit -m "feat: add 37-factor scoring engine with 50+ test cases"
```

---

### Task 5: Create packages/llm — LLM Orchestration

**Files:**

- Create: `packages/llm/package.json`
- Create: `packages/llm/src/index.ts`
- Create: `packages/llm/src/prompts.ts`
- Create: `packages/llm/src/scorer.ts`
- Create: `packages/llm/src/cache.ts`
- Test: `packages/llm/src/__tests__/prompts.test.ts`
- Test: `packages/llm/src/__tests__/scorer.test.ts`

**Step 1: Initialize package with Anthropic SDK dependency**

```json
{
  "name": "@llm-boost/llm",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39",
    "@llm-boost/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

**Step 2: Create prompt templates**

Create `packages/llm/src/prompts.ts`:

Build the prompt that asks the LLM to score a page's content on 5 dimensions (Clarity, Authority, Comprehensiveness, Structure, Citation Worthiness) each 0-100. The prompt should:

- Accept extracted page text (truncated to ~4000 tokens)
- Request JSON output with the 5 scores and brief reasoning
- Include scoring rubric for each dimension

**Step 3: Write deterministic tests for prompt construction**

Test that prompts are correctly built from page data, text is truncated, and JSON is parseable.

**Step 4: Create scorer with caching**

Create `packages/llm/src/scorer.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { LLMContentScores } from "@llm-boost/shared";
import { buildContentScoringPrompt } from "./prompts";

interface LLMScorerOptions {
  anthropicApiKey: string;
  kvNamespace?: KVNamespace; // For caching
  model?: string; // "claude-haiku-4-5-20251001" or "claude-sonnet-4-5-20250929"
}

export class LLMScorer {
  private client: Anthropic;
  private kv?: KVNamespace;
  private model: string;

  constructor(options: LLMScorerOptions) {
    this.client = new Anthropic({ apiKey: options.anthropicApiKey });
    this.kv = options.kvNamespace;
    this.model = options.model ?? "claude-haiku-4-5-20251001";
  }

  async scoreContent(
    pageText: string,
    contentHash: string,
  ): Promise<LLMContentScores | null> {
    // Check cache first
    if (this.kv) {
      const cached = await this.kv.get(`llm-score:${contentHash}`, "json");
      if (cached) return cached as LLMContentScores;
    }

    // Skip thin content
    const wordCount = pageText.split(/\s+/).length;
    if (wordCount < 200) return null;

    const prompt = buildContentScoringPrompt(pageText);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const scores = JSON.parse(text) as LLMContentScores;

    // Cache result
    if (this.kv) {
      await this.kv.put(`llm-score:${contentHash}`, JSON.stringify(scores), {
        expirationTtl: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return scores;
  }
}
```

**Step 5: Write tests (mock the Anthropic client) and commit**

```bash
pnpm --filter @llm-boost/llm test
git add packages/llm/
git commit -m "feat: add LLM scoring package with caching and tiered models"
```

---

## Phase C: Worker API

### Task 6: Create packages/api — Hono Worker

**Files:**

- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/src/index.ts`
- Create: `packages/api/src/middleware/auth.ts`
- Create: `packages/api/src/middleware/hmac.ts`
- Create: `packages/api/src/routes/health.ts`
- Create: `packages/api/src/routes/projects.ts`
- Create: `packages/api/src/routes/crawls.ts`
- Create: `packages/api/src/routes/ingest.ts`
- Create: `packages/api/src/routes/pages.ts`
- Create: `packages/api/src/routes/billing.ts`
- Create: `packages/api/src/lib/scoring.ts`
- Create: `wrangler.toml` (root)

**Step 1: Initialize package**

```json
{
  "name": "@llm-boost/api",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4",
    "@hono/clerk-auth": "^2",
    "@llm-boost/db": "workspace:*",
    "@llm-boost/shared": "workspace:*",
    "@llm-boost/scoring": "workspace:*",
    "@llm-boost/llm": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3",
    "wrangler": "^4"
  }
}
```

**Step 2: Create wrangler.toml at project root**

```toml
name = "llm-boost-api"
main = "packages/api/src/index.ts"
compatibility_date = "2025-12-01"

[[d1_databases]]
binding = "DB"
database_name = "ai-seo-db"
database_id = "" # Fill after creating D1 database

[[r2_buckets]]
binding = "R2"
bucket_name = "ai-seo-storage"

[[kv_namespaces]]
binding = "KV"
id = "" # Fill after creating KV namespace

[vars]
CRAWLER_URL = "" # Hetzner crawler URL
CLERK_PUBLISHABLE_KEY = ""

# Secrets (set via `wrangler secret put`):
# SHARED_SECRET, ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, CLERK_SECRET_KEY
```

**Step 3: Create Hono app entrypoint**

Create `packages/api/src/index.ts`:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createDb } from "@llm-boost/db";
import { healthRoutes } from "./routes/health";
import { projectRoutes } from "./routes/projects";
import { crawlRoutes } from "./routes/crawls";
import { ingestRoutes } from "./routes/ingest";
import { pageRoutes } from "./routes/pages";
import { billingRoutes } from "./routes/billing";

type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;
  SHARED_SECRET: string;
  ANTHROPIC_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  CLERK_SECRET_KEY: string;
  CRAWLER_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", logger());
app.use("*", cors());

app.route("/api/health", healthRoutes);
app.route("/api/projects", projectRoutes);
app.route("/api/crawls", crawlRoutes);
app.route("/api/pages", pageRoutes);
app.route("/api/billing", billingRoutes);
app.route("/ingest", ingestRoutes); // HMAC-protected, no auth

export default app;
```

**Step 4: Implement HMAC middleware**

Create `packages/api/src/middleware/hmac.ts`:

```typescript
import { createMiddleware } from "hono/factory";

export const hmacAuth = createMiddleware<{
  Bindings: { SHARED_SECRET: string };
}>(async (c, next) => {
  const signature = c.req.header("X-Signature");
  const timestamp = c.req.header("X-Timestamp");

  if (!signature || !timestamp) {
    return c.json(
      { error: { code: "HMAC_INVALID", message: "Missing signature headers" } },
      401,
    );
  }

  // Replay protection: reject timestamps > 5 minutes old
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return c.json(
      { error: { code: "HMAC_INVALID", message: "Timestamp too old" } },
      401,
    );
  }

  const body = await c.req.text();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(c.env.SHARED_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(timestamp + body),
  );
  const expected = `hmac-sha256=${Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

  if (signature !== expected) {
    return c.json(
      { error: { code: "HMAC_INVALID", message: "Invalid signature" } },
      401,
    );
  }

  await next();
});
```

**Step 5: Implement routes**

Build each route file following Hono patterns:

- `routes/health.ts` — simple `GET /` returning `{ status: "ok" }`
- `routes/projects.ts` — CRUD using `projectQueries` from db package, Clerk auth middleware
- `routes/crawls.ts` — Start crawl (POST), get status (GET), dispatches to Hetzner via fetch
- `routes/ingest.ts` — HMAC-protected, receives `CrawlResultBatch`, stores pages in D1, triggers scoring
- `routes/pages.ts` — Get page detail with scores and issues
- `routes/billing.ts` — Stripe checkout session creation, webhook handler

The ingest route is the critical data pipeline — when a batch arrives from the crawler:

1. Validate HMAC signature
2. Parse batch with `CrawlResultBatchSchema`
3. Insert pages into D1
4. Run `scorePage()` on each page
5. Insert scores and issues into D1
6. Update crawl_job progress counters
7. If `is_final`, trigger LLM scoring for paid users and update job status

**Step 6: Commit**

```bash
pnpm install
git add packages/api/ wrangler.toml
git commit -m "feat: add Hono Worker API with routes, HMAC auth, and ingest pipeline"
```

---

## Phase D: Rust Crawler

### Task 7: Scaffold Rust Crawler Project

**Files:**

- Create: `apps/crawler/Cargo.toml`
- Create: `apps/crawler/src/main.rs`
- Create: `apps/crawler/src/config.rs`
- Create: `apps/crawler/src/models.rs`
- Create: `apps/crawler/src/server/mod.rs`
- Create: `apps/crawler/src/server/routes.rs`
- Create: `apps/crawler/src/server/auth.rs`

**Step 1: Initialize Cargo project**

```bash
cd apps && cargo init crawler && cd ..
```

Edit `apps/crawler/Cargo.toml`:

```toml
[package]
name = "crawler"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = { version = "0.8", features = ["json"] }
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json", "gzip"] }
scraper = "0.22"
governor = "0.8"
hmac = "0.12"
sha2 = "0.10"
hex = "0.4"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
url = "2"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
aws-sdk-s3 = "1"
aws-config = "1"
tower-http = { version = "0.6", features = ["cors", "trace"] }
tokio-util = "0.7"
thiserror = "2"

[dev-dependencies]
axum-test = "16"
```

**Step 2: Create config module**

`apps/crawler/src/config.rs` — reads from environment variables:

- `SHARED_SECRET` — for HMAC verification
- `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_ENDPOINT`, `R2_BUCKET` — for R2 uploads
- `PORT` — HTTP server port (default 8080)
- `MAX_CONCURRENT_JOBS` — (default 5)
- `MAX_CONCURRENT_FETCHES` — per job (default 10)
- `MAX_CONCURRENT_LIGHTHOUSE` — (default 2)

**Step 3: Create data models**

`apps/crawler/src/models.rs` — Rust structs matching the Zod schemas in packages/shared (CrawlJobPayload, CrawlConfig, CrawlPageResult, CrawlResultBatch, ExtractedData, etc.). Use `serde` for JSON serialization.

**Step 4: Create Axum HTTP server with HMAC auth**

`apps/crawler/src/main.rs` — Axum app with routes:

- `POST /api/v1/jobs` — accept new crawl job
- `GET /api/v1/jobs/:id/status` — return job progress
- `POST /api/v1/jobs/:id/cancel` — cancel a running job

`apps/crawler/src/server/auth.rs` — Axum middleware for HMAC signature verification (same algorithm as the Worker HMAC middleware).

**Step 5: Verify it compiles and commit**

```bash
cd apps/crawler && cargo build && cd ../..
git add apps/crawler/
git commit -m "feat: scaffold Rust crawler with Axum server, config, and models"
```

---

### Task 8: Implement Crawler Engine

**Files:**

- Create: `apps/crawler/src/crawler/mod.rs`
- Create: `apps/crawler/src/crawler/frontier.rs`
- Create: `apps/crawler/src/crawler/fetcher.rs`
- Create: `apps/crawler/src/crawler/parser.rs`
- Create: `apps/crawler/src/crawler/robots.rs`
- Create: `apps/crawler/src/lighthouse/mod.rs`
- Create: `apps/crawler/src/storage/mod.rs`
- Create: `apps/crawler/src/jobs/mod.rs`

**Step 1: Implement URL frontier**

`frontier.rs` — BFS queue with:

- `BinaryHeap` sorted by depth (shallow pages first)
- `HashSet` for URL dedup (normalize URLs before adding)
- `crawled_count()` to check against `max_pages`
- Thread-safe via `Arc<Mutex<...>>`

**Step 2: Write tests for frontier**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deduplicates_urls() {
        let mut frontier = Frontier::new(vec!["https://example.com".into()]);
        frontier.add_discovered(vec![
            "https://example.com".into(),
            "https://example.com/about".into(),
        ]);
        assert_eq!(frontier.pending_count(), 1); // Only /about is new
    }

    #[test]
    fn respects_max_depth() {
        let frontier = Frontier::new(vec!["https://example.com".into()]);
        // ... test that URLs beyond max_depth are not added
    }
}
```

**Step 3: Implement HTML parser**

`parser.rs` — Uses `scraper` crate to extract:

- Title tag, meta description, canonical URL
- H1-H6 headings
- Internal vs external links
- Images without alt text
- Schema.org JSON-LD structured data
- Open Graph tags
- Robots meta directives
- Word count

**Step 4: Write parser tests with real HTML fixtures**

Create test HTML strings and verify correct extraction.

**Step 5: Implement robots.txt + llms.txt parser**

`robots.rs`:

- Fetch and parse robots.txt for the domain
- Check if GPTBot, ClaudeBot, PerplexityBot are blocked
- Fetch /llms.txt and check if it exists with valid content

**Step 6: Implement fetcher with rate limiting**

`fetcher.rs` — Uses `reqwest` with `governor::RateLimiter`:

- One token bucket per domain
- Configurable rate (default: 1 request per second)
- Timeout per request (configurable, default 30s)
- User-Agent header from config

**Step 7: Implement Lighthouse integration**

`lighthouse/mod.rs`:

- Shell out to `lighthouse` CLI: `lighthouse <url> --output=json --chrome-flags="--headless --no-sandbox"`
- Parse JSON output for performance, SEO, accessibility, best_practices scores
- Semaphore limiting to 2 concurrent audits
- 60-second timeout per audit

**Step 8: Implement R2 storage and callback POST**

`storage/mod.rs`:

- Upload raw HTML to R2 (gzipped) using S3-compatible API
- Upload Lighthouse JSON to R2 (gzipped)
- POST `CrawlResultBatch` to callback URL with HMAC signature

**Step 9: Implement job manager**

`jobs/mod.rs`:

- `tokio::sync::mpsc` channel for job queue (bounded, default capacity 5)
- Each job spawns the crawl loop from requirements Section 12.2
- `CancellationToken` for cooperative cancellation
- Batch result accumulation: send after N pages or T seconds

**Step 10: Wire everything into main.rs and test**

Connect the Axum routes to the job manager. When `POST /api/v1/jobs` is received:

1. Parse and validate the CrawlJobPayload
2. Send to job queue via mpsc
3. Return 202 Accepted with job_id

Run full compile and unit tests:

```bash
cd apps/crawler && cargo test && cd ../..
git add apps/crawler/
git commit -m "feat: implement Rust crawler with frontier, parser, Lighthouse, R2, and job manager"
```

---

### Task 9: Create Dockerfile and Docker Compose

**Files:**

- Create: `apps/crawler/Dockerfile`
- Create: `apps/crawler/docker-compose.yml`

**Step 1: Create multi-stage Dockerfile**

```dockerfile
FROM rust:1.84-slim AS builder
WORKDIR /app
COPY apps/crawler/ .
RUN apt-get update && apt-get install -y pkg-config libssl-dev && \
    cargo build --release

FROM node:20-slim
RUN apt-get update && \
    apt-get install -y chromium && \
    npm install -g lighthouse && \
    rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/crawler /usr/local/bin/
ENV CHROME_PATH=/usr/bin/chromium
ENV RUST_LOG=info
EXPOSE 8080
CMD ["crawler"]
```

**Step 2: Create docker-compose.yml**

```yaml
services:
  crawler:
    build:
      context: ../..
      dockerfile: apps/crawler/Dockerfile
    ports:
      - "8080:8080"
    environment:
      - SHARED_SECRET=${SHARED_SECRET}
      - R2_ACCESS_KEY=${R2_ACCESS_KEY}
      - R2_SECRET_KEY=${R2_SECRET_KEY}
      - R2_ENDPOINT=${R2_ENDPOINT}
      - R2_BUCKET=${R2_BUCKET}
      - PORT=8080
      - MAX_CONCURRENT_JOBS=5
      - MAX_CONCURRENT_LIGHTHOUSE=2
      - RUST_LOG=info
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 4G
```

**Step 3: Build and test locally, commit**

```bash
docker compose -f apps/crawler/docker-compose.yml build
git add apps/crawler/Dockerfile apps/crawler/docker-compose.yml
git commit -m "feat: add Dockerfile and docker-compose for crawler service"
```

---

## Phase E: Next.js Dashboard

### Task 10: Scaffold Next.js App

**Files:**

- Create: `apps/web/` (via create-next-app with Cloudflare Pages adapter)
- Modify: `apps/web/package.json`
- Create: `apps/web/tailwind.config.ts`

**Step 1: Create Next.js app**

```bash
pnpm create next-app apps/web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-pnpm
```

**Step 2: Install dependencies**

```bash
cd apps/web
pnpm add @clerk/nextjs @llm-boost/shared
pnpm add -D @cloudflare/next-on-pages
cd ../..
```

**Step 3: Initialize shadcn/ui**

```bash
cd apps/web && pnpm dlx shadcn@latest init && cd ../..
```

Add commonly needed components:

```bash
cd apps/web && pnpm dlx shadcn@latest add button card input label table badge tabs progress dialog dropdown-menu separator && cd ../..
```

**Step 4: Configure Clerk provider**

Wrap the app in `ClerkProvider` in `apps/web/app/layout.tsx`. Set up sign-in/sign-up pages in `apps/web/app/(auth)/`.

**Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold Next.js dashboard with Tailwind, shadcn/ui, and Clerk auth"
```

---

### Task 11: Build Dashboard Pages

**Files:**

- Create: `apps/web/app/(dashboard)/layout.tsx` (sidebar nav + auth guard)
- Create: `apps/web/app/(dashboard)/page.tsx` (project cards overview)
- Create: `apps/web/app/(dashboard)/projects/new/page.tsx`
- Create: `apps/web/app/(dashboard)/projects/[id]/page.tsx` (project overview)
- Create: `apps/web/app/(dashboard)/projects/[id]/pages/page.tsx`
- Create: `apps/web/app/(dashboard)/projects/[id]/issues/page.tsx`
- Create: `apps/web/app/(dashboard)/crawl/[id]/page.tsx` (progress + results)
- Create: `apps/web/app/(dashboard)/settings/page.tsx`
- Create: `apps/web/lib/api.ts` (typed API client)
- Create: `apps/web/components/score-circle.tsx`
- Create: `apps/web/components/issue-card.tsx`
- Create: `apps/web/components/crawl-progress.tsx`

**Step 1: Create typed API client**

`apps/web/lib/api.ts` — wraps `fetch`, adds Clerk session token as Bearer auth, validates responses against Zod schemas from `@llm-boost/shared`.

**Step 2: Build dashboard layout**

Sidebar with navigation links (Dashboard, Projects, Settings). Auth guard using Clerk's `auth()` helper.

**Step 3: Build project list page**

Cards showing: domain, last crawl date, overall score with letter grade badge, issue count. "New Project" button.

**Step 4: Build create project page**

Form: project name + domain URL. Validates with `CreateProjectSchema`. On success, redirects to project page.

**Step 5: Build project overview page**

Hero score circle (large animated gauge), category breakdown bars, top 5 issues with recommendations, "Start Crawl" button.

**Step 6: Build crawl progress page**

Progress bar, pages found/crawled/scored counters, elapsed time. Polls API every 3 seconds. Transitions to results view when `is_final: true`.

**Step 7: Build pages list**

Table: URL, status code, title, overall score, issue count. Sortable and filterable. Click row → page detail view.

**Step 8: Build issues list**

Filterable by severity and category. Each issue is an expandable card with: severity badge, message, recommendation, affected page count.

**Step 9: Build score-circle component**

Animated SVG circle gauge showing score 0-100 with letter grade in center. Color: green (A/B), yellow (C), orange (D), red (F).

**Step 10: Commit**

```bash
git add apps/web/
git commit -m "feat: build dashboard pages with project management, crawl progress, and score views"
```

---

## Phase F: Infrastructure & CI/CD

### Task 12: Set Up Cloudflare Resources

**Step 1: Create D1 database**

```bash
npx wrangler d1 create ai-seo-db
```

Copy the database_id into `wrangler.toml`.

**Step 2: Create R2 bucket**

```bash
npx wrangler r2 bucket create ai-seo-storage
```

**Step 3: Create KV namespace**

```bash
npx wrangler kv namespace create KV
```

Copy the id into `wrangler.toml`.

**Step 4: Run initial migration**

```bash
npx wrangler d1 migrations apply ai-seo-db --local
npx wrangler d1 migrations apply ai-seo-db --remote
```

**Step 5: Set secrets**

```bash
npx wrangler secret put SHARED_SECRET
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put CLERK_SECRET_KEY
```

**Step 6: Deploy Worker and verify**

```bash
npx wrangler deploy
curl https://llm-boost-api.<your-subdomain>.workers.dev/api/health
```

Expected: `{"status":"ok"}`

**Step 7: Commit wrangler.toml updates**

```bash
git add wrangler.toml
git commit -m "chore: configure Cloudflare D1, R2, and KV bindings"
```

---

### Task 13: Set Up Hetzner VPS

**Step 1: Provision Hetzner CX31**

- Create a CX31 server (4 vCPU, 8GB RAM) via Hetzner Cloud console
- Add SSH key for deploy user
- Note the public IP

**Step 2: Configure server**

SSH in and set up:

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin
systemctl enable docker
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
mkdir -p /opt/crawler
chown deploy:deploy /opt/crawler
```

**Step 3: Copy docker-compose.yml and .env**

SCP the compose file and create `.env` with all required environment variables.

**Step 4: Pull and start the crawler**

```bash
docker compose -f /opt/crawler/docker-compose.yml up -d
curl http://localhost:8080/api/v1/health
```

**Step 5: Update CRAWLER_URL in wrangler.toml**

Set `CRAWLER_URL` to `http://<hetzner-ip>:8080` (or set up a domain with HTTPS).

---

### Task 14: Create GitHub Actions CI/CD

**Files:**

- Create: `.github/workflows/deploy-cloudflare.yml`
- Create: `.github/workflows/deploy-crawler.yml`
- Create: `.github/workflows/ci.yml`

**Step 1: Create CI workflow**

`.github/workflows/ci.yml` — runs on all PRs:

```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

**Step 2: Create Cloudflare deploy workflow using native Wrangler**

`.github/workflows/deploy-cloudflare.yml`:

```yaml
name: Deploy Cloudflare
on:
  push:
    branches: [main]
    paths:
      - "packages/**"
      - "apps/web/**"

jobs:
  deploy-worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter=api
      - name: Deploy Worker via Wrangler
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
      - name: Run D1 migrations
        run: npx wrangler d1 migrations apply ai-seo-db --remote
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}

  deploy-pages:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter=web
      - name: Deploy Pages via Wrangler
        run: npx wrangler pages deploy apps/web/.next --project-name=llm-boost
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
```

Note: Uses `wrangler deploy` (Worker) and `wrangler pages deploy` (Pages) natively — no third-party actions. All Cloudflare deployment goes through Wrangler CLI with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from GitHub secrets.

**Step 3: Create Hetzner crawler deploy workflow**

`.github/workflows/deploy-crawler.yml`:

```yaml
name: Deploy Crawler
on:
  push:
    branches: [main]
    paths:
      - "apps/crawler/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/crawler/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/crawler:latest
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: deploy
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            cd /opt/crawler
            docker compose pull
            docker compose up -d --force-recreate
            docker system prune -f
```

**Step 4: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions for CI, Cloudflare deploy, and Hetzner crawler deploy"
```

---

## Phase G: End-to-End Integration

### Task 15: End-to-End Smoke Test

**Step 1: Verify the full pipeline locally**

1. Start the Rust crawler locally: `cd apps/crawler && cargo run`
2. Start the Worker locally: `npx wrangler dev`
3. Start Next.js locally: `cd apps/web && pnpm dev`
4. Create a user account via Clerk
5. Create a project with a real domain (e.g., a small personal site)
6. Start a crawl
7. Verify: crawl progress updates → scores appear → issues display with recommendations

**Step 2: Fix any integration issues found**

**Step 3: Deploy everything and test in production**

```bash
npx turbo build
npx wrangler deploy
# Push crawler Docker image to GHCR and deploy to Hetzner
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete MVP end-to-end integration"
```

---

## Summary: Task Dependency Graph

```
Task 1 (Monorepo scaffold)
  └── Task 2 (packages/shared)
        ├── Task 3 (packages/db)
        │     └── Task 6 (packages/api) ─── Task 12 (Cloudflare setup)
        ├── Task 4 (packages/scoring)
        │     └── Task 6 (packages/api)
        └── Task 5 (packages/llm)
              └── Task 6 (packages/api)

Task 7 (Rust crawler scaffold) ──── independent, can start after Task 2
  └── Task 8 (Crawler engine)
        └── Task 9 (Docker)
              └── Task 13 (Hetzner setup)

Task 10 (Next.js scaffold) ──── can start after Task 2
  └── Task 11 (Dashboard pages)

Task 14 (CI/CD) ──── can start after Tasks 6, 9, 10

Task 15 (E2E integration) ──── requires all above
```

**Parallelizable tracks (MVP):**

- Track A: Tasks 1-2-3-4-5-6-12 (TypeScript backend)
- Track B: Tasks 7-8-9-13 (Rust crawler, can start after Task 2)
- Track C: Tasks 10-11 (Next.js frontend, can start after Task 2)

---

---

# FULL PLATFORM — Tasks 16-28

Everything below extends the MVP (Tasks 1-15) into the complete launch-ready product.

---

## Phase H: Crawl History & Comparison

### Task 16: Crawl History & Score Comparison

**Files:**

- Create: `apps/web/app/(dashboard)/projects/[id]/history/page.tsx`
- Create: `apps/web/components/crawl-comparison.tsx`
- Create: `apps/web/components/score-trend-chart.tsx`
- Modify: `packages/db/src/queries/crawls.ts` — add `listCompletedByProject`, `getComparisonData`
- Modify: `packages/api/src/routes/crawls.ts` — add `GET /api/projects/:id/history` and `GET /api/crawls/:id/compare/:otherId`
- Test: `packages/db/src/__tests__/crawl-queries.test.ts`

**Step 1: Write failing test for comparison query**

Test `getComparisonData(jobId1, jobId2)` — should return both crawl scores with per-page deltas (score improved/declined/unchanged).

**Step 2: Implement comparison query helper**

In `packages/db/src/queries/crawls.ts`:

```typescript
async getComparisonData(jobId1: string, jobId2: string) {
  // Join pages + page_scores for both jobs
  // Match pages by URL across jobs
  // Return: { url, oldScore, newScore, delta, oldIssueCount, newIssueCount }[]
}
```

Also add `listCompletedByProject(projectId)` to return all completed crawls with summary scores for the history timeline.

**Step 3: Add API routes**

- `GET /api/projects/:id/history` — returns list of completed crawls with summary (date, overall score, pages crawled, issue counts)
- `GET /api/crawls/:id/compare/:otherId` — returns per-page comparison data

**Step 4: Build history page**

`apps/web/app/(dashboard)/projects/[id]/history/page.tsx`:

- Timeline of all completed crawls
- Score trend chart (Recharts line chart: date on x-axis, overall score on y-axis)
- Select two crawls to compare
- Comparison view: side-by-side scores with green/red delta indicators
- "Score improved by X points!" celebration banner when positive

```bash
cd apps/web && pnpm add recharts && cd ../..
```

**Step 5: Build comparison component**

`crawl-comparison.tsx`:

- Two columns showing crawl date + overall score
- Per-page table: URL, old score, new score, delta (color-coded)
- Summary: issues resolved, new issues, unchanged
- Filter: show only improved / declined / all

**Step 6: Run tests and commit**

```bash
pnpm test
git add packages/db/ packages/api/ apps/web/
git commit -m "feat: add crawl history timeline and score comparison views"
```

---

## Phase I: Stripe Billing (Full)

### Task 17: Stripe Products, Pricing Page & Checkout

**Files:**

- Create: `apps/web/app/(marketing)/pricing/page.tsx`
- Create: `apps/web/components/pricing-table.tsx`
- Modify: `packages/api/src/routes/billing.ts` — full Stripe integration
- Create: `packages/api/src/lib/stripe.ts` — Stripe client + helpers
- Modify: `packages/db/src/queries/users.ts` — add plan update methods
- Test: `packages/api/src/__tests__/billing.test.ts`

**Step 1: Create Stripe products and prices**

In Stripe Dashboard (or via API), create:

- Product: "LLM Rank Starter" — $79/mo
- Product: "LLM Rank Pro" — $149/mo
- Product: "LLM Rank Agency" — $299/mo

Store price IDs as constants in `packages/shared/src/constants/plans.ts`:

```typescript
export const STRIPE_PRICE_IDS = {
  starter: "price_xxx", // Fill from Stripe
  pro: "price_xxx",
  agency: "price_xxx",
} as const;
```

**Step 2: Implement Stripe helper module**

`packages/api/src/lib/stripe.ts`:

```typescript
import Stripe from "stripe";

export function createStripeClient(secretKey: string) {
  return new Stripe(secretKey, { apiVersion: "2025-01-27.acacia" });
}

export async function createCheckoutSession(
  stripe: Stripe,
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
) {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: undefined, // Or pass email
    metadata: { userId },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}
```

**Step 3: Implement billing API routes**

`packages/api/src/routes/billing.ts`:

- `POST /api/billing/checkout` — Create Stripe checkout session. Body: `{ plan: "starter"|"pro"|"agency" }`. Returns checkout URL.
- `POST /api/billing/webhook` — Handle Stripe webhooks:
  - `checkout.session.completed` → update user plan in D1, set crawl credits
  - `customer.subscription.updated` → handle plan changes (up/downgrade), prorate credits
  - `customer.subscription.deleted` → revert to free plan, keep data for 90 days
  - `invoice.payment_failed` → flag account, send notification
- `GET /api/billing/usage` — Return current usage against plan limits (crawls used, pages scored, projects count)
- `POST /api/billing/portal` — Create Stripe Customer Portal session for self-service management

**Step 4: Build pricing page**

`apps/web/app/(marketing)/pricing/page.tsx`:

- 4-column comparison table (Free, Starter, Pro, Agency)
- Feature rows: pages/crawl, crawls/month, projects, AI scoring tier, visibility checks, history retention, API access
- CTA buttons: "Start Free" (free), "Subscribe" (paid tiers)
- FAQ section below pricing table
- Toggle for monthly/annual pricing (if applicable)

**Step 5: Build billing settings page**

In `apps/web/app/(dashboard)/settings/page.tsx`:

- Current plan with badge
- Usage bars (crawls used / limit, projects used / limit)
- Next billing date
- "Manage Subscription" button → Stripe Customer Portal
- "Upgrade" button → pricing page

**Step 6: Test webhook handling**

Use Stripe CLI to test webhooks locally:

```bash
stripe listen --forward-to localhost:8787/api/billing/webhook
stripe trigger checkout.session.completed
```

**Step 7: Commit**

```bash
git add packages/api/ packages/shared/ apps/web/
git commit -m "feat: full Stripe billing with checkout, webhooks, usage metering, and pricing page"
```

---

### Task 18: Usage Metering & Plan Limit Enforcement

**Files:**

- Create: `packages/api/src/middleware/planLimits.ts`
- Modify: `packages/api/src/routes/crawls.ts` — enforce crawl credits
- Modify: `packages/api/src/routes/projects.ts` — enforce project limits
- Modify: `packages/db/src/queries/users.ts` — add credit management
- Test: `packages/api/src/__tests__/plan-limits.test.ts`

**Step 1: Write failing tests for limit enforcement**

Test cases:

- Free user with 0 crawl credits → 429 CRAWL_LIMIT_REACHED
- Free user with 1 project tries to create another → 403 PLAN_LIMIT_REACHED
- Free user crawl capped at 10 pages, depth 2
- Pro user allowed up to 500 pages, depth 5
- Credit decrement on crawl start, not crawl complete
- Monthly credit reset (check via Cron Trigger)

**Step 2: Implement plan limits middleware**

`packages/api/src/middleware/planLimits.ts`:

```typescript
import { createMiddleware } from "hono/factory";
import { PLAN_LIMITS } from "@llm-boost/shared";

export const enforcePlanLimit = (
  resource: "crawl" | "project" | "visibility",
) =>
  createMiddleware(async (c, next) => {
    const user = c.get("user"); // Set by auth middleware
    const limits = PLAN_LIMITS[user.plan];
    // Check resource-specific limits against current usage
    // Return 403/429 with appropriate error code if exceeded
    await next();
  });
```

**Step 3: Add monthly credit reset via Cron Trigger**

Add to `wrangler.toml`:

```toml
[triggers]
crons = ["0 0 1 * *"] # First of every month at midnight
```

In `packages/api/src/index.ts`, add scheduled handler:

```typescript
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    // Reset crawl_credits_remaining for all users based on their plan
    const db = createDb(env.DB);
    // UPDATE users SET crawl_credits_remaining = (plan limit) for each plan tier
  },
};
```

**Step 4: Commit**

```bash
git add packages/api/ wrangler.toml
git commit -m "feat: add usage metering, plan limit enforcement, and monthly credit reset"
```

---

## Phase J: AI Visibility Tracking

### Task 19: Multi-LLM Visibility Checker

**Files:**

- Create: `packages/llm/src/visibility.ts`
- Create: `packages/llm/src/providers/chatgpt.ts`
- Create: `packages/llm/src/providers/claude.ts`
- Create: `packages/llm/src/providers/perplexity.ts`
- Create: `packages/llm/src/providers/gemini.ts`
- Test: `packages/llm/src/__tests__/visibility.test.ts`
- Modify: `packages/llm/package.json` — add openai SDK

**Step 1: Install provider SDKs**

```bash
cd packages/llm && pnpm add openai @google/generative-ai && cd ../..
```

**Step 2: Implement provider interfaces**

Each provider module exports:

```typescript
interface VisibilityCheckResult {
  provider: string;
  query: string;
  responseText: string;
  brandMentioned: boolean;
  urlCited: boolean;
  citationPosition: number | null;
  competitorMentions: {
    domain: string;
    mentioned: boolean;
    position: number | null;
  }[];
}

async function checkVisibility(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
): Promise<VisibilityCheckResult>;
```

Implementation for each provider:

- **ChatGPT** (`providers/chatgpt.ts`): Use OpenAI SDK, send query, parse response for domain/brand mentions
- **Claude** (`providers/claude.ts`): Use Anthropic SDK, same pattern
- **Perplexity** (`providers/perplexity.ts`): Use Perplexity API (OpenAI-compatible), parse citations
- **Gemini** (`providers/gemini.ts`): Use Google Generative AI SDK

**Step 3: Implement visibility orchestrator**

`packages/llm/src/visibility.ts`:

```typescript
export class VisibilityChecker {
  async checkAllProviders(
    query: string,
    targetDomain: string,
    competitors: string[],
    providers: string[], // which LLMs to check
    apiKeys: Record<string, string>,
  ): Promise<VisibilityCheckResult[]> {
    // Run all provider checks in parallel
    // Cache results in KV by query+provider (24h TTL)
    // Return array of results
  }
}
```

**Step 4: Write tests (mock API calls)**

Test brand/URL detection logic, competitor parsing, caching behavior.

**Step 5: Commit**

```bash
git add packages/llm/
git commit -m "feat: add multi-LLM visibility checker for ChatGPT, Claude, Perplexity, and Gemini"
```

---

### Task 20: Visibility API Routes & Dashboard

**Files:**

- Modify: `packages/api/src/routes/` — create `visibility.ts`
- Modify: `packages/api/src/index.ts` — register visibility routes
- Create: `apps/web/app/(dashboard)/projects/[id]/visibility/page.tsx`
- Create: `apps/web/components/visibility-table.tsx`
- Create: `apps/web/components/visibility-trend-chart.tsx`

**Step 1: Add API routes**

- `POST /api/visibility/check` — Run visibility check. Body: `{ projectId, query, providers: ["chatgpt", "claude", ...], competitors?: string[] }`. Enforces plan limits on visibility check credits.
- `GET /api/visibility/:projectId` — Get all visibility results for a project, with pagination and optional query filter.
- `GET /api/visibility/:projectId/trends` — Get visibility trend data (mention rate over time per provider).

**Step 2: Build visibility setup page**

`apps/web/app/(dashboard)/projects/[id]/visibility/page.tsx`:

- "Add Query" form: search query text + checkbox for which LLM providers to check
- Pro/Agency: competitor domain input (up to 5)
- "Run Check" button → triggers POST, shows loading state
- Usage indicator: "3 of 25 visibility checks used this month"

**Step 3: Build results table**

`visibility-table.tsx`:

- Rows: one per query
- Columns: Query, then one column per provider with green check/red X for brand mentioned
- Expandable row shows: full response text excerpt, citation position, competitor mentions
- Competitor comparison: "Your Domain vs. Competitors" side-by-side for each query

**Step 4: Build trend chart**

`visibility-trend-chart.tsx`:

- Recharts line chart: date on x-axis, mention rate (%) on y-axis
- One line per provider (color-coded)
- Tooltip showing specific check results on hover

**Step 5: Commit**

```bash
git add packages/api/ apps/web/
git commit -m "feat: add AI visibility tracking dashboard with multi-LLM results and trends"
```

---

## Phase K: Scheduled Crawls, Email, Analytics, Error Tracking

### Task 21: Scheduled Crawls (Cron Triggers)

**Files:**

- Modify: `packages/db/src/schema.ts` — add `schedule` field to projects
- Create: `packages/db/migrations/0002_add_schedule.sql`
- Modify: `packages/api/src/index.ts` — add scheduled crawl handler
- Modify: `wrangler.toml` — add cron trigger for scheduled crawls
- Test: `packages/api/src/__tests__/scheduled-crawls.test.ts`

**Step 1: Add schedule column to projects**

```sql
ALTER TABLE projects ADD COLUMN crawl_schedule TEXT DEFAULT 'manual'
  CHECK(crawl_schedule IN ('manual', 'daily', 'weekly', 'monthly'));
ALTER TABLE projects ADD COLUMN next_crawl_at TEXT;
```

**Step 2: Add cron trigger**

In `wrangler.toml`:

```toml
[triggers]
crons = ["0 0 1 * *", "0 6 * * *"] # Credit reset + daily crawl check at 6am UTC
```

**Step 3: Implement scheduled handler**

In the `scheduled` export:

- Query projects where `crawl_schedule != 'manual'` and `next_crawl_at <= now()`
- For each: check user has crawl credits, create crawl job, POST to Hetzner
- Update `next_crawl_at` based on schedule (daily: +1 day, weekly: +7 days, monthly: +30 days)

**Step 4: Add schedule UI to project settings**

In `apps/web/app/(dashboard)/projects/[id]/settings/page.tsx`:

- Dropdown: Manual, Daily, Weekly, Monthly
- Show next crawl date
- Starter+ plans only (free users see upgrade prompt)

**Step 5: Commit**

```bash
git add packages/db/ packages/api/ apps/web/ wrangler.toml
git commit -m "feat: add scheduled crawls with Cron Triggers (daily/weekly/monthly)"
```

---

### Task 22: Email Notifications

**Files:**

- Create: `packages/api/src/lib/email.ts`
- Modify: `packages/api/src/routes/ingest.ts` — send email on crawl complete
- Modify: `packages/db/src/schema.ts` — add notification preferences to users

**Step 1: Choose email provider**

Use Cloudflare's native `fetch` to call a transactional email API (Resend, Postmark, or SendGrid). Create a thin wrapper:

```typescript
// packages/api/src/lib/email.ts
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  apiKey: string,
) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "LLM Rank <notifications@llmboost.com>",
      to,
      subject,
      html,
    }),
  });
}
```

**Step 2: Send crawl completion email**

In the ingest route, when `is_final: true`:

- Look up user email from project → user
- Send email: "Your crawl is complete! Score: X/100 (Grade). Y issues found. [View Results →]"

**Step 3: Add notification preferences**

Users can toggle: crawl complete, weekly summary, visibility alerts. Store in `users.settings` JSON column.

**Step 4: Commit**

```bash
git add packages/api/ packages/db/
git commit -m "feat: add email notifications for crawl completion"
```

---

### Task 23: PostHog Analytics Integration

**Files:**

- Create: `apps/web/lib/analytics.ts`
- Modify: `apps/web/app/layout.tsx` — add PostHog provider
- Modify relevant pages to track events from requirements Section 16.3

**Step 1: Install PostHog**

```bash
cd apps/web && pnpm add posthog-js && cd ../..
```

**Step 2: Create analytics helper**

`apps/web/lib/analytics.ts`:

```typescript
import posthog from "posthog-js";

export function initAnalytics(apiKey: string) {
  if (typeof window !== "undefined") {
    posthog.init(apiKey, {
      api_host: "https://us.i.posthog.com",
      capture_pageview: true,
    });
  }
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  posthog.capture(event, properties);
}
```

**Step 3: Add tracking calls**

Instrument all events from requirements Section 16.3:

- `user_signed_up` — after Clerk signup
- `project_created` — after project creation
- `crawl_started` — after crawl initiation
- `crawl_completed` — on crawl results page load
- `page_detail_viewed` — on page detail view
- `issue_recommendation_viewed` — on recommendation expand
- `visibility_check_run` — after visibility check
- `report_exported` — after PDF download
- `upgrade_initiated` — on upgrade CTA click
- `upgrade_completed` — on Stripe success redirect
- `subscription_cancelled` — on cancellation confirm

**Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat: add PostHog analytics with full event tracking plan"
```

---

### Task 24: Sentry Error Tracking

**Files:**

- Modify: `apps/web/` — add Sentry Next.js SDK
- Modify: `packages/api/src/index.ts` — add Sentry for Workers
- Modify: `apps/crawler/Cargo.toml` — add sentry crate

**Step 1: Install Sentry in Next.js**

```bash
cd apps/web && pnpm add @sentry/nextjs && cd ../..
npx @sentry/wizard@latest -i nextjs
```

Configure `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.

**Step 2: Add Sentry to Workers API**

Use `toucan-js` (Sentry SDK for Cloudflare Workers):

```bash
cd packages/api && pnpm add toucan-js && cd ../..
```

Add error boundary middleware in Hono:

```typescript
import { Toucan } from "toucan-js";

app.onError((err, c) => {
  const sentry = new Toucan({ dsn: c.env.SENTRY_DSN, context: c.executionCtx });
  sentry.captureException(err);
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    500,
  );
});
```

**Step 3: Add Sentry to Rust crawler**

Add `sentry = "0.35"` to `apps/crawler/Cargo.toml`. Initialize in `main.rs`:

```rust
let _guard = sentry::init(std::env::var("SENTRY_DSN").ok());
```

**Step 4: Commit**

```bash
git add apps/web/ packages/api/ apps/crawler/
git commit -m "feat: add Sentry error tracking to frontend, API, and crawler"
```

---

## Phase L: Reports, Competitor Tracking, White-Label, Marketing

### Task 25: PDF Report Export

**Files:**

- Create: `apps/web/app/api/reports/[jobId]/route.ts` — Next.js API route for PDF generation
- Create: `apps/web/components/report/report-template.tsx`
- Create: `apps/web/components/report/report-header.tsx`
- Create: `apps/web/components/report/report-scores.tsx`
- Create: `apps/web/components/report/report-issues.tsx`

**Step 1: Install PDF library**

```bash
cd apps/web && pnpm add @react-pdf/renderer && cd ../..
```

**Step 2: Build report template**

`report-template.tsx` — React PDF document with:

- Executive summary: overall score, letter grade, category breakdown
- Top 10 critical issues with recommendations
- Page-by-page score table (sorted worst first)
- Score trend chart (if multiple crawls exist)
- Generated date, project name, domain

**Step 3: Build white-label support**

For Agency tier: accept custom logo URL, company name, brand colors via project settings. Apply to report header.

```typescript
interface ReportOptions {
  customLogo?: string; // URL to logo image
  companyName?: string;
  primaryColor?: string;
}
```

**Step 4: Create PDF API route**

`apps/web/app/api/reports/[jobId]/route.ts`:

- Fetch crawl data from API
- Render React PDF to buffer
- Return as `application/pdf` with `Content-Disposition: attachment`
- For large crawls (500+ pages): queue generation, store in R2, email download link

**Step 5: Add "Export PDF" button to project overview**

In crawl results page, add button that triggers download. Track `report_exported` analytics event.

**Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat: add PDF report export with white-label support for agency tier"
```

---

### Task 26: Competitor Tracking

**Files:**

- Modify: `packages/db/src/schema.ts` — add `competitors` table
- Create: `packages/db/migrations/0003_add_competitors.sql`
- Modify: `packages/api/src/routes/visibility.ts` — integrate competitor data
- Modify: `apps/web/app/(dashboard)/projects/[id]/visibility/page.tsx` — competitor UI

**Step 1: Add competitors table**

```sql
CREATE TABLE competitors (
  id    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_competitors_project ON competitors(project_id);
```

**Step 2: Add competitor management UI**

In visibility settings:

- "Add Competitor" form (domain input, up to 5 per project)
- Delete button per competitor
- Pro/Agency tiers only

**Step 3: Enhance visibility checks with competitor data**

When running visibility checks, also check if competitor domains are mentioned. Store in `visibility_checks.competitor_mentions` JSON column.

**Step 4: Build comparison table**

In visibility dashboard, add "Competitor Comparison" section:

- Table: Query | Your Domain | Competitor 1 | Competitor 2 | ...
- Cells: green check (mentioned + cited), yellow (mentioned), red X (not mentioned)
- Per-provider breakdown on expand

**Step 5: Commit**

```bash
git add packages/db/ packages/api/ apps/web/
git commit -m "feat: add competitor tracking with visibility comparison"
```

---

### Task 27: Onboarding Flow & User Settings

**Files:**

- Create: `apps/web/app/(dashboard)/onboarding/page.tsx`
- Create: `apps/web/components/onboarding-wizard.tsx`
- Modify: `apps/web/app/(dashboard)/settings/page.tsx` — full settings page
- Modify: `packages/api/src/routes/` — user settings endpoints

**Step 1: Build 3-step onboarding wizard**

Per requirements Section 4.1:

1. **Step 1:** "Enter your website URL" — domain input with validation
2. **Step 2:** "Choose crawl settings" — depth, max pages (within plan limits)
3. **Step 3:** "Start your first crawl" — summary + "Start Crawl" button

Show onboarding on first login (check if user has any projects). "Skip" button dismisses permanently.

**Step 2: Build full settings page**

Tabs:

- **Profile:** Name, email (from Clerk), avatar
- **Billing:** Current plan, usage, upgrade/manage subscription
- **Notifications:** Toggle email preferences (crawl complete, weekly summary, visibility alerts)
- **API Keys:** (Pro/Agency only) Generate/revoke API keys for programmatic access

**Step 3: Add API key management**

For Pro/Agency tiers:

- `POST /api/settings/api-keys` — generate new API key (store hashed in D1)
- `DELETE /api/settings/api-keys/:id` — revoke key
- `GET /api/settings/api-keys` — list active keys (masked)
- API key auth middleware (alternative to Clerk for programmatic access)

**Step 4: Commit**

```bash
git add apps/web/ packages/api/ packages/db/
git commit -m "feat: add onboarding wizard, user settings, and API key management"
```

---

### Task 28: Marketing Site & Launch Preparation

**Files:**

- Create: `apps/web/app/(marketing)/page.tsx` — landing page
- Create: `apps/web/app/(marketing)/layout.tsx` — marketing layout (no sidebar)
- Modify: `apps/web/app/(marketing)/pricing/page.tsx` — already built in Task 17
- Create: `apps/web/components/marketing/hero.tsx`
- Create: `apps/web/components/marketing/features.tsx`
- Create: `apps/web/components/marketing/testimonials.tsx`
- Create: `apps/web/components/marketing/footer.tsx`

**Step 1: Build landing page**

Sections:

1. **Hero:** "See How AI Search Engines View Your Content" — headline, subhead, CTA (Start Free), hero screenshot
2. **Problem/Solution:** Pain points → LLM Rank solution (3 columns)
3. **How It Works:** 3-step visual flow (Enter URL → Get Scored → Fix Issues)
4. **Feature Highlights:** Score dashboard screenshot, issue recommendations, visibility tracking
5. **Pricing:** Embed pricing table from Task 17
6. **Social Proof:** Testimonial placeholders, logos, "trusted by X agencies"
7. **CTA:** "Start Optimizing for AI Search — Free" button
8. **Footer:** Links, legal, social

**Step 2: Build marketing layout**

Separate layout from dashboard — no sidebar, top nav with: Logo, Features, Pricing, Login, "Get Started" CTA button.

**Step 3: Add legal pages**

- `/terms` — Terms of Service (placeholder)
- `/privacy` — Privacy Policy (placeholder with GDPR compliance notes)

**Step 4: SEO optimization for marketing pages**

- Proper meta tags, og:tags, structured data (Organization, WebApplication)
- Sitemap generation
- Performance optimization (static generation where possible)

**Step 5: Launch readiness checklist**

Reference: `ai-seo-requirements.md` Section 20.

Verify all items:

- [ ] All P0 features functional
- [ ] Scoring engine correct for 50+ test cases
- [ ] Full crawl pipeline works end-to-end
- [ ] Auth secure
- [ ] Stripe billing works
- [ ] API error rate < 1%
- [ ] Dashboard load < 2s
- [ ] No critical security vulnerabilities
- [ ] Sentry + PostHog configured
- [ ] Pricing page live
- [ ] Terms + Privacy published
- [ ] Support email configured

**Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat: add marketing landing page and complete launch preparation"
```

---

## Full Task Dependency Graph

```
PHASE A-G (MVP Foundation — Tasks 1-15)
  │
  ├── PHASE H (Task 16: Crawl History & Comparison)
  │     Depends on: Tasks 3, 6, 11
  │
  ├── PHASE I (Tasks 17-18: Stripe Billing Full + Usage Metering)
  │     Depends on: Tasks 2, 3, 6
  │
  ├── PHASE J (Tasks 19-20: AI Visibility Tracking)
  │     Depends on: Tasks 5, 6, 11
  │
  ├── PHASE K (Tasks 21-24: Scheduled Crawls, Email, Analytics, Sentry)
  │     Depends on: Tasks 6, 9, 11
  │     Tasks 21-24 are independent of each other — parallelize
  │
  └── PHASE L (Tasks 25-28: Reports, Competitors, Onboarding, Marketing)
        Depends on: Tasks 17, 20
        Tasks 25-28 are mostly independent — parallelize

TASK 15 (E2E Integration) — do this AFTER Tasks 1-14
FINAL E2E VALIDATION — do this AFTER all 28 tasks
```

**Parallelizable work after MVP (Tasks 1-15):**

- Track D: Tasks 16 + 17 + 18 (History + Billing)
- Track E: Tasks 19 + 20 (Visibility)
- Track F: Tasks 21 + 22 + 23 + 24 (Scheduled, Email, Analytics, Sentry — all independent)
- Track G: Tasks 25 + 26 + 27 + 28 (Reports, Competitors, Onboarding, Marketing — mostly independent)
