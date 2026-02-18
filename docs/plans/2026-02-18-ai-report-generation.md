# AI Report Generation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an AI narrative generation layer that transforms structured scoring data into prose-driven analysis, served across PDF reports, dashboard cards, and a standalone AI Analysis page.

**Architecture:** A new `packages/narrative` package contains a `NarrativeEngine` that generates 8 section types in parallel via Anthropic LLM calls. Narratives are stored in a `narrative_reports` Postgres table (JSONB sections) and consumed by the API, existing report templates, and new frontend components. Pro tier gets read-only (Haiku), Agency gets editable (Sonnet) via TipTap.

**Tech Stack:** TypeScript, Anthropic SDK, Drizzle ORM (Neon PG), Hono (Cloudflare Workers), Next.js (App Router), TipTap, Vitest

**Design Doc:** `docs/plans/2026-02-18-ai-report-generation-design.md`

---

## Task 1: Shared Types & Zod Schemas

**Files:**

- Create: `packages/shared/src/schemas/narrative.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the Zod schemas and types**

Create `packages/shared/src/schemas/narrative.ts`:

```ts
import { z } from "zod";

export const narrativeToneValues = ["technical", "business"] as const;
export type NarrativeTone = (typeof narrativeToneValues)[number];

export const narrativeStatusValues = [
  "pending",
  "generating",
  "ready",
  "failed",
] as const;
export type NarrativeStatus = (typeof narrativeStatusValues)[number];

export const narrativeSectionTypeValues = [
  "executive_summary",
  "technical_analysis",
  "content_analysis",
  "ai_readiness_analysis",
  "performance_analysis",
  "trend_analysis",
  "competitive_positioning",
  "priority_recommendations",
] as const;
export type NarrativeSectionType = (typeof narrativeSectionTypeValues)[number];

export const NarrativeSectionSchema = z.object({
  id: z.string(),
  type: z.enum(narrativeSectionTypeValues),
  title: z.string(),
  content: z.string(),
  editedContent: z.string().nullable().optional(),
  order: z.number(),
  dataContext: z.record(z.unknown()),
});
export type NarrativeSection = z.infer<typeof NarrativeSectionSchema>;

export const GenerateNarrativeSchema = z.object({
  crawlJobId: z.string().uuid(),
  tone: z.enum(narrativeToneValues).default("technical"),
});
export type GenerateNarrativeInput = z.infer<typeof GenerateNarrativeSchema>;

export const EditNarrativeSectionSchema = z.object({
  editedContent: z.string().nullable(),
});
export type EditNarrativeSectionInput = z.infer<
  typeof EditNarrativeSectionSchema
>;

export const RegenerateNarrativeSectionSchema = z.object({
  instructions: z.string().max(500).optional(),
});
export type RegenerateNarrativeSectionInput = z.infer<
  typeof RegenerateNarrativeSectionSchema
>;

export interface NarrativeReportMeta {
  id: string;
  crawlJobId: string;
  projectId: string;
  tone: NarrativeTone;
  status: NarrativeStatus;
  sections: NarrativeSection[];
  version: number;
  generatedBy: string | null;
  tokenUsage: { input: number; output: number; costCents: number } | null;
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Export from shared index**

Add to `packages/shared/src/index.ts`:

```ts
export * from "./schemas/narrative";
```

**Step 3: Run typecheck**

Run: `pnpm --filter shared typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared/src/schemas/narrative.ts packages/shared/src/index.ts
git commit -m "feat(shared): add narrative Zod schemas and types"
```

---

## Task 2: Database Schema — `narrative_reports` Table

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Add enums and table to schema**

Add to `packages/db/src/schema.ts` in the Enums section:

```ts
export const narrativeToneEnum = pgEnum("narrative_tone", [
  "technical",
  "business",
]);

export const narrativeStatusEnum = pgEnum("narrative_status", [
  "pending",
  "generating",
  "ready",
  "failed",
]);
```

Add to the Tables section:

```ts
export const narrativeReports = pgTable(
  "narrative_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crawlJobId: uuid("crawl_job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tone: narrativeToneEnum("tone").notNull(),
    status: narrativeStatusEnum("status").notNull().default("pending"),
    sections: jsonb("sections").default([]),
    version: integer("version").notNull().default(1),
    generatedBy: text("generated_by"),
    tokenUsage: jsonb("token_usage"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_narrative_reports_crawl").on(t.crawlJobId),
    index("idx_narrative_reports_project").on(t.projectId),
  ],
);
```

**Step 2: Run typecheck**

Run: `pnpm --filter db typecheck`
Expected: PASS

**Step 3: Push schema to Neon**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Table `narrative_reports` created with enums

**Step 4: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add narrative_reports table with tone and status enums"
```

---

## Task 3: Database Query Helpers — `narrativeQueries`

**Files:**

- Create: `packages/db/src/queries/narratives.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Write failing test**

Create `packages/db/src/__tests__/narratives.test.ts` — skip for now since DB queries are integration-tested. We'll test through the service layer.

**Step 2: Write the query helpers**

Create `packages/db/src/queries/narratives.ts`:

```ts
import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "../client";
import { narrativeReports } from "../schema";

export function narrativeQueries(db: Database) {
  return {
    async create(data: typeof narrativeReports.$inferInsert) {
      const [row] = await db.insert(narrativeReports).values(data).returning();
      return row;
    },

    async getByCrawlAndTone(crawlJobId: string, tone: string) {
      return db.query.narrativeReports.findFirst({
        where: and(
          eq(narrativeReports.crawlJobId, crawlJobId),
          eq(narrativeReports.tone, tone as "technical" | "business"),
        ),
        orderBy: [desc(narrativeReports.version)],
      });
    },

    async getById(id: string) {
      return db.query.narrativeReports.findFirst({
        where: eq(narrativeReports.id, id),
      });
    },

    async listByProject(projectId: string, limit = 20) {
      return db
        .select()
        .from(narrativeReports)
        .where(eq(narrativeReports.projectId, projectId))
        .orderBy(desc(narrativeReports.createdAt))
        .limit(limit);
    },

    async updateStatus(
      id: string,
      status: "pending" | "generating" | "ready" | "failed",
      extra?: Partial<typeof narrativeReports.$inferInsert>,
    ) {
      const [row] = await db
        .update(narrativeReports)
        .set({ status, updatedAt: new Date(), ...extra })
        .where(eq(narrativeReports.id, id))
        .returning();
      return row;
    },

    async updateSections(id: string, sections: unknown[]) {
      const [row] = await db
        .update(narrativeReports)
        .set({ sections, updatedAt: new Date() })
        .where(eq(narrativeReports.id, id))
        .returning();
      return row;
    },

    async getLatestVersion(crawlJobId: string, tone: string) {
      const rows = await db
        .select({
          maxVersion: sql<number>`coalesce(max(${narrativeReports.version}), 0)`,
        })
        .from(narrativeReports)
        .where(
          and(
            eq(narrativeReports.crawlJobId, crawlJobId),
            eq(narrativeReports.tone, tone as "technical" | "business"),
          ),
        );
      return rows[0]?.maxVersion ?? 0;
    },

    async delete(id: string) {
      await db.delete(narrativeReports).where(eq(narrativeReports.id, id));
    },
  };
}
```

**Step 3: Export from db index**

Add to `packages/db/src/index.ts`:

```ts
export { narrativeQueries } from "./queries/narratives";
```

**Step 4: Ensure `narrativeReports` has a Drizzle relation for `.query`**

Check if `packages/db/src/schema.ts` has a relations block. If there's a `relations` export for other tables, add one for `narrativeReports`:

```ts
import { relations } from "drizzle-orm";

export const narrativeReportsRelations = relations(
  narrativeReports,
  ({ one }) => ({
    crawlJob: one(crawlJobs, {
      fields: [narrativeReports.crawlJobId],
      references: [crawlJobs.id],
    }),
    project: one(projects, {
      fields: [narrativeReports.projectId],
      references: [projects.id],
    }),
  }),
);
```

**Step 5: Run typecheck**

Run: `pnpm --filter db typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/db/src/queries/narratives.ts packages/db/src/index.ts packages/db/src/schema.ts
git commit -m "feat(db): add narrativeQueries helper and relations"
```

---

## Task 4: Scaffold `packages/narrative`

**Files:**

- Create: `packages/narrative/package.json`
- Create: `packages/narrative/tsconfig.json`
- Create: `packages/narrative/src/index.ts`
- Create: `packages/narrative/src/types.ts`

**Step 1: Create package.json**

```json
{
  "name": "@llm-boost/narrative",
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
    "@llm-boost/shared": "workspace:*",
    "@anthropic-ai/sdk": "^0.39"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create types.ts**

Create `packages/narrative/src/types.ts`:

```ts
import type {
  NarrativeSection,
  NarrativeSectionType,
  NarrativeTone,
} from "@llm-boost/shared";

export interface CategoryScores {
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
}

export interface CrawlJobSummary {
  id: string;
  domain: string;
  overallScore: number;
  letterGrade: string;
  pagesScored: number;
  categoryScores: CategoryScores;
}

export interface IssueSummary {
  code: string;
  category: string;
  severity: string;
  message: string;
  recommendation: string;
  affectedPages: number;
  scoreImpact: number;
}

export interface QuickWin {
  code: string;
  message: string;
  recommendation: string;
  scoreImpact: number;
  pillar: string;
}

export interface ContentHealthMetrics {
  avgWordCount: number;
  avgClarity: number;
  avgAuthority: number;
  avgComprehensiveness: number;
  avgStructure: number;
  avgCitationWorthiness: number;
}

export interface CompetitorData {
  domain: string;
  mentionCount: number;
  platforms: string[];
  queries: string[];
}

export interface PageScoreSummary {
  url: string;
  title: string;
  overallScore: number;
  letterGrade: string;
  issueCount: number;
}

export interface NarrativeInput {
  tone: NarrativeTone;
  crawlJob: CrawlJobSummary;
  categoryScores: CategoryScores;
  issues: IssueSummary[];
  quickWins: QuickWin[];
  contentHealth: ContentHealthMetrics;
  previousCrawl?: CrawlJobSummary;
  competitors?: CompetitorData[];
  pages: PageScoreSummary[];
}

export interface NarrativeReport {
  sections: NarrativeSection[];
  tokenUsage: TokenUsage;
  generatedBy: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  costCents: number;
}

export interface SectionGenerator {
  type: NarrativeSectionType;
  title: string;
  order: number;
  shouldGenerate(input: NarrativeInput): boolean;
  generate(input: NarrativeInput, model: string): Promise<NarrativeSection>;
}
```

**Step 4: Create index.ts**

Create `packages/narrative/src/index.ts`:

```ts
export { NarrativeEngine } from "./engine";
export type { NarrativeEngineOptions } from "./engine";
export type {
  NarrativeInput,
  NarrativeReport,
  TokenUsage,
  CategoryScores,
  CrawlJobSummary,
  IssueSummary,
  QuickWin,
  ContentHealthMetrics,
  CompetitorData,
  PageScoreSummary,
} from "./types";
```

**Step 5: Install dependencies**

Run: `pnpm install`
Expected: Workspace packages linked

**Step 6: Commit**

```bash
git add packages/narrative/
git commit -m "feat(narrative): scaffold package with types and package.json"
```

---

## Task 5: Prompt Templates & Tone Adapters

**Files:**

- Create: `packages/narrative/src/prompts/base-prompt.ts`
- Create: `packages/narrative/src/prompts/tone-adapters.ts`
- Create: `packages/narrative/src/prompts/section-prompts.ts`

**Step 1: Write base prompt**

Create `packages/narrative/src/prompts/base-prompt.ts`:

```ts
export const BASE_SYSTEM_PROMPT = `You are an expert SEO and AI-readiness analyst writing a professional report section. Your analysis must be:
- Data-driven: reference specific scores, percentages, and metrics
- Actionable: every finding should connect to a clear next step
- Honest: don't sugarcoat poor scores, but frame them as opportunities
- Structured: use clear paragraphs, no bullet-point lists unless for recommendations

Output ONLY the narrative content as HTML. Use <p>, <strong>, <em>, <h3>, <h4>, <ul>/<li> tags.
Do NOT include the section title — it will be added by the application.
Do NOT wrap in markdown code fences.`;
```

**Step 2: Write tone adapters**

Create `packages/narrative/src/prompts/tone-adapters.ts`:

```ts
import type { NarrativeTone } from "@llm-boost/shared";

const TECHNICAL_ADAPTER = `Write for an SEO professional audience. Use technical SEO terminology directly:
- Reference specific factors (canonical tags, schema markup, robots.txt, LLMs.txt, Core Web Vitals)
- Include code-level recommendations where relevant (e.g., "add <link rel='canonical'> to...")
- Use precise metric names (LCP, FCP, CLS, TBT)
- Reference scoring categories by name (Technical SEO, Content Quality, AI Readiness, Performance)`;

const BUSINESS_ADAPTER = `Write for a business stakeholder audience (CMO, VP Marketing, CEO). Translate all technical findings into business impact:
- Frame scores as competitive positioning ("your site ranks in the top 20% for AI readiness")
- Translate technical issues into revenue risk or opportunity cost
- Use analogies to explain technical concepts
- Focus on ROI, competitive advantage, and brand visibility
- Avoid jargon — say "search visibility" not "crawl budget", "AI citations" not "LLM citeability"`;

export function getToneAdapter(tone: NarrativeTone): string {
  return tone === "technical" ? TECHNICAL_ADAPTER : BUSINESS_ADAPTER;
}
```

**Step 3: Write section prompts**

Create `packages/narrative/src/prompts/section-prompts.ts`:

```ts
export const SECTION_PROMPTS: Record<string, string> = {
  executive_summary: `Write a 200-300 word executive summary of this website's AI readiness audit.
Include: the overall score and grade, the strongest and weakest category, the single most impactful finding, and a forward-looking statement about what improvement is possible.`,

  technical_analysis: `Write a 300-500 word analysis of the site's technical SEO health.
Cover: crawlability, indexability, schema markup, canonical setup, robots.txt/LLMs.txt, and any critical technical blockers. Reference the technical score and specific issues found.`,

  content_analysis: `Write a 300-500 word analysis of the site's content quality.
Cover: content depth (word count trends), clarity and readability scores, authority signals, structure quality, and citation worthiness. Reference the LLM content dimension scores.`,

  ai_readiness_analysis: `Write a 300-500 word analysis of the site's AI readiness.
Cover: discoverability by AI crawlers, content citeability, structured data for AI consumption, LLMs.txt presence, and AI crawler access. This is the most differentiating category for this platform.`,

  performance_analysis: `Write a 200-300 word analysis of the site's performance.
Cover: Core Web Vitals (LCP, FCP, CLS, TBT), Lighthouse scores, and how performance impacts both traditional SEO and AI crawler access.`,

  trend_analysis: `Write a 200-400 word trend analysis comparing the current crawl to the previous one.
Highlight: which scores improved or declined, the likely causes based on issue changes, and momentum indicators. Frame improvements positively and regressions as priorities.`,

  competitive_positioning: `Write a 200-400 word competitive positioning analysis.
Cover: how the site compares to tracked competitors in AI visibility, which competitors appear more frequently in LLM responses, and specific competitive gaps or advantages.`,

  priority_recommendations: `Write a 400-600 word prioritized action plan.
Structure as a numbered list of 5-8 recommendations ordered by ROI (score impact vs effort). Each recommendation should include: what to do, why it matters, expected score impact, and estimated effort level.`,
};
```

**Step 4: Commit**

```bash
git add packages/narrative/src/prompts/
git commit -m "feat(narrative): add prompt templates and tone adapters"
```

---

## Task 6: Section Generators

**Files:**

- Create: `packages/narrative/src/utils/data-selector.ts`
- Create: `packages/narrative/src/utils/token-tracker.ts`
- Create: `packages/narrative/src/sections/index.ts`

**Step 1: Write data-selector utility**

Create `packages/narrative/src/utils/data-selector.ts`:

```ts
import type { NarrativeInput } from "../types";
import type { NarrativeSectionType } from "@llm-boost/shared";

export function selectDataForSection(
  type: NarrativeSectionType,
  input: NarrativeInput,
): Record<string, unknown> {
  const base = {
    domain: input.crawlJob.domain,
    overallScore: input.crawlJob.overallScore,
    letterGrade: input.crawlJob.letterGrade,
    pagesScored: input.crawlJob.pagesScored,
  };

  switch (type) {
    case "executive_summary":
      return {
        ...base,
        categoryScores: input.categoryScores,
        topIssues: input.issues.slice(0, 5),
        quickWins: input.quickWins.slice(0, 3),
      };
    case "technical_analysis":
      return {
        ...base,
        technicalScore: input.categoryScores.technical,
        issues: input.issues.filter((i) => i.category === "technical"),
      };
    case "content_analysis":
      return {
        ...base,
        contentScore: input.categoryScores.content,
        contentHealth: input.contentHealth,
        issues: input.issues.filter((i) => i.category === "content"),
      };
    case "ai_readiness_analysis":
      return {
        ...base,
        aiReadinessScore: input.categoryScores.aiReadiness,
        issues: input.issues.filter((i) => i.category === "ai_readiness"),
      };
    case "performance_analysis":
      return {
        ...base,
        performanceScore: input.categoryScores.performance,
        issues: input.issues.filter((i) => i.category === "performance"),
      };
    case "trend_analysis":
      return {
        ...base,
        categoryScores: input.categoryScores,
        previousCrawl: input.previousCrawl,
      };
    case "competitive_positioning":
      return {
        ...base,
        competitors: input.competitors,
      };
    case "priority_recommendations":
      return {
        ...base,
        quickWins: input.quickWins,
        topIssues: input.issues
          .sort((a, b) => b.scoreImpact - a.scoreImpact)
          .slice(0, 10),
        topPages: input.pages.slice(0, 5),
        bottomPages: input.pages.slice(-5),
      };
    default:
      return base;
  }
}
```

**Step 2: Write token-tracker utility**

Create `packages/narrative/src/utils/token-tracker.ts`:

```ts
import type { TokenUsage } from "../types";

// Approximate cost per 1M tokens (Anthropic pricing as of 2026)
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = COST_PER_1M[model] ?? COST_PER_1M["claude-sonnet-4-6"];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 100); // cents
}

export function mergeTokenUsage(usages: TokenUsage[]): TokenUsage {
  return usages.reduce(
    (acc, u) => ({
      input: acc.input + u.input,
      output: acc.output + u.output,
      costCents: acc.costCents + u.costCents,
    }),
    { input: 0, output: 0, costCents: 0 },
  );
}
```

**Step 3: Write section generators index**

Create `packages/narrative/src/sections/index.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { NarrativeSection, NarrativeSectionType } from "@llm-boost/shared";
import type { NarrativeInput, TokenUsage } from "../types";
import { BASE_SYSTEM_PROMPT } from "../prompts/base-prompt";
import { getToneAdapter } from "../prompts/tone-adapters";
import { SECTION_PROMPTS } from "../prompts/section-prompts";
import { selectDataForSection } from "../utils/data-selector";
import { calculateCost } from "../utils/token-tracker";
import { randomUUID } from "node:crypto";

interface SectionConfig {
  type: NarrativeSectionType;
  title: string;
  order: number;
  shouldGenerate: (input: NarrativeInput) => boolean;
}

const SECTION_CONFIGS: SectionConfig[] = [
  {
    type: "executive_summary",
    title: "Executive Summary",
    order: 0,
    shouldGenerate: () => true,
  },
  {
    type: "technical_analysis",
    title: "Technical SEO Analysis",
    order: 1,
    shouldGenerate: () => true,
  },
  {
    type: "content_analysis",
    title: "Content Quality Analysis",
    order: 2,
    shouldGenerate: () => true,
  },
  {
    type: "ai_readiness_analysis",
    title: "AI Readiness Analysis",
    order: 3,
    shouldGenerate: () => true,
  },
  {
    type: "performance_analysis",
    title: "Performance Analysis",
    order: 4,
    shouldGenerate: () => true,
  },
  {
    type: "trend_analysis",
    title: "Trend Analysis",
    order: 5,
    shouldGenerate: (input) => !!input.previousCrawl,
  },
  {
    type: "competitive_positioning",
    title: "Competitive Positioning",
    order: 6,
    shouldGenerate: (input) =>
      !!input.competitors && input.competitors.length > 0,
  },
  {
    type: "priority_recommendations",
    title: "Priority Recommendations",
    order: 7,
    shouldGenerate: () => true,
  },
];

export function getApplicableSections(input: NarrativeInput): SectionConfig[] {
  return SECTION_CONFIGS.filter((c) => c.shouldGenerate(input));
}

export async function generateSection(
  client: Anthropic,
  config: SectionConfig,
  input: NarrativeInput,
  model: string,
): Promise<{ section: NarrativeSection; tokenUsage: TokenUsage }> {
  const dataContext = selectDataForSection(config.type, input);
  const toneAdapter = getToneAdapter(input.tone);

  const userPrompt = `${SECTION_PROMPTS[config.type]}

Here is the data for your analysis:

${JSON.stringify(dataContext, null, 2)}`;

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: `${BASE_SYSTEM_PROMPT}\n\n${toneAdapter}`,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content =
    response.content[0].type === "text" ? response.content[0].text : "";

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  return {
    section: {
      id: randomUUID(),
      type: config.type,
      title: config.title,
      content,
      editedContent: null,
      order: config.order,
      dataContext,
    },
    tokenUsage: {
      input: inputTokens,
      output: outputTokens,
      costCents: calculateCost(model, inputTokens, outputTokens),
    },
  };
}
```

**Step 4: Commit**

```bash
git add packages/narrative/src/utils/ packages/narrative/src/sections/
git commit -m "feat(narrative): add section generators, data selector, token tracker"
```

---

## Task 7: NarrativeEngine Orchestrator

**Files:**

- Create: `packages/narrative/src/engine.ts`

**Step 1: Write failing test**

Create `packages/narrative/src/__tests__/engine.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  }));
  return { default: MockAnthropic };
});

import { NarrativeEngine } from "../engine";
import Anthropic from "@anthropic-ai/sdk";
import type { NarrativeInput } from "../types";

function makeInput(overrides: Partial<NarrativeInput> = {}): NarrativeInput {
  return {
    tone: "technical",
    crawlJob: {
      id: "crawl-1",
      domain: "example.com",
      overallScore: 75,
      letterGrade: "C",
      pagesScored: 50,
      categoryScores: {
        technical: 80,
        content: 70,
        aiReadiness: 65,
        performance: 85,
      },
    },
    categoryScores: {
      technical: 80,
      content: 70,
      aiReadiness: 65,
      performance: 85,
    },
    issues: [
      {
        code: "MISSING_LLMS_TXT",
        category: "ai_readiness",
        severity: "critical",
        message: "No LLMs.txt",
        recommendation: "Add LLMs.txt",
        affectedPages: 50,
        scoreImpact: 15,
      },
    ],
    quickWins: [
      {
        code: "MISSING_LLMS_TXT",
        message: "No LLMs.txt",
        recommendation: "Add LLMs.txt",
        scoreImpact: 15,
        pillar: "ai_readiness",
      },
    ],
    contentHealth: {
      avgWordCount: 800,
      avgClarity: 75,
      avgAuthority: 70,
      avgComprehensiveness: 65,
      avgStructure: 80,
      avgCitationWorthiness: 60,
    },
    pages: [
      {
        url: "https://example.com/",
        title: "Home",
        overallScore: 80,
        letterGrade: "B",
        issueCount: 3,
      },
    ],
    ...overrides,
  };
}

describe("NarrativeEngine", () => {
  let engine: NarrativeEngine;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new NarrativeEngine({ anthropicApiKey: "test-key" });
    const instance = (Anthropic as unknown as ReturnType<typeof vi.fn>).mock
      .results[0].value;
    mockCreate = instance.messages.create;
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "<p>Analysis content here.</p>" }],
      usage: { input_tokens: 500, output_tokens: 200 },
    });
  });

  it("generates sections for all applicable types", async () => {
    const result = await engine.generate(makeInput());
    // No previousCrawl or competitors, so 6 sections (not trend or competitive)
    expect(result.sections).toHaveLength(6);
    expect(result.sections[0].type).toBe("executive_summary");
    expect(result.sections[5].type).toBe("priority_recommendations");
  });

  it("includes trend_analysis when previousCrawl is provided", async () => {
    const input = makeInput({
      previousCrawl: {
        id: "crawl-0",
        domain: "example.com",
        overallScore: 60,
        letterGrade: "D",
        pagesScored: 40,
        categoryScores: {
          technical: 65,
          content: 55,
          aiReadiness: 50,
          performance: 70,
        },
      },
    });
    const result = await engine.generate(input);
    const types = result.sections.map((s) => s.type);
    expect(types).toContain("trend_analysis");
  });

  it("includes competitive_positioning when competitors are provided", async () => {
    const input = makeInput({
      competitors: [
        {
          domain: "rival.com",
          mentionCount: 10,
          platforms: ["chatgpt"],
          queries: ["test query"],
        },
      ],
    });
    const result = await engine.generate(input);
    const types = result.sections.map((s) => s.type);
    expect(types).toContain("competitive_positioning");
  });

  it("tracks total token usage across sections", async () => {
    const result = await engine.generate(makeInput());
    expect(result.tokenUsage.input).toBe(500 * 6);
    expect(result.tokenUsage.output).toBe(200 * 6);
    expect(result.tokenUsage.costCents).toBeGreaterThan(0);
  });

  it("handles partial failures gracefully", async () => {
    let callCount = 0;
    mockCreate.mockImplementation(() => {
      callCount++;
      if (callCount === 3) throw new Error("LLM unavailable");
      return Promise.resolve({
        content: [{ type: "text", text: "<p>OK</p>" }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });
    });
    const result = await engine.generate(makeInput());
    expect(result.sections).toHaveLength(5); // 6 - 1 failed
  });

  it("regenerates a single section with custom instructions", async () => {
    const section = await engine.regenerateSection(
      "executive_summary",
      makeInput(),
      "Focus more on mobile performance",
    );
    expect(section.type).toBe("executive_summary");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain(
      "Focus more on mobile performance",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @llm-boost/narrative test`
Expected: FAIL — `engine.ts` does not exist yet

**Step 3: Write NarrativeEngine**

Create `packages/narrative/src/engine.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { NarrativeSection, NarrativeSectionType } from "@llm-boost/shared";
import type { NarrativeInput, NarrativeReport, TokenUsage } from "./types";
import { getApplicableSections, generateSection } from "./sections";
import { mergeTokenUsage } from "./utils/token-tracker";
import { SECTION_PROMPTS } from "./prompts/section-prompts";
import { BASE_SYSTEM_PROMPT } from "./prompts/base-prompt";
import { getToneAdapter } from "./prompts/tone-adapters";
import { selectDataForSection } from "./utils/data-selector";
import { calculateCost } from "./utils/token-tracker";
import { randomUUID } from "node:crypto";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface NarrativeEngineOptions {
  anthropicApiKey: string;
  model?: string;
}

export class NarrativeEngine {
  private client: Anthropic;
  private model: string;

  constructor(options: NarrativeEngineOptions) {
    this.client = new Anthropic({ apiKey: options.anthropicApiKey });
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async generate(input: NarrativeInput): Promise<NarrativeReport> {
    const applicableSections = getApplicableSections(input);

    const results = await Promise.allSettled(
      applicableSections.map((config) =>
        generateSection(this.client, config, input, this.model),
      ),
    );

    const sections: NarrativeSection[] = [];
    const tokenUsages: TokenUsage[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        sections.push(result.value.section);
        tokenUsages.push(result.value.tokenUsage);
      }
      // Failed sections are silently skipped — partial generation is valid
    }

    sections.sort((a, b) => a.order - b.order);

    return {
      sections,
      tokenUsage: mergeTokenUsage(tokenUsages),
      generatedBy: this.model,
    };
  }

  async regenerateSection(
    sectionType: NarrativeSectionType,
    input: NarrativeInput,
    instructions?: string,
  ): Promise<NarrativeSection> {
    const config = getApplicableSections(input).find(
      (c) => c.type === sectionType,
    );
    if (!config) {
      throw new Error(
        `Section type "${sectionType}" is not applicable for this input`,
      );
    }

    const dataContext = selectDataForSection(config.type, input);
    const toneAdapter = getToneAdapter(input.tone);

    let userPrompt = `${SECTION_PROMPTS[config.type]}

Here is the data for your analysis:

${JSON.stringify(dataContext, null, 2)}`;

    if (instructions) {
      userPrompt += `\n\nAdditional instructions from the user: ${instructions}`;
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: `${BASE_SYSTEM_PROMPT}\n\n${toneAdapter}`,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    return {
      id: randomUUID(),
      type: config.type,
      title: config.title,
      content,
      editedContent: null,
      order: config.order,
      dataContext,
    };
  }
}
```

**Step 4: Run tests**

Run: `pnpm --filter @llm-boost/narrative test`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add packages/narrative/src/engine.ts packages/narrative/src/__tests__/
git commit -m "feat(narrative): implement NarrativeEngine with parallel generation and tests"
```

---

## Task 8: API Repository & Service

**Files:**

- Modify: `apps/api/src/repositories/index.ts` (add narrative repository)
- Create: `apps/api/src/services/narrative-service.ts`

**Step 1: Add NarrativeRepository**

Add to `apps/api/src/repositories/index.ts`:

```ts
import { narrativeQueries } from "@llm-boost/db";

// Add to existing exports:
export interface NarrativeRepository {
  create: ReturnType<typeof narrativeQueries>["create"];
  getById: ReturnType<typeof narrativeQueries>["getById"];
  getByCrawlAndTone: ReturnType<typeof narrativeQueries>["getByCrawlAndTone"];
  listByProject: ReturnType<typeof narrativeQueries>["listByProject"];
  updateStatus: ReturnType<typeof narrativeQueries>["updateStatus"];
  updateSections: ReturnType<typeof narrativeQueries>["updateSections"];
  getLatestVersion: ReturnType<typeof narrativeQueries>["getLatestVersion"];
  delete: ReturnType<typeof narrativeQueries>["delete"];
}

export function createNarrativeRepository(db: Database): NarrativeRepository {
  return narrativeQueries(db);
}
```

**Step 2: Create narrative-service.ts**

Create `apps/api/src/services/narrative-service.ts`:

```ts
import { ServiceError } from "./errors";
import { NarrativeEngine } from "@llm-boost/narrative";
import type { NarrativeInput } from "@llm-boost/narrative";
import type { NarrativeSectionType, NarrativeTone } from "@llm-boost/shared";
import type {
  NarrativeRepository,
  ProjectRepository,
  UserRepository,
  CrawlRepository,
} from "../repositories";

interface Deps {
  narratives: NarrativeRepository;
  projects: ProjectRepository;
  users: UserRepository;
  crawls: CrawlRepository;
}

interface NarrativeEnv {
  anthropicApiKey: string;
}

function getModelForPlan(plan: string): string {
  return plan === "agency" ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001";
}

export function createNarrativeService(deps: Deps) {
  return {
    async generate(
      userId: string,
      crawlJobId: string,
      tone: NarrativeTone,
      env: NarrativeEnv,
    ) {
      // 1. Verify crawl exists and is complete
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) {
        throw new ServiceError("NOT_FOUND", 404, "Crawl job not found");
      }

      // 2. Verify project ownership
      const project = await deps.projects.getById(crawl.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      if (crawl.status !== "complete") {
        throw new ServiceError(
          "INVALID_STATE",
          409,
          "Crawl must be complete before generating a narrative",
        );
      }

      // 3. Check plan — Pro or Agency only
      const user = await deps.users.getById(userId);
      if (!user) {
        throw new ServiceError("NOT_FOUND", 404, "User not found");
      }
      if (user.plan !== "pro" && user.plan !== "agency") {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "AI narrative reports require a Pro or Agency plan",
        );
      }

      // 4. Check if already exists for this crawl+tone
      const existing = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        tone,
      );
      if (existing && existing.status === "generating") {
        throw new ServiceError(
          "CONFLICT",
          409,
          "Narrative generation already in progress",
        );
      }

      // 5. Create record
      const version =
        (await deps.narratives.getLatestVersion(crawlJobId, tone)) + 1;
      const record = await deps.narratives.create({
        crawlJobId,
        projectId: crawl.projectId,
        tone,
        status: "pending",
        version,
        sections: [],
      });

      // 6. Generate (async — in production this would be dispatched to a queue)
      const model = getModelForPlan(user.plan);
      const engine = new NarrativeEngine({
        anthropicApiKey: env.anthropicApiKey,
        model,
      });

      await deps.narratives.updateStatus(record.id, "generating");

      try {
        const narrativeInput = buildNarrativeInput(crawl, tone);
        const result = await engine.generate(narrativeInput);

        await deps.narratives.updateStatus(record.id, "ready", {
          sections: result.sections as any,
          generatedBy: result.generatedBy,
          tokenUsage: result.tokenUsage as any,
        });

        return {
          ...record,
          status: "ready" as const,
          sections: result.sections,
        };
      } catch (error) {
        await deps.narratives.updateStatus(record.id, "failed");
        throw new ServiceError(
          "GENERATION_FAILED",
          502,
          "Narrative generation failed",
        );
      }
    },

    async get(userId: string, crawlJobId: string, tone: NarrativeTone) {
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");

      const project = await deps.projects.getById(crawl.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      const narrative = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        tone,
      );
      if (!narrative) {
        throw new ServiceError("NOT_FOUND", 404, "Narrative not found");
      }
      return narrative;
    },

    async editSection(
      userId: string,
      crawlJobId: string,
      sectionId: string,
      editedContent: string | null,
    ) {
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");

      const project = await deps.projects.getById(crawl.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      // Agency only
      const user = await deps.users.getById(userId);
      if (!user || user.plan !== "agency") {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "Editing narratives requires an Agency plan",
        );
      }

      // Find the narrative that contains this section
      const narratives = await deps.narratives.listByProject(
        crawl.projectId,
        50,
      );
      const narrative = narratives.find((n) =>
        (n.sections as any[])?.some((s: any) => s.id === sectionId),
      );
      if (!narrative) {
        throw new ServiceError("NOT_FOUND", 404, "Section not found");
      }

      const updatedSections = (narrative.sections as any[]).map((s: any) =>
        s.id === sectionId ? { ...s, editedContent } : s,
      );

      return deps.narratives.updateSections(narrative.id, updatedSections);
    },

    async regenerateSection(
      userId: string,
      crawlJobId: string,
      sectionType: NarrativeSectionType,
      instructions: string | undefined,
      env: NarrativeEnv,
    ) {
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");

      const project = await deps.projects.getById(crawl.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      const user = await deps.users.getById(userId);
      if (!user) throw new ServiceError("NOT_FOUND", 404, "User not found");

      // Find the existing narrative
      const narrative = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        "technical", // default — could be parameterized
      );
      if (!narrative) {
        throw new ServiceError("NOT_FOUND", 404, "Narrative not found");
      }

      // Always use Sonnet for regeneration with instructions
      const model = instructions
        ? "claude-sonnet-4-6"
        : getModelForPlan(user.plan);

      const engine = new NarrativeEngine({
        anthropicApiKey: env.anthropicApiKey,
        model,
      });

      const narrativeInput = buildNarrativeInput(crawl, narrative.tone);
      const newSection = await engine.regenerateSection(
        sectionType,
        narrativeInput,
        instructions,
      );

      // Replace the section in the array
      const updatedSections = (narrative.sections as any[]).map((s: any) =>
        s.type === sectionType ? newSection : s,
      );

      await deps.narratives.updateSections(narrative.id, updatedSections);
      return newSection;
    },

    async delete(userId: string, crawlJobId: string) {
      const crawl = await deps.crawls.getById(crawlJobId);
      if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");

      const project = await deps.projects.getById(crawl.projectId);
      if (!project || project.userId !== userId) {
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      }

      const narrative = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        "technical",
      );
      if (narrative) await deps.narratives.delete(narrative.id);

      const businessNarrative = await deps.narratives.getByCrawlAndTone(
        crawlJobId,
        "business",
      );
      if (businessNarrative) await deps.narratives.delete(businessNarrative.id);
    },
  };
}

// Helper: build NarrativeInput from crawl data
// This extracts the relevant data from the crawl job's summaryData JSON
function buildNarrativeInput(crawl: any, tone: NarrativeTone): NarrativeInput {
  const summary = crawl.summaryData ?? {};
  return {
    tone,
    crawlJob: {
      id: crawl.id,
      domain: summary.domain ?? crawl.domain ?? "unknown",
      overallScore: summary.overallScore ?? 0,
      letterGrade: summary.letterGrade ?? "F",
      pagesScored: crawl.pagesScored ?? 0,
      categoryScores: summary.categoryScores ?? {
        technical: 0,
        content: 0,
        aiReadiness: 0,
        performance: 0,
      },
    },
    categoryScores: summary.categoryScores ?? {
      technical: 0,
      content: 0,
      aiReadiness: 0,
      performance: 0,
    },
    issues: summary.issues ?? [],
    quickWins: summary.quickWins ?? [],
    contentHealth: summary.contentHealth ?? {
      avgWordCount: 0,
      avgClarity: 0,
      avgAuthority: 0,
      avgComprehensiveness: 0,
      avgStructure: 0,
      avgCitationWorthiness: 0,
    },
    previousCrawl: summary.previousCrawl,
    competitors: summary.competitors,
    pages: summary.topPages ?? [],
  };
}
```

**Step 3: Run typecheck**

Run: `pnpm --filter api typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/repositories/index.ts apps/api/src/services/narrative-service.ts
git commit -m "feat(api): add narrative repository and service"
```

---

## Task 9: API Routes

**Files:**

- Create: `apps/api/src/routes/narratives.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create narrative routes**

Create `apps/api/src/routes/narratives.ts`:

```ts
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  GenerateNarrativeSchema,
  EditNarrativeSectionSchema,
  RegenerateNarrativeSectionSchema,
} from "@llm-boost/shared";
import { narrativeQueries } from "@llm-boost/db";
import { createNarrativeService } from "../services/narrative-service";
import {
  createProjectRepository,
  createUserRepository,
  createCrawlRepository,
} from "../repositories";
import { handleServiceError } from "../services/errors";

export const narrativeRoutes = new Hono<AppEnv>();

narrativeRoutes.use("*", authMiddleware);

// POST /api/narratives/generate — Trigger narrative generation
narrativeRoutes.post("/generate", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();

  const parsed = GenerateNarrativeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const service = createNarrativeService({
    narratives: narrativeQueries(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    const result = await service.generate(
      userId,
      parsed.data.crawlJobId,
      parsed.data.tone,
      { anthropicApiKey: c.env.ANTHROPIC_API_KEY },
    );
    return c.json({ data: result }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// GET /api/narratives/:crawlJobId — Fetch narrative for a crawl
narrativeRoutes.get("/:crawlJobId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlJobId = c.req.param("crawlJobId");
  const tone = (c.req.query("tone") ?? "technical") as "technical" | "business";

  const service = createNarrativeService({
    narratives: narrativeQueries(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    const result = await service.get(userId, crawlJobId, tone);
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// PATCH /api/narratives/:crawlJobId/sections/:sectionId — Edit section (Agency)
narrativeRoutes.patch("/:crawlJobId/sections/:sectionId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlJobId = c.req.param("crawlJobId");
  const sectionId = c.req.param("sectionId");
  const body = await c.req.json();

  const parsed = EditNarrativeSectionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.flatten(),
        },
      },
      422,
    );
  }

  const service = createNarrativeService({
    narratives: narrativeQueries(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    const result = await service.editSection(
      userId,
      crawlJobId,
      sectionId,
      parsed.data.editedContent,
    );
    return c.json({ data: result });
  } catch (error) {
    return handleServiceError(c, error);
  }
});

// POST /api/narratives/:crawlJobId/sections/:sectionType/regenerate
narrativeRoutes.post(
  "/:crawlJobId/sections/:sectionType/regenerate",
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const crawlJobId = c.req.param("crawlJobId");
    const sectionType = c.req.param("sectionType");
    const body = await c.req.json().catch(() => ({}));

    const parsed = RegenerateNarrativeSectionSchema.safeParse(body);

    const service = createNarrativeService({
      narratives: narrativeQueries(db),
      projects: createProjectRepository(db),
      users: createUserRepository(db),
      crawls: createCrawlRepository(db),
    });

    try {
      const result = await service.regenerateSection(
        userId,
        crawlJobId,
        sectionType as any,
        parsed.success ? parsed.data.instructions : undefined,
        { anthropicApiKey: c.env.ANTHROPIC_API_KEY },
      );
      return c.json({ data: result });
    } catch (error) {
      return handleServiceError(c, error);
    }
  },
);

// DELETE /api/narratives/:crawlJobId
narrativeRoutes.delete("/:crawlJobId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlJobId = c.req.param("crawlJobId");

  const service = createNarrativeService({
    narratives: narrativeQueries(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    await service.delete(userId, crawlJobId);
    return c.json({ data: { deleted: true } });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 2: Register routes in API index**

Add to `apps/api/src/index.ts` imports:

```ts
import { narrativeRoutes } from "./routes/narratives";
```

Add to route registrations (near the report routes):

```ts
app.route("/api/narratives", narrativeRoutes);
```

**Step 3: Run typecheck**

Run: `pnpm --filter api typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/api/src/routes/narratives.ts apps/api/src/index.ts
git commit -m "feat(api): add narrative API routes (generate, get, edit, regenerate, delete)"
```

---

## Task 10: Frontend API Client

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add narrative API methods**

Add to the existing `api` object in `apps/web/src/lib/api.ts`:

```ts
narratives: {
  generate(crawlJobId: string, tone: "technical" | "business" = "technical") {
    return fetchApi<any>("/api/narratives/generate", {
      method: "POST",
      body: JSON.stringify({ crawlJobId, tone }),
    });
  },
  get(crawlJobId: string, tone: "technical" | "business" = "technical") {
    return fetchApi<any>(`/api/narratives/${crawlJobId}?tone=${tone}`);
  },
  editSection(crawlJobId: string, sectionId: string, editedContent: string | null) {
    return fetchApi<any>(`/api/narratives/${crawlJobId}/sections/${sectionId}`, {
      method: "PATCH",
      body: JSON.stringify({ editedContent }),
    });
  },
  regenerateSection(crawlJobId: string, sectionType: string, instructions?: string) {
    return fetchApi<any>(
      `/api/narratives/${crawlJobId}/sections/${sectionType}/regenerate`,
      {
        method: "POST",
        body: JSON.stringify({ instructions }),
      },
    );
  },
  delete(crawlJobId: string) {
    return fetchApi<any>(`/api/narratives/${crawlJobId}`, { method: "DELETE" });
  },
},
```

**Step 2: Run typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add narrative API client methods"
```

---

## Task 11: Phase 1 — Narrative Sections in PDF Reports

**Files:**

- Modify: `apps/web/src/components/report/report-template.tsx`
- Modify: `apps/web/src/components/report/generate-report-modal.tsx` (add "Include AI narrative" toggle)

**Step 1: Create NarrativeSection PDF component**

Add a new component to the report template file that renders narrative sections as styled PDF blocks:

```tsx
function NarrativePDFSection({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>
        {title}
      </Text>
      {/* Parse HTML content to PDF-safe text — strip tags, preserve paragraphs */}
      <Text style={{ fontSize: 10, lineHeight: 1.5 }}>
        {content
          .replace(/<[^>]*>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")}
      </Text>
    </View>
  );
}
```

**Step 2: Integrate into report template**

In the report template, conditionally render narrative sections between the score overview and issue tables:

```tsx
{
  reportData.narrativeSections?.map((section) => (
    <NarrativePDFSection
      key={section.id}
      title={section.title}
      content={section.editedContent ?? section.content}
    />
  ));
}
```

**Step 3: Add toggle to generate-report-modal**

Add an "Include AI narrative" checkbox to the modal, defaulting to `true` for Pro/Agency:

```tsx
<label className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={includeNarrative}
    onChange={(e) => setIncludeNarrative(e.target.checked)}
    disabled={!isPro && !isAgency}
  />
  <span>Include AI narrative analysis</span>
</label>
```

**Step 4: Run dev server to verify**

Run: `pnpm --filter web dev`
Expected: Report modal shows toggle, PDF renders narrative sections

**Step 5: Commit**

```bash
git add apps/web/src/components/report/
git commit -m "feat(web): Phase 1 — narrative sections in PDF reports with toggle"
```

---

## Task 12: Phase 2 — Dashboard AI Insight Card

**Files:**

- Create: `apps/web/src/components/narrative/ai-insight-card.tsx`
- Modify: `apps/web/src/components/tabs/overview-tab.tsx`

**Step 1: Create AI Insight Card component**

Create `apps/web/src/components/narrative/ai-insight-card.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import Link from "next/link";

interface AiInsightCardProps {
  crawlJobId: string;
  projectId: string;
  userPlan: string;
}

export function AiInsightCard({
  crawlJobId,
  projectId,
  userPlan,
}: AiInsightCardProps) {
  const isPro = userPlan === "pro" || userPlan === "agency";

  const { data: narrative, isLoading } = useApiSWR(
    isPro ? `narrative-${crawlJobId}` : null,
    useCallback(() => api.narratives.get(crawlJobId), [crawlJobId]),
  );

  if (!isPro) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="font-semibold">AI-Powered Analysis</p>
            <p className="text-sm text-muted-foreground">
              Upgrade to Pro for AI-generated narrative reports
            </p>
            <Button size="sm" asChild>
              <Link href="/dashboard/billing">Upgrade</Link>
            </Button>
          </div>
        </div>
        <CardHeader>
          <CardTitle className="text-sm">AI Insight</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 blur-sm select-none">
            <p>
              Your site scores well in technical SEO but content quality needs
              improvement...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">AI Insight</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const execSummary = (narrative?.sections as any[])?.find(
    (s: any) => s.type === "executive_summary",
  );

  if (!execSummary) return null;

  const displayContent = execSummary.editedContent ?? execSummary.content;
  // Truncate to ~150 words
  const truncated = displayContent.replace(/<[^>]*>/g, "").slice(0, 600);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          AI Insight
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            AI
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {truncated}...
        </p>
        <Button variant="link" size="sm" className="p-0 mt-2" asChild>
          <Link href={`/dashboard/projects/${projectId}/ai-analysis`}>
            Read Full Analysis
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to overview tab**

In `overview-tab.tsx`, import and render the card after score circles:

```tsx
import { AiInsightCard } from "@/components/narrative/ai-insight-card";

// Inside the return, after score circles and before quick wins:
<AiInsightCard
  crawlJobId={latestCrawl.id}
  projectId={projectId}
  userPlan={user?.plan ?? "free"}
/>;
```

**Step 3: Run dev server to verify**

Run: `pnpm --filter web dev`
Expected: AI Insight card renders on Overview tab

**Step 4: Commit**

```bash
git add apps/web/src/components/narrative/ apps/web/src/components/tabs/overview-tab.tsx
git commit -m "feat(web): Phase 2 — AI Insight card on dashboard overview"
```

---

## Task 13: Phase 3 — Standalone AI Analysis Page

**Files:**

- Create: `apps/web/src/app/dashboard/projects/[id]/ai-analysis/page.tsx`
- Create: `apps/web/src/components/narrative/narrative-viewer.tsx`
- Create: `apps/web/src/components/narrative/narrative-section-editor.tsx`

This is the largest frontend task. It involves:

1. **Page component** at `/dashboard/projects/[id]/ai-analysis` — fetches narrative data, renders tone toggle + section list
2. **NarrativeViewer** — orchestrates all sections, handles tone switching, export
3. **NarrativeSectionEditor** — individual section with TipTap (editable for Agency, read-only for Pro), regenerate button

**Step 1: Install TipTap**

Run: `pnpm --filter web add @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder`

**Step 2: Create NarrativeSectionEditor**

Create `apps/web/src/components/narrative/narrative-section-editor.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { NarrativeSection } from "@llm-boost/shared";

interface Props {
  section: NarrativeSection;
  crawlJobId: string;
  editable: boolean;
  onSectionUpdate: (section: NarrativeSection) => void;
}

export function NarrativeSectionEditor({
  section,
  crawlJobId,
  editable,
  onSectionUpdate,
}: Props) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  const displayContent = section.editedContent ?? section.content;

  const editor = useEditor({
    extensions: [StarterKit],
    content: displayContent,
    editable,
    onUpdate: ({ editor }) => {
      if (editable) {
        // Debounced save would go here
        const html = editor.getHTML();
        api.narratives.editSection(crawlJobId, section.id, html);
        onSectionUpdate({ ...section, editedContent: html });
      }
    },
  });

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      const result = await api.narratives.regenerateSection(
        crawlJobId,
        section.type,
        instructions || undefined,
      );
      if (result && editor) {
        editor.commands.setContent(result.content);
        onSectionUpdate({
          ...section,
          content: result.content,
          editedContent: null,
        });
      }
    } finally {
      setIsRegenerating(false);
      setShowInstructions(false);
      setInstructions("");
    }
  }, [crawlJobId, section, instructions, editor, onSectionUpdate]);

  const handleReset = useCallback(async () => {
    await api.narratives.editSection(crawlJobId, section.id, null);
    if (editor) editor.commands.setContent(section.content);
    onSectionUpdate({ ...section, editedContent: null });
  }, [crawlJobId, section, editor, onSectionUpdate]);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{section.title}</h3>
        <div className="flex items-center gap-2">
          {section.editedContent && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset to AI
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInstructions(!showInstructions)}
            disabled={isRegenerating}
          >
            {isRegenerating ? "Regenerating..." : "Regenerate"}
          </Button>
        </div>
      </div>

      {showInstructions && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Optional: 'Focus more on mobile...' "
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="flex-1 px-3 py-1.5 border rounded text-sm"
          />
          <Button size="sm" onClick={handleRegenerate}>
            Go
          </Button>
        </div>
      )}

      <div className="prose prose-sm max-w-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
```

**Step 3: Create NarrativeViewer**

Create `apps/web/src/components/narrative/narrative-viewer.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { NarrativeSectionEditor } from "./narrative-section-editor";
import type { NarrativeSection, NarrativeTone } from "@llm-boost/shared";

interface Props {
  crawlJobId: string;
  userPlan: string;
}

export function NarrativeViewer({ crawlJobId, userPlan }: Props) {
  const [tone, setTone] = useState<NarrativeTone>("technical");
  const isAgency = userPlan === "agency";

  const {
    data: narrative,
    isLoading,
    mutate,
  } = useApiSWR(
    `narrative-${crawlJobId}-${tone}`,
    useCallback(() => api.narratives.get(crawlJobId, tone), [crawlJobId, tone]),
  );

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      await api.narratives.generate(crawlJobId, tone);
      mutate();
    } finally {
      setIsGenerating(false);
    }
  }, [crawlJobId, tone, mutate]);

  const handleSectionUpdate = useCallback(
    (updated: NarrativeSection) => {
      if (!narrative) return;
      const newSections = (narrative.sections as NarrativeSection[]).map((s) =>
        s.id === updated.id ? updated : s,
      );
      mutate({ ...narrative, sections: newSections }, false);
    },
    [narrative, mutate],
  );

  const sections = (narrative?.sections as NarrativeSection[]) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={tone === "technical" ? "default" : "outline"}
            size="sm"
            onClick={() => setTone("technical")}
          >
            Technical
          </Button>
          <Button
            variant={tone === "business" ? "default" : "outline"}
            size="sm"
            onClick={() => setTone("business")}
          >
            Business
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">
            No AI analysis generated yet for this tone.
          </p>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate AI Analysis"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <NarrativeSectionEditor
              key={section.id}
              section={section}
              crawlJobId={crawlJobId}
              editable={isAgency}
              onSectionUpdate={handleSectionUpdate}
            />
          ))}
        </div>
      )}

      {/* Version info */}
      {narrative && (
        <p className="text-xs text-muted-foreground">
          Generated by {narrative.generatedBy} · v{narrative.version} ·{" "}
          {new Date(narrative.createdAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
```

**Step 4: Create the page**

Create `apps/web/src/app/dashboard/projects/[id]/ai-analysis/page.tsx`:

```tsx
import { NarrativeViewer } from "@/components/narrative/narrative-viewer";

// This page follows the same data-fetching pattern as other project tabs.
// The NarrativeViewer handles all data fetching client-side via SWR.
export default function AiAnalysisPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { crawlId?: string };
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Analysis</h2>
        <p className="text-muted-foreground">
          AI-generated narrative analysis of your site's AI readiness
        </p>
      </div>

      {searchParams.crawlId ? (
        <NarrativeViewer
          crawlJobId={searchParams.crawlId}
          userPlan="pro" // TODO: wire from auth context
        />
      ) : (
        <p className="text-muted-foreground">
          Select a crawl to view AI analysis.
        </p>
      )}
    </div>
  );
}
```

**Step 5: Add tab navigation link**

In the project dashboard tab navigation component, add an "AI Analysis" tab linking to `/dashboard/projects/{id}/ai-analysis`.

**Step 6: Run dev server to verify**

Run: `pnpm --filter web dev`
Expected: AI Analysis page renders with tone toggle and section editors

**Step 7: Commit**

```bash
git add apps/web/src/app/dashboard/projects/*/ai-analysis/ apps/web/src/components/narrative/
git commit -m "feat(web): Phase 3 — standalone AI Analysis page with TipTap editor"
```

---

## Task 14: Typecheck & Test All Packages

**Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: All packages pass

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass, including new narrative engine tests

**Step 3: Fix any issues found**

Address any type errors or test failures.

**Step 4: Commit fixes if needed**

```bash
git add -A
git commit -m "fix: resolve type errors and test failures from narrative feature"
```

---

## Task 15: Final Integration Verification

**Step 1: Verify the full flow locally**

1. Start dev servers: `pnpm dev`
2. Navigate to a project with a completed crawl
3. Verify the AI Insight card on the Overview tab (Pro user)
4. Navigate to AI Analysis tab
5. Generate a narrative (requires ANTHROPIC_API_KEY in env)
6. Switch between technical/business tones
7. Test section regeneration
8. Test section editing (Agency plan)
9. Generate a PDF report with narrative sections included

**Step 2: Verify plan gating**

1. As Free user: verify 403 on narrative endpoints
2. As Pro user: verify read-only sections (no edit)
3. As Agency user: verify full edit + regenerate

**Step 3: Commit final state**

```bash
git add -A
git commit -m "feat: AI narrative report generation — complete implementation"
```
