# 10-Feature Roadmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 10 high-value features to LLM Rank, ordered by impact and effort, to transform the product from an audit tool into an action-oriented AI-readiness platform.

**Architecture:** Each feature follows existing patterns — factory-function services, repository interfaces, Hono routes with auth middleware, SWR-based React components, and Drizzle ORM queries. New DB tables use pgEnum + UUID + timestamp conventions. All features respect plan limits via PLAN_LIMITS.

**Tech Stack:** Hono (API), Drizzle ORM + Neon PostgreSQL (DB), Next.js App Router (frontend), SWR (data fetching), Radix UI + Tailwind (components), Anthropic/OpenAI SDK (LLM), Resend (email), Recharts (charts), Stripe (billing)

---

## Feature 1: AI Content Rewriter / Fix Assistant

**Priority:** #1 — Highest value. Turns audit into action.

### Task 1.1: DB Schema — `content_fixes` table

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`
- Create: `packages/db/src/queries/content-fixes.ts`

**Step 1:** Add schema to `packages/db/src/schema.ts`:

```typescript
export const fixTypeEnum = pgEnum("fix_type", [
  "meta_description",
  "title_tag",
  "json_ld",
  "llms_txt",
  "faq_section",
  "summary_section",
  "alt_text",
  "og_tags",
  "canonical",
  "heading_structure",
]);

export const contentFixes = pgTable("content_fixes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  pageId: uuid("page_id").references(() => pages.id),
  issueCode: varchar("issue_code", { length: 64 }).notNull(),
  fixType: fixTypeEnum("fix_type").notNull(),
  originalContent: text("original_content"),
  generatedFix: text("generated_fix").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("generated"), // generated | applied | dismissed
  tokensUsed: integer("tokens_used"),
  model: varchar("model", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Step 2:** Create query helper at `packages/db/src/queries/content-fixes.ts`:

```typescript
import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "../client";
import { contentFixes } from "../schema";

export function contentFixQueries(db: Database) {
  return {
    async create(data: typeof contentFixes.$inferInsert) {
      const [row] = await db.insert(contentFixes).values(data).returning();
      return row;
    },
    async listByProject(projectId: string, limit = 20) {
      return db.query.contentFixes.findMany({
        where: eq(contentFixes.projectId, projectId),
        orderBy: desc(contentFixes.createdAt),
        limit,
      });
    },
    async countByUserThisMonth(userId: string) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(contentFixes)
        .where(
          and(
            eq(contentFixes.userId, userId),
            sql`${contentFixes.createdAt} >= ${startOfMonth.toISOString()}`,
          ),
        );
      return row?.count ?? 0;
    },
    async updateStatus(id: string, status: string) {
      await db
        .update(contentFixes)
        .set({ status })
        .where(eq(contentFixes.id, id));
    },
  };
}
```

**Step 3:** Export from `packages/db/src/index.ts`:

```typescript
export { contentFixQueries } from "./queries/content-fixes";
```

**Step 4:** Run `cd packages/db && npx drizzle-kit push`

**Step 5:** Commit: `feat(db): add content_fixes table for AI fix assistant`

---

### Task 1.2: Fix Generation Service

**Files:**

- Create: `apps/api/src/services/fix-generator-service.ts`
- Modify: `packages/shared/src/constants/plan-limits.ts` (add `fixesPerMonth`)

**Step 1:** Add plan limit in `packages/shared/src/constants/plan-limits.ts`:

```typescript
// Add to each plan's limits object:
fixesPerMonth: 5,    // free
fixesPerMonth: 50,   // starter
fixesPerMonth: 200,  // pro
fixesPerMonth: Infinity, // agency
```

**Step 2:** Create service at `apps/api/src/services/fix-generator-service.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { ServiceError } from "./errors";

interface FixGeneratorDeps {
  contentFixes: { create: Function; countByUserThisMonth: Function };
  projects: { getById: Function };
  users: { getById: Function };
}

const FIX_PROMPTS: Record<string, (ctx: FixContext) => string> = {
  MISSING_META_DESC: (ctx) =>
    `Write a meta description (120-160 chars) for this page.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nContent excerpt: ${ctx.excerpt}\nReturn ONLY the meta description text, no HTML tags.`,
  MISSING_TITLE: (ctx) =>
    `Write a title tag (30-60 chars) for this page.\nURL: ${ctx.url}\nContent excerpt: ${ctx.excerpt}\nReturn ONLY the title text.`,
  NO_STRUCTURED_DATA: (ctx) =>
    `Generate JSON-LD structured data for this page.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nType: ${ctx.contentType ?? "WebPage"}\nContent excerpt: ${ctx.excerpt}\nReturn valid JSON-LD only.`,
  MISSING_LLMS_TXT: (ctx) =>
    `Generate an llms.txt file for the website ${ctx.domain}.\nPages:\n${ctx.pages?.map((p) => `- ${p.url}: ${p.title}`).join("\n")}\nFollow the llms.txt specification. Return the file content only.`,
  NO_FAQ_SECTION: (ctx) =>
    `Generate 3-5 FAQ questions and answers based on this page content.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nContent: ${ctx.excerpt}\nReturn as HTML <details>/<summary> elements.`,
  MISSING_SUMMARY: (ctx) =>
    `Write a 2-3 sentence executive summary for this page that an AI assistant could quote.\nURL: ${ctx.url}\nTitle: ${ctx.title}\nContent: ${ctx.excerpt}\nReturn plain text only.`,
};

interface FixContext {
  url: string;
  title: string;
  excerpt: string;
  domain: string;
  contentType?: string;
  pages?: { url: string; title: string }[];
}

export function createFixGeneratorService(deps: FixGeneratorDeps) {
  return {
    async generateFix(args: {
      userId: string;
      projectId: string;
      pageId?: string;
      issueCode: string;
      context: FixContext;
      apiKey: string;
      planLimit: number;
    }) {
      // Check plan limit
      const usedThisMonth = await deps.contentFixes.countByUserThisMonth(
        args.userId,
      );
      if (usedThisMonth >= args.planLimit) {
        throw new ServiceError(
          "PLAN_LIMIT_REACHED",
          403,
          "Monthly AI fix limit reached. Upgrade your plan.",
        );
      }

      const promptFn = FIX_PROMPTS[args.issueCode];
      if (!promptFn) {
        throw new ServiceError(
          "UNSUPPORTED_FIX",
          422,
          `No AI fix available for issue code: ${args.issueCode}`,
        );
      }

      const client = new Anthropic({ apiKey: args.apiKey });
      const message = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [{ role: "user", content: promptFn(args.context) }],
      });

      const generatedText = message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      const fix = await deps.contentFixes.create({
        userId: args.userId,
        projectId: args.projectId,
        pageId: args.pageId,
        issueCode: args.issueCode,
        fixType: mapIssueToFixType(args.issueCode),
        originalContent: args.context.excerpt?.slice(0, 500),
        generatedFix: generatedText,
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
        model: "claude-sonnet-4-5-20250929",
      });

      return fix;
    },
  };
}

function mapIssueToFixType(code: string): string {
  const map: Record<string, string> = {
    MISSING_META_DESC: "meta_description",
    MISSING_TITLE: "title_tag",
    NO_STRUCTURED_DATA: "json_ld",
    MISSING_LLMS_TXT: "llms_txt",
    NO_FAQ_SECTION: "faq_section",
    MISSING_SUMMARY: "summary_section",
    MISSING_ALT_TEXT: "alt_text",
    MISSING_OG_TAGS: "og_tags",
    MISSING_CANONICAL: "canonical",
    BAD_HEADING_HIERARCHY: "heading_structure",
  };
  return map[code] ?? "meta_description";
}
```

**Step 3:** Commit: `feat(api): add AI fix generator service with plan limits`

---

### Task 1.3: API Route — `/api/fixes`

**Files:**

- Create: `apps/api/src/routes/fixes.ts`
- Modify: `apps/api/src/index.ts` (mount route)

**Step 1:** Create route at `apps/api/src/routes/fixes.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { handleServiceError } from "../services/errors";
import { createFixGeneratorService } from "../services/fix-generator-service";
import {
  contentFixQueries,
  userQueries,
  projectQueries,
  pageQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { z } from "zod";

export const fixRoutes = new Hono<AppEnv>();
fixRoutes.use("*", authMiddleware);

const generateSchema = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid().optional(),
  issueCode: z.string(),
});

fixRoutes.post("/generate", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const body = generateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: body.error.flatten(),
        },
      },
      422,
    );
  }

  try {
    const user = await userQueries(db).getById(userId);
    const project = await projectQueries(db).getById(body.data.projectId);
    if (!project || project.userId !== userId) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        404,
      );
    }

    let pageContext = {
      url: project.domain,
      title: project.name,
      excerpt: "",
      domain: project.domain,
    };
    if (body.data.pageId) {
      const page = await pageQueries(db).getById(body.data.pageId);
      if (page) {
        pageContext = {
          url: page.url,
          title: page.title ?? project.name,
          excerpt: page.contentText?.slice(0, 2000) ?? "",
          domain: project.domain,
        };
      }
    }

    const service = createFixGeneratorService({
      contentFixes: contentFixQueries(db),
      projects: projectQueries(db),
      users: userQueries(db),
    });

    const limits = PLAN_LIMITS[user?.plan ?? "free"];
    const fix = await service.generateFix({
      userId,
      projectId: body.data.projectId,
      pageId: body.data.pageId,
      issueCode: body.data.issueCode,
      context: pageContext,
      apiKey: c.env.ANTHROPIC_API_KEY,
      planLimit: limits.fixesPerMonth ?? 5,
    });

    return c.json({ data: fix }, 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

fixRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.query("projectId");
  if (!projectId)
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "projectId required" } },
      422,
    );

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const fixes = await contentFixQueries(db).listByProject(projectId);
  return c.json({ data: fixes });
});
```

**Step 2:** Mount in `apps/api/src/index.ts`:

```typescript
import { fixRoutes } from "./routes/fixes";
// Add after other route mounts:
app.route("/api/fixes", fixRoutes);
```

**Step 3:** Commit: `feat(api): add /api/fixes route for AI content generation`

---

### Task 1.4: Frontend — Fix Button on Issue Cards

**Files:**

- Modify: `apps/web/src/lib/api.ts` (add fixes API methods)
- Create: `apps/web/src/components/ai-fix-button.tsx`
- Modify: `apps/web/src/components/tabs/overview-tab.tsx` (add button to quick wins)

**Step 1:** Add to `apps/web/src/lib/api.ts`:

```typescript
fixes: {
  generate(data: { projectId: string; pageId?: string; issueCode: string }) {
    return request<{ data: ContentFix }>(`/api/fixes/generate`, { method: "POST", body: data }).then(r => r.data);
  },
  list(projectId: string) {
    return request<{ data: ContentFix[] }>(`/api/fixes?projectId=${projectId}`).then(r => r.data);
  },
},
```

**Step 2:** Create `apps/web/src/components/ai-fix-button.tsx`:

```typescript
"use client";
import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  projectId: string;
  pageId?: string;
  issueCode: string;
  issueTitle: string;
}

export function AiFixButton({ projectId, pageId, issueCode, issueTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fix, setFix] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await api.fixes.generate({ projectId, pageId, issueCode });
      setFix(result.generatedFix);
      setOpen(true);
    } catch (err: any) {
      toast({ title: "Fix generation failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (fix) {
      navigator.clipboard.writeText(fix);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
        <Sparkles className="h-3 w-3 mr-1" />
        {loading ? "Generating..." : "AI Fix"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Fix: {issueTitle}</DialogTitle>
          </DialogHeader>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap">{fix}</pre>
          <Button onClick={handleCopy} variant="outline">
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? "Copied!" : "Copy to clipboard"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 3:** Add `<AiFixButton>` to quick wins in overview-tab.tsx (alongside existing issue details).

**Step 4:** Commit: `feat(web): add AI Fix button for one-click content generation`

---

### Task 1.5: Tests

**Files:**

- Create: `apps/api/src/__tests__/services/fix-generator-service.test.ts`
- Create: `apps/api/src/__tests__/integration/fixes.test.ts`

**Step 1:** Write unit tests for the service (mock Anthropic SDK, test plan limits, test prompt selection).

**Step 2:** Write integration tests for the route (auth required, validation, 201 on success, 403 on limit).

**Step 3:** Run: `cd apps/api && pnpm test`

**Step 4:** Commit: `test: add AI fix generator service and route tests`

---

## Feature 2: Competitor Benchmarking

**Priority:** #2 — Drives upgrades and retention.

### Task 2.1: DB Schema — `competitor_benchmarks` table

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/queries/competitor-benchmarks.ts`

**Step 1:** Add to schema:

```typescript
export const competitorBenchmarks = pgTable("competitor_benchmarks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  competitorDomain: varchar("competitor_domain", { length: 512 }).notNull(),
  overallScore: integer("overall_score"),
  technicalScore: integer("technical_score"),
  contentScore: integer("content_score"),
  aiReadinessScore: integer("ai_readiness_score"),
  performanceScore: integer("performance_score"),
  issueCount: integer("issue_count"),
  topIssues: jsonb("top_issues").$type<string[]>(),
  crawledAt: timestamp("crawled_at").defaultNow().notNull(),
});
```

**Step 2:** Create queries: `listByProject`, `upsert`, `getLatest`.

**Step 3:** Push schema, commit: `feat(db): add competitor_benchmarks table`

---

### Task 2.2: Competitor Crawl Service

**Files:**

- Create: `apps/api/src/services/competitor-benchmark-service.ts`

**Step 1:** Create service that:

1. Accepts competitor domain + projectId
2. Dispatches a lightweight crawl (homepage + 5 internal pages)
3. Runs the scoring engine on results
4. Stores benchmark scores
5. Returns comparison data (your score vs competitor per category)

**Step 2:** Add plan limits in shared: `competitorsPerProject: 0/3/5/10`

**Step 3:** Commit: `feat(api): add competitor benchmark service`

---

### Task 2.3: API Route — `/api/projects/:id/competitors/benchmark`

**Files:**

- Modify: `apps/api/src/routes/projects.ts` (or create `apps/api/src/routes/competitor-benchmarks.ts`)

**Step 1:** Add routes:

- `POST /api/projects/:id/competitors/benchmark` — Trigger benchmark crawl for a competitor
- `GET /api/projects/:id/competitors/benchmark` — Get latest benchmark results

**Step 2:** Commit: `feat(api): add competitor benchmark API endpoints`

---

### Task 2.4: Frontend — Competitor Comparison Tab

**Files:**

- Create: `apps/web/src/components/tabs/competitors-tab.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx` (add tab)

**Step 1:** Build UI:

- "Add Competitor" input + button
- Side-by-side score comparison cards (radar chart using Recharts)
- Per-category bar chart (your score vs competitor)
- "Advantages" and "Gaps" list

**Step 2:** Commit: `feat(web): add competitor benchmarking tab`

---

### Task 2.5: Tests

Write service + integration tests. Commit: `test: competitor benchmarking`

---

## Feature 3: Automated Email Digest

**Priority:** #3 — Low effort, high retention.

### Task 3.1: Email Templates

**Files:**

- Create: `apps/api/src/services/email-templates/weekly-digest.ts`
- Create: `apps/api/src/services/email-templates/monthly-digest.ts`

**Step 1:** Create HTML email templates using template literals:

```typescript
export function weeklyDigestHtml(data: {
  userName: string;
  projectName: string;
  currentScore: number;
  previousScore: number;
  scoreDelta: number;
  newIssues: number;
  resolvedIssues: number;
  topQuickWins: { title: string; impact: number }[];
  visibilityChanges: { provider: string; change: string }[];
  dashboardUrl: string;
}) {
  return `<!DOCTYPE html>...`; // Responsive email HTML
}
```

**Step 2:** Commit: `feat(api): add weekly and monthly email digest templates`

---

### Task 3.2: Digest Preferences Schema

**Files:**

- Modify: `packages/db/src/schema.ts` (add columns to users table)

**Step 1:** Add to `users` table:

```typescript
digestFrequency: varchar("digest_frequency", { length: 16 }).default("weekly"), // off | weekly | monthly
digestDay: integer("digest_day").default(1), // 0=Sun, 1=Mon for weekly; 1-28 for monthly
lastDigestSentAt: timestamp("last_digest_sent_at"),
```

**Step 2:** Push schema, commit: `feat(db): add digest preferences to users`

---

### Task 3.3: Digest Cron Job

**Files:**

- Create: `apps/api/src/services/digest-service.ts`
- Modify: `apps/api/src/index.ts` (add cron handler)

**Step 1:** Create digest service:

```typescript
export function createDigestService(deps: DigestServiceDeps) {
  return {
    async processWeeklyDigests(env: Bindings) {
      const users = await deps.users.getDueForDigest("weekly");
      for (const user of users) {
        const projects = await deps.projects.listByUser(user.id);
        for (const project of projects) {
          const stats = await gatherProjectStats(deps, project);
          const html = weeklyDigestHtml({ userName: user.name, ...stats });
          await sendEmail(
            env.RESEND_API_KEY,
            user.email,
            `Weekly Report: ${project.name}`,
            html,
          );
        }
        await deps.users.updateLastDigestSent(user.id);
      }
    },
  };
}
```

**Step 2:** Add to scheduled handler in `index.ts`:

```typescript
// Weekly: Mondays at 8 AM UTC
if (controller.cron === "0 8 * * 1") {
  await digestService.processWeeklyDigests(env);
}
```

**Step 3:** Add cron to `wrangler.toml`: `"0 8 * * 1"`

**Step 4:** Commit: `feat(api): add email digest cron job`

---

### Task 3.4: Frontend — Digest Settings UI

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx`

**Step 1:** Add digest frequency selector (Off / Weekly / Monthly) and day picker to settings page.

**Step 2:** Commit: `feat(web): add email digest settings to account page`

---

### Task 3.5: Tests

Test digest service, cron handler, and template rendering. Commit: `test: email digest`

---

## Feature 4: Historical Score Trends & Regression Alerts

**Priority:** #4 — Leverages existing data.

### Task 4.1: Trend Data API Endpoint

**Files:**

- Create: `apps/api/src/routes/trends.ts`
- Modify: `apps/api/src/index.ts`

**Step 1:** Add route:

```typescript
// GET /api/projects/:id/trends?period=30d
// Returns: [{ crawlId, date, overall, technical, content, aiReadiness, performance, pageCount }]
trendRoutes.get("/:projectId", async (c) => {
  // Query crawl_jobs + page_scores grouped by crawl, ordered by date
  // Return time-series data for charting
});
```

**Step 2:** Commit: `feat(api): add score trend API endpoint`

---

### Task 4.2: Regression Detection Service

**Files:**

- Create: `apps/api/src/services/regression-service.ts`

**Step 1:** Service logic:

```typescript
export function createRegressionService(deps) {
  return {
    async detectRegressions(projectId: string) {
      const [latest, previous] = await deps.crawls.getLastTwo(projectId);
      if (!latest || !previous) return [];

      const regressions = [];
      const threshold = 5; // points drop

      for (const category of [
        "overall",
        "technical",
        "content",
        "aiReadiness",
        "performance",
      ]) {
        const delta = latest[category] - previous[category];
        if (delta <= -threshold) {
          regressions.push({
            category,
            delta,
            previousScore: previous[category],
            currentScore: latest[category],
          });
        }
      }
      return regressions;
    },
  };
}
```

**Step 2:** Emit `outboxEvents` for regressions (type: "notification", eventType: "score_regression").

**Step 3:** Commit: `feat(api): add regression detection service`

---

### Task 4.3: Frontend — Trend Charts

**Files:**

- Create: `apps/web/src/components/charts/score-trend-chart.tsx`
- Modify: `apps/web/src/components/tabs/overview-tab.tsx`

**Step 1:** Build Recharts LineChart with:

- X-axis: crawl dates
- Y-axis: scores (0-100)
- Lines: overall, technical, content, aiReadiness, performance
- Tooltip with exact values
- Regression markers (red dots on drops > 5pts)

**Step 2:** Add chart to overview tab below score cards.

**Step 3:** Commit: `feat(web): add score trend chart with regression markers`

---

### Task 4.4: Tests

Test regression detection logic (above/below threshold, no previous crawl, etc). Commit: `test: regression detection and trends`

---

## Feature 5: Team Collaboration & Role-Based Access

**Priority:** #5 — Unlocks enterprise/agency sales.

### Task 5.1: DB Schema — Teams & Memberships

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/queries/teams.ts`

**Step 1:** Add schema:

```typescript
export const teamRoleEnum = pgEnum("team_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  plan: planEnum("plan").notNull().default("free"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  role: teamRoleEnum("role").notNull().default("viewer"),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
});

export const teamInvitations = pgTable("team_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id),
  email: varchar("email", { length: 256 }).notNull(),
  role: teamRoleEnum("role").notNull().default("viewer"),
  token: varchar("token", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Step 2:** Create query helpers for teams (CRUD, invite, accept, list members).

**Step 3:** Commit: `feat(db): add teams, team_members, team_invitations tables`

---

### Task 5.2: Team Auth Middleware

**Files:**

- Create: `apps/api/src/middleware/team-auth.ts`

**Step 1:** Middleware that:

1. Reads `teamId` from route params or query
2. Checks if `userId` is a member of that team
3. Checks if member's role has required permissions
4. Sets `c.set("teamRole", role)` in context

**Step 2:** Permission matrix:

- **Owner/Admin:** All operations
- **Editor:** CRUD on projects, crawls, pages, fixes. Cannot manage billing or team.
- **Viewer:** Read-only on all project data. Cannot start crawls or generate fixes.

**Step 3:** Commit: `feat(api): add team auth middleware with role-based permissions`

---

### Task 5.3: Team Routes

**Files:**

- Create: `apps/api/src/routes/teams.ts`

**Step 1:** Routes:

- `POST /api/teams` — Create team
- `GET /api/teams` — List user's teams
- `POST /api/teams/:id/invite` — Send invitation
- `POST /api/teams/accept-invite` — Accept invitation
- `PATCH /api/teams/:id/members/:memberId` — Update role
- `DELETE /api/teams/:id/members/:memberId` — Remove member

**Step 2:** Commit: `feat(api): add team management routes`

---

### Task 5.4: Frontend — Team Management UI

**Files:**

- Create: `apps/web/src/app/dashboard/team/page.tsx`
- Create: `apps/web/src/components/team/`

**Step 1:** Build:

- Team settings page with member list
- Invite dialog (email + role selector)
- Role badges and role change dropdown
- Remove member confirmation

**Step 2:** Modify project ownership to support team-owned projects.

**Step 3:** Commit: `feat(web): add team management page`

---

### Task 5.5: Tests

Test team CRUD, invitations, role permissions, middleware. Commit: `test: team collaboration`

---

## Feature 6: WordPress Plugin (Real-Time Content Scoring)

**Priority:** #6 — Distribution channel.

### Task 6.1: Plugin Scaffold

**Files:**

- Already exists: `apps/wordpress-plugin/`

**Step 1:** Structure the plugin:

```
apps/wordpress-plugin/
  llm-boost.php           # Main plugin file (hooks, admin menu)
  includes/
    class-api-client.php  # REST client to LLM Rank API
    class-editor-panel.php # Gutenberg sidebar panel
    class-settings.php    # Settings page (API key)
  assets/
    js/editor-panel.js    # React panel for block editor
    css/editor-panel.css
  readme.txt              # WP plugin directory listing
```

**Step 2:** Implement API key settings page.

**Step 3:** Commit: `feat(wordpress): scaffold plugin with settings page`

---

### Task 6.2: Gutenberg Sidebar Panel

**Files:**

- Create: `apps/wordpress-plugin/assets/js/editor-panel.js`

**Step 1:** Build React sidebar panel that:

1. Extracts post title, content, meta description from editor
2. Sends to LLM Rank API `POST /api/v1/score` for real-time scoring
3. Displays score circle, top 3 issues, and AI fix suggestions
4. Debounced scoring on content change (5-second delay)

**Step 2:** Commit: `feat(wordpress): add Gutenberg scoring sidebar`

---

### Task 6.3: Lightweight Scoring API Endpoint

**Files:**

- Modify: `apps/api/src/routes/v1.ts`

**Step 1:** Add endpoint:

```typescript
// POST /api/v1/score
// Body: { title, content, url, metaDescription }
// Returns: { overall, technical, content, aiReadiness, issues: [...top5] }
```

This runs a subset of the scoring engine (no crawling, no Lighthouse) for instant results.

**Step 2:** Commit: `feat(api): add lightweight /api/v1/score endpoint for plugins`

---

### Task 6.4: Tests

Test WP API client, scoring endpoint, rate limiting. Commit: `test: wordpress plugin integration`

---

## Feature 7: Custom Scoring Profiles

**Priority:** #7 — Increases perceived accuracy.

### Task 7.1: DB Schema — `scoring_profiles`

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/queries/scoring-profiles.ts`

**Step 1:** Add table:

```typescript
export const scoringProfiles = pgTable("scoring_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 128 }).notNull(),
  isDefault: boolean("is_default").default(false),
  weights: jsonb("weights")
    .$type<{
      technical: number; // 0-100, must sum to 100
      content: number;
      aiReadiness: number;
      performance: number;
    }>()
    .notNull(),
  disabledFactors: jsonb("disabled_factors").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Step 2:** Commit: `feat(db): add scoring_profiles table`

---

### Task 7.2: Scoring Engine Integration

**Files:**

- Modify: `packages/scoring/src/engine.ts`

**Step 1:** Accept optional weights parameter:

```typescript
export function scorePageFactors(
  factors: PageFactors,
  weights?: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  },
) {
  const w = weights ?? {
    technical: 25,
    content: 30,
    aiReadiness: 30,
    performance: 15,
  };
  // Use w instead of hardcoded weights
}
```

**Step 2:** Commit: `feat(scoring): support custom category weights`

---

### Task 7.3: Preset Templates

**Files:**

- Create: `packages/scoring/src/profiles.ts`

**Step 1:** Add industry presets:

```typescript
export const SCORING_PRESETS = {
  default: { technical: 25, content: 30, aiReadiness: 30, performance: 15 },
  ecommerce: { technical: 30, content: 20, aiReadiness: 35, performance: 15 },
  blog: { technical: 15, content: 40, aiReadiness: 30, performance: 15 },
  saas: { technical: 25, content: 25, aiReadiness: 35, performance: 15 },
  local_business: {
    technical: 30,
    content: 25,
    aiReadiness: 25,
    performance: 20,
  },
};
```

**Step 2:** Commit: `feat(scoring): add industry scoring presets`

---

### Task 7.4: API + Frontend

Add CRUD routes for scoring profiles. Build UI in project settings tab with preset selector and custom weight sliders (must sum to 100).

Commit: `feat: custom scoring profiles UI and API`

---

## Feature 8: Bulk Export & White-Label Reports

**Priority:** #8 — Agency tier converter.

### Task 8.1: CSV/Excel Export Endpoint

**Files:**

- Create: `apps/api/src/routes/exports.ts`

**Step 1:** Add routes:

```typescript
// GET /api/projects/:id/export?format=csv
// GET /api/projects/:id/export?format=xlsx
// Returns: All pages with scores, issues, recommendations as CSV/Excel
```

Use a lightweight CSV serializer (no heavy library). For Excel, use `xlsx` npm package.

**Step 2:** Commit: `feat(api): add CSV/Excel export endpoints`

---

### Task 8.2: White-Label Report Branding

**Files:**

- Modify: `packages/db/src/schema.ts` (add branding columns to projects)
- Modify: `packages/reports/src/pdf/components/header.tsx`
- Modify: `packages/reports/src/pdf/templates/summary.tsx`
- Modify: `packages/reports/src/pdf/templates/detailed.tsx`

**Step 1:** Add to `projects` table:

```typescript
brandingLogo: text("branding_logo"),        // URL to uploaded logo
brandingColor: varchar("branding_color", { length: 7 }),  // Hex color
brandingCompanyName: varchar("branding_company_name", { length: 128 }),
```

**Step 2:** Modify PDF templates to use project branding when present (Agency plan only).

**Step 3:** Commit: `feat(reports): add white-label branding to PDF reports`

---

### Task 8.3: Logo Upload

**Files:**

- Create: `apps/api/src/routes/uploads.ts`

**Step 1:** Accept logo upload (max 2MB, PNG/SVG), store in R2, return URL.

**Step 2:** Commit: `feat(api): add logo upload to R2 for white-label reports`

---

### Task 8.4: Frontend — Export & Branding UI

**Files:**

- Modify: `apps/web/src/components/tabs/overview-tab.tsx` (add export button)
- Modify: `apps/web/src/app/dashboard/settings/page.tsx` (add branding section)

**Step 1:** Add "Export CSV" and "Export Excel" buttons to project overview.

**Step 2:** Add branding section in project settings (logo upload, color picker, company name).

**Step 3:** Commit: `feat(web): add export buttons and white-label branding settings`

---

## Feature 9: Sitemap & llms.txt Generator

**Priority:** #9 — Great free-tier hook.

### Task 9.1: Generator Service

**Files:**

- Create: `apps/api/src/services/generator-service.ts`

**Step 1:** Create generators:

```typescript
export function createGeneratorService() {
  return {
    generateSitemap(
      pages: { url: string; lastmod?: string; priority?: number }[],
    ) {
      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
        .map(
          (p) =>
            `  <url>\n    <loc>${p.url}</loc>\n    <lastmod>${p.lastmod ?? new Date().toISOString().split("T")[0]}</lastmod>\n    <priority>${p.priority ?? 0.5}</priority>\n  </url>`,
        )
        .join("\n")}\n</urlset>`;
    },

    generateLlmsTxt(data: {
      domain: string;
      title: string;
      description: string;
      pages: { url: string; title: string; description: string }[];
    }) {
      return `# ${data.title}\n\n> ${data.description}\n\n${data.pages
        .map(
          (p) =>
            `## ${p.title}\n\n${p.description}\n\n- [${p.title}](${p.url})`,
        )
        .join("\n\n")}`;
    },
  };
}
```

**Step 2:** Commit: `feat(api): add sitemap and llms.txt generator service`

---

### Task 9.2: API Routes

**Files:**

- Create: `apps/api/src/routes/generators.ts`

**Step 1:** Add:

- `POST /api/projects/:id/generate/sitemap` — Returns XML
- `POST /api/projects/:id/generate/llms-txt` — Returns plain text
- Both pull page data from the latest crawl.

**Step 2:** Also add unauthenticated versions for public scan results.

**Step 3:** Commit: `feat(api): add sitemap and llms.txt generation endpoints`

---

### Task 9.3: Frontend — Generator UI

**Files:**

- Create: `apps/web/src/components/generators/sitemap-generator.tsx`
- Create: `apps/web/src/components/generators/llms-txt-generator.tsx`

**Step 1:** Build:

- "Generate Sitemap" button in project overview
- Preview modal with syntax-highlighted XML/text
- Copy-to-clipboard and download buttons
- Also available on public scan results page

**Step 2:** Commit: `feat(web): add sitemap and llms.txt generator UI`

---

## Feature 10: Public Leaderboard & Industry Benchmarks

**Priority:** #10 — Marketing/social proof.

### Task 10.1: Aggregate Benchmarks Job

**Files:**

- Create: `apps/api/src/services/benchmark-aggregation-service.ts`

**Step 1:** Create cron job (daily) that:

1. Queries all completed crawls from last 30 days
2. Groups by domain TLD category (if possible) or just overall
3. Computes percentile ranks (p10, p25, p50, p75, p90)
4. Stores in KV as `benchmarks:overall` and `benchmarks:{category}`

```typescript
export async function aggregateBenchmarks(db: Database, kv: KVNamespace) {
  const scores = await db
    .select({ overall: pageScores.overall })
    .from(pageScores)
    .innerJoin(crawlJobs, eq(pageScores.crawlJobId, crawlJobs.id))
    .where(gte(crawlJobs.createdAt, thirtyDaysAgo));

  const sorted = scores.map((s) => s.overall).sort((a, b) => a - b);
  const percentiles = {
    p10: sorted[Math.floor(sorted.length * 0.1)],
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
    count: sorted.length,
  };
  await kv.put("benchmarks:overall", JSON.stringify(percentiles), {
    expirationTtl: 86400,
  });
}
```

**Step 2:** Add to daily cron in `index.ts`.

**Step 3:** Commit: `feat(api): add benchmark aggregation cron job`

---

### Task 10.2: Benchmark API Endpoint

**Files:**

- Modify: `apps/api/src/routes/public.ts`

**Step 1:** Add:

```typescript
// GET /api/public/benchmarks
// Returns percentile data from KV cache
publicRoutes.get("/benchmarks", async (c) => {
  const data = await c.env.KV.get("benchmarks:overall", "json");
  if (!data) return c.json({ data: null });
  return c.json({ data });
});
```

**Step 2:** Commit: `feat(api): add public benchmarks endpoint`

---

### Task 10.3: Percentile Display on Dashboard

**Files:**

- Modify: `apps/web/src/app/dashboard/page.tsx`
- Create: `apps/web/src/components/percentile-badge.tsx`

**Step 1:** Show badge: "Your average score of 83 puts you in the top 15% of all sites."

**Step 2:** On public scan results: "This score of 72 is in the 60th percentile."

**Step 3:** Commit: `feat(web): add percentile ranking badges`

---

### Task 10.4: Optional Public Leaderboard Page

**Files:**

- Create: `apps/web/src/app/leaderboard/page.tsx`

**Step 1:** Build opt-in leaderboard:

- Projects must explicitly opt-in via settings
- Display: rank, domain (anonymized first), score, grade, trend arrow
- Filterable by score range

**Step 2:** Commit: `feat(web): add public leaderboard page`

---

## Execution Order Summary

| Phase       | Features                           | Estimated Tasks | Depends On          |
| ----------- | ---------------------------------- | --------------- | ------------------- |
| **Phase 1** | F1 (AI Fixes)                      | 5 tasks         | None                |
| **Phase 2** | F3 (Email Digest) + F4 (Trends)    | 9 tasks         | None                |
| **Phase 3** | F2 (Competitors) + F9 (Generators) | 8 tasks         | None                |
| **Phase 4** | F7 (Custom Scoring) + F8 (Exports) | 8 tasks         | None                |
| **Phase 5** | F10 (Leaderboard)                  | 4 tasks         | F4 (trends data)    |
| **Phase 6** | F5 (Teams) + F6 (WordPress)        | 10 tasks        | None (can parallel) |

**Total:** ~44 tasks across 6 phases. Phases 1-4 are independent and can be parallelized. Phase 5 depends on trend data. Phase 6 is the heaviest and most isolated.
