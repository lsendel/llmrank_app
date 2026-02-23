# Remaining Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all 7 pending features: Digest UI, Custom Scoring Profiles, Bulk Export, Content Generators, Public Leaderboard, Teams & RBAC, WordPress Plugin.

**Architecture:** Each section is independent — no cross-dependencies. All follow existing patterns: factory-function services, repository interfaces, Hono routes with auth middleware, SWR-based React client components, Drizzle ORM. New DB tables use pgEnum + UUID + timestamp conventions. Plan limits enforced via `PLAN_LIMITS` from `@llm-boost/shared`.

**Tech Stack:** Hono (API), Drizzle ORM + Neon PostgreSQL (DB), Next.js App Router (frontend), SWR via `useApiSWR` (data fetching), Radix UI + Tailwind (components), Vitest (tests)

---

## Phase 1: Email Digest Settings UI

The digest backend is fully implemented — `digest-service.ts`, email templates, cron handlers in `index.ts` (lines 524+531), and wrangler.toml crons all exist. The users table has `digestFrequency`, `digestDay`, `lastDigestSentAt` columns. **Only the settings UI is missing.**

### Task 1: Digest Preferences UI on Account Settings

**Files:**

- Create: `apps/web/src/components/settings/digest-preferences-section.tsx`
- Modify: `apps/web/src/app/dashboard/settings/page.tsx` (add to notifications tab)

**Step 1: Create the digest preferences component**

Create `apps/web/src/components/settings/digest-preferences-section.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

const FREQUENCY_OPTIONS = [
  { value: "off", label: "Off", description: "No email digests" },
  { value: "weekly", label: "Weekly", description: "Every Monday at 9 AM UTC" },
  {
    value: "monthly",
    label: "Monthly",
    description: "1st of each month at 9 AM UTC",
  },
] as const;

export function DigestPreferencesSection() {
  const { data: me, mutate } = useApiSWR(
    "me",
    useCallback(() => api.account.getMe(), []),
  );
  const [saving, setSaving] = useState(false);
  const [frequency, setFrequency] = useState<string | null>(null);
  const { toast } = useToast();

  const currentFreq = frequency ?? me?.digestFrequency ?? "off";

  async function handleSave() {
    setSaving(true);
    try {
      await api.account.updateProfile({ digestFrequency: currentFreq });
      await mutate();
      toast({ title: "Digest preferences saved" });
    } catch (err: any) {
      toast({
        title: "Failed to save",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email Digests</CardTitle>
        <CardDescription>
          Receive periodic score reports and improvement summaries for all your
          projects.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                currentFreq === opt.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="digestFrequency"
                value={opt.value}
                checked={currentFreq === opt.value}
                onChange={() => setFrequency(opt.value)}
                className="accent-primary"
              />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            </label>
          ))}
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to account settings notifications tab**

In `apps/web/src/app/dashboard/settings/page.tsx`, import and add to the notifications tab content:

```tsx
import { DigestPreferencesSection } from "@/components/settings/digest-preferences-section";

// Inside the notifications TabsContent, add before or after NotificationChannelsSection:
<DigestPreferencesSection />;
```

**Step 3: Verify the `updateProfile` API accepts `digestFrequency`**

Check `apps/web/src/lib/api.ts` — the `account.updateProfile()` method should already accept arbitrary profile fields. If `digestFrequency` isn't in the type, add it to the `UpdateProfileInput` interface.

Also check `packages/shared/src/schemas/api.ts` — `UpdateProfileSchema` may need `digestFrequency: z.enum(["off", "weekly", "monthly"]).optional()` added.

**Step 4: Typecheck**

Run: `pnpm typecheck`

**Step 5: Commit**

```
feat(web): add email digest preferences UI to account settings
```

---

## Phase 2: Custom Scoring Profiles

### Task 2: DB Schema — scoring_profiles table

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/queries/scoring-profiles.ts`
- Modify: `packages/db/src/index.ts` (export new queries)

**Step 1: Add table to schema**

In `packages/db/src/schema.ts`, add after the existing tables:

```typescript
export const scoringProfiles = pgTable("scoring_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  weights: jsonb("weights")
    .$type<{
      technical: number;
      content: number;
      aiReadiness: number;
      performance: number;
    }>()
    .notNull(),
  disabledFactors: jsonb("disabled_factors").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Also add `scoringProfileId` to the `projects` table:

```typescript
scoringProfileId: uuid("scoring_profile_id"),
```

**Step 2: Create query helpers**

Create `packages/db/src/queries/scoring-profiles.ts`:

```typescript
import { eq, and, desc } from "drizzle-orm";
import type { Database } from "../client";
import { scoringProfiles } from "../schema";

export function scoringProfileQueries(db: Database) {
  return {
    async create(data: typeof scoringProfiles.$inferInsert) {
      const [row] = await db.insert(scoringProfiles).values(data).returning();
      return row;
    },
    async listByUser(userId: string) {
      return db.query.scoringProfiles.findMany({
        where: eq(scoringProfiles.userId, userId),
        orderBy: desc(scoringProfiles.createdAt),
      });
    },
    async getById(id: string) {
      return db.query.scoringProfiles.findFirst({
        where: eq(scoringProfiles.id, id),
      });
    },
    async update(
      id: string,
      data: Partial<typeof scoringProfiles.$inferInsert>,
    ) {
      const [row] = await db
        .update(scoringProfiles)
        .set(data)
        .where(eq(scoringProfiles.id, id))
        .returning();
      return row;
    },
    async delete(id: string) {
      await db.delete(scoringProfiles).where(eq(scoringProfiles.id, id));
    },
  };
}
```

**Step 3: Export from index**

Add to `packages/db/src/index.ts`:

```typescript
export { scoringProfileQueries } from "./queries/scoring-profiles";
```

**Step 4: Generate migration**

Run: `cd packages/db && npx drizzle-kit generate`

**Step 5: Typecheck + commit**

Run: `pnpm typecheck`

```
feat(db): add scoring_profiles table and project scoringProfileId column
```

---

### Task 3: Scoring Engine — Custom Weights Support

**Files:**

- Modify: `packages/scoring/src/engine.ts` (lines 9-14, 24, 59-64)
- Create: `packages/scoring/src/profiles.ts`

**Step 1: Add presets file**

Create `packages/scoring/src/profiles.ts`:

```typescript
export interface ScoringWeights {
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  technical: 25,
  content: 30,
  aiReadiness: 30,
  performance: 15,
};

export const SCORING_PRESETS: Record<string, ScoringWeights> = {
  default: DEFAULT_WEIGHTS,
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

/** Normalize weights to sum to 1.0 for multiplication */
export function normalizeWeights(w: ScoringWeights): {
  technical: number;
  content: number;
  ai_readiness: number;
  performance: number;
} {
  const total = w.technical + w.content + w.aiReadiness + w.performance;
  return {
    technical: w.technical / total,
    content: w.content / total,
    ai_readiness: w.aiReadiness / total,
    performance: w.performance / total,
  };
}
```

**Step 2: Update scoring engine**

In `packages/scoring/src/engine.ts`, replace the hardcoded `WEIGHTS` constant (lines 9-14) and update `scorePage` function signature:

```typescript
import { normalizeWeights, DEFAULT_WEIGHTS, type ScoringWeights } from "./profiles";

// Replace WEIGHTS constant with:
const WEIGHTS = normalizeWeights(DEFAULT_WEIGHTS);

// Update scorePage signature to accept optional weights:
export function scorePage(page: PageData, customWeights?: ScoringWeights): ScoringResult {
  const w = customWeights ? normalizeWeights(customWeights) : WEIGHTS;
  // ... rest of function uses `w` instead of `WEIGHTS`
```

Update the overall score calculation (lines 59-64) to use `w`:

```typescript
const overallScore = Math.round(
  technical.score * w.technical +
    content.score * w.content +
    aiReadiness.score * w.ai_readiness +
    performance.score * w.performance,
);
```

**Step 3: Export presets from package**

Add to `packages/scoring/src/index.ts`:

```typescript
export {
  SCORING_PRESETS,
  DEFAULT_WEIGHTS,
  normalizeWeights,
  type ScoringWeights,
} from "./profiles";
```

**Step 4: Run existing tests to verify no regressions**

Run: `cd packages/scoring && pnpm test`
Expected: All 119 tests pass (default weights unchanged)

**Step 5: Commit**

```
feat(scoring): support custom category weights with industry presets
```

---

### Task 4: Scoring Profiles API Routes

**Files:**

- Create: `apps/api/src/routes/scoring-profiles.ts`
- Modify: `apps/api/src/index.ts` (mount route)

**Step 1: Create route file**

Create `apps/api/src/routes/scoring-profiles.ts` with CRUD:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { scoringProfileQueries, projectQueries } from "@llm-boost/db";
import { z } from "zod";

export const scoringProfileRoutes = new Hono<AppEnv>();
scoringProfileRoutes.use("*", authMiddleware);

const createSchema = z.object({
  name: z.string().min(1).max(128),
  weights: z
    .object({
      technical: z.number().min(0).max(100),
      content: z.number().min(0).max(100),
      aiReadiness: z.number().min(0).max(100),
      performance: z.number().min(0).max(100),
    })
    .refine(
      (w) => w.technical + w.content + w.aiReadiness + w.performance === 100,
      {
        message: "Weights must sum to 100",
      },
    ),
  disabledFactors: z.array(z.string()).optional(),
});

// POST / — Create profile
scoringProfileRoutes.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = createSchema.safeParse(await c.req.json());
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
  const profile = await scoringProfileQueries(db).create({
    userId,
    ...body.data,
  });
  return c.json({ data: profile }, 201);
});

// GET / — List user's profiles
scoringProfileRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const profiles = await scoringProfileQueries(db).listByUser(userId);
  return c.json({ data: profiles });
});

// PUT /:id — Update profile
scoringProfileRoutes.put("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await scoringProfileQueries(db).getById(id);
  if (!existing || existing.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Profile not found" } },
      404,
    );
  }
  const body = createSchema.partial().safeParse(await c.req.json());
  if (!body.success) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request" } },
      422,
    );
  }
  const updated = await scoringProfileQueries(db).update(id, body.data);
  return c.json({ data: updated });
});

// DELETE /:id — Delete profile
scoringProfileRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await scoringProfileQueries(db).getById(id);
  if (!existing || existing.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Profile not found" } },
      404,
    );
  }
  await scoringProfileQueries(db).delete(id);
  return c.json({ data: { deleted: true } });
});
```

**Step 2: Mount in index.ts**

In `apps/api/src/index.ts`, add:

```typescript
import { scoringProfileRoutes } from "./routes/scoring-profiles";
// Add to route mounts:
app.route("/api/scoring-profiles", scoringProfileRoutes);
```

**Step 3: Typecheck + commit**

Run: `pnpm typecheck`

```
feat(api): add CRUD routes for custom scoring profiles
```

---

### Task 5: Scoring Profiles Frontend

**Files:**

- Modify: `apps/web/src/lib/api.ts` (add client methods + types)
- Create: `apps/web/src/components/settings/scoring-profile-section.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx` (add to settings tab)

**Step 1: Add API client methods**

In `apps/web/src/lib/api.ts`, add types:

```typescript
export interface ScoringProfile {
  id: string;
  name: string;
  weights: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  };
  disabledFactors: string[];
  isDefault: boolean;
  createdAt: string;
}
```

Add to the `api` object:

```typescript
scoringProfiles: {
  async list(): Promise<ScoringProfile[]> {
    const res = await apiClient.get<ApiEnvelope<ScoringProfile[]>>("/api/scoring-profiles");
    return res.data;
  },
  async create(data: { name: string; weights: ScoringProfile["weights"] }): Promise<ScoringProfile> {
    const res = await apiClient.post<ApiEnvelope<ScoringProfile>>("/api/scoring-profiles", data);
    return res.data;
  },
  async update(id: string, data: Partial<{ name: string; weights: ScoringProfile["weights"] }>): Promise<ScoringProfile> {
    const res = await apiClient.put<ApiEnvelope<ScoringProfile>>(`/api/scoring-profiles/${id}`, data);
    return res.data;
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/scoring-profiles/${id}`);
  },
},
```

**Step 2: Create the UI component**

Create `apps/web/src/components/settings/scoring-profile-section.tsx` — A card with:

- Preset dropdown (Default, E-commerce, Blog, SaaS, Local Business, Custom)
- 4 range sliders for weights that must sum to 100
- Live total validation
- Save button that creates/updates profile and assigns to project

**Step 3: Add to project settings**

In the project detail page settings tab, add `<ScoringProfileSection projectId={params.id} />` alongside the existing BrandingSettingsForm.

**Step 4: Typecheck + commit**

Run: `pnpm typecheck`

```
feat(web): add scoring profile configuration UI with industry presets
```

---

## Phase 3: Bulk Export & Content Generators

### Task 6: CSV/JSON Export API

**Files:**

- Create: `apps/api/src/routes/exports.ts`
- Modify: `apps/api/src/index.ts` (mount route)

**Step 1: Create export route**

Create `apps/api/src/routes/exports.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { withOwnership } from "../middleware/ownership";
import { pageQueries, scoreQueries, crawlQueries } from "@llm-boost/db";

export const exportRoutes = new Hono<AppEnv>();
exportRoutes.use("*", authMiddleware);

// GET /api/projects/:id/export?format=csv|json
exportRoutes.get("/:id/export", withOwnership("project"), async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");
  const format = c.req.query("format") ?? "csv";

  // Get latest completed crawl
  const crawls = await crawlQueries(db).listByProject(projectId);
  const latest = crawls.find((cr: any) => cr.status === "complete");
  if (!latest) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "No completed crawl" } },
      404,
    );
  }

  const pages = await pageQueries(db).listByJob(latest.id);
  const scores = await scoreQueries(db).listByJob(latest.id);
  const scoreMap = new Map(scores.map((s: any) => [s.pageId, s]));

  const rows = pages.map((p: any) => {
    const s = scoreMap.get(p.id);
    return {
      url: p.url,
      title: p.title ?? "",
      overallScore: s?.overallScore ?? 0,
      technical: s?.technicalScore ?? 0,
      content: s?.contentScore ?? 0,
      aiReadiness: s?.aiReadinessScore ?? 0,
      performance: s?.lighthousePerf ?? 0,
      letterGrade: s?.letterGrade ?? "F",
      issueCount: s?.issueCount ?? 0,
    };
  });

  if (format === "json") {
    return c.json({ data: rows });
  }

  // CSV
  const headers = [
    "URL",
    "Title",
    "Overall",
    "Technical",
    "Content",
    "AI Readiness",
    "Performance",
    "Grade",
    "Issues",
  ];
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        `"${r.url}"`,
        `"${r.title.replace(/"/g, '""')}"`,
        r.overallScore,
        r.technical,
        r.content,
        r.aiReadiness,
        r.performance,
        r.letterGrade,
        r.issueCount,
      ].join(","),
    ),
  ];

  return new Response(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="export-${projectId}.csv"`,
    },
  });
});
```

**Step 2: Mount in index.ts**

```typescript
import { exportRoutes } from "./routes/exports";
app.route("/api/projects", exportRoutes); // Mounts under /api/projects/:id/export
```

Note: This shares the `/api/projects` prefix with existing project routes. Alternatively, mount as `/api/exports` and adjust the path.

**Step 3: Typecheck + commit**

```
feat(api): add CSV/JSON export endpoint for crawl data
```

---

### Task 7: Sitemap & llms.txt Generator API

**Files:**

- Create: `apps/api/src/services/generator-service.ts`
- Create: `apps/api/src/routes/generators.ts`
- Modify: `apps/api/src/index.ts` (mount route)

**Step 1: Create generator service**

Create `apps/api/src/services/generator-service.ts`:

```typescript
export function createGeneratorService() {
  return {
    generateSitemap(pages: { url: string; lastmod?: string }[]) {
      const entries = pages
        .map(
          (p) =>
            `  <url>\n    <loc>${escapeXml(p.url)}</loc>\n    <lastmod>${p.lastmod ?? new Date().toISOString().split("T")[0]}</lastmod>\n  </url>`,
        )
        .join("\n");
      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
    },

    generateLlmsTxt(data: {
      title: string;
      description: string;
      pages: { url: string; title: string; description?: string }[];
    }) {
      const entries = data.pages
        .map(
          (p) =>
            `- [${p.title}](${p.url})${p.description ? `: ${p.description}` : ""}`,
        )
        .join("\n");
      return `# ${data.title}\n\n> ${data.description}\n\n## Pages\n\n${entries}`;
    },
  };
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

**Step 2: Create generator routes**

Create `apps/api/src/routes/generators.ts` with:

- `POST /api/projects/:id/generate/sitemap` — Returns XML
- `POST /api/projects/:id/generate/llms-txt` — Returns plain text

Both pull page data from the latest completed crawl.

**Step 3: Mount + typecheck + commit**

```
feat(api): add sitemap and llms.txt generator service and routes
```

---

### Task 8: Export & Generator Frontend

**Files:**

- Modify: `apps/web/src/lib/api.ts` (add client methods)
- Create: `apps/web/src/components/generators/generator-modal.tsx`
- Modify: `apps/web/src/components/tabs/overview-tab.tsx` (add buttons)

**Step 1: Add API client methods for exports and generators**

**Step 2: Create a reusable GeneratorModal component**

A dialog that shows a text preview (XML or plain text), with "Copy" and "Download" buttons.

**Step 3: Add export/generator buttons to overview tab**

After the "View All Pages" link, add a row of action buttons:

- "Export CSV" — triggers download
- "Generate Sitemap" — opens modal with XML preview
- "Generate llms.txt" — opens modal with text preview

**Step 4: Typecheck + commit**

```
feat(web): add export buttons and content generator modals
```

---

## Phase 4: Public Leaderboard & Benchmarks

### Task 9: Benchmark Aggregation Cron

**Files:**

- Create: `apps/api/src/services/benchmark-aggregation-service.ts`
- Modify: `apps/api/src/index.ts` (add to scheduled handler)

**Step 1: Create aggregation service**

Create `apps/api/src/services/benchmark-aggregation-service.ts`:

```typescript
import { scoreQueries, crawlQueries } from "@llm-boost/db";
import type { Database } from "@llm-boost/db";

export async function aggregateBenchmarks(db: Database, kv: KVNamespace) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all scores from recent completed crawls
  const allScores = await scoreQueries(db).getRecentScores(thirtyDaysAgo);
  if (allScores.length === 0) return;

  const scores = allScores
    .map((s: any) => s.overallScore)
    .filter(Boolean)
    .sort((a: number, b: number) => a - b);
  const percentile = (p: number) => scores[Math.floor(scores.length * p)] ?? 0;

  const benchmarks = {
    p10: percentile(0.1),
    p25: percentile(0.25),
    p50: percentile(0.5),
    p75: percentile(0.75),
    p90: percentile(0.9),
    count: scores.length,
    updatedAt: new Date().toISOString(),
  };

  await kv.put("benchmarks:overall", JSON.stringify(benchmarks), {
    expirationTtl: 86400,
  });
}
```

**Step 2: Add to scheduled handler**

In `apps/api/src/index.ts`, add a daily cron (e.g., `"0 4 * * *"` at 4 AM UTC):

```typescript
if (controller.cron === "0 4 * * *") {
  await aggregateBenchmarks(db, env.KV);
}
```

Add `"0 4 * * *"` to the crons array in `wrangler.toml`.

**Step 3: Commit**

```
feat(api): add daily benchmark aggregation cron job
```

---

### Task 10: Public Benchmarks Endpoint

**Files:**

- Modify: `apps/api/src/routes/public.ts` (add benchmarks route)

**Step 1: Add endpoint**

In `apps/api/src/routes/public.ts`, add:

```typescript
// GET /api/public/benchmarks
publicRoutes.get("/benchmarks", async (c) => {
  const data = await c.env.KV.get("benchmarks:overall", "json");
  if (!data) return c.json({ data: null });
  return c.json({ data });
});
```

**Step 2: Commit**

```
feat(api): add public benchmarks percentile endpoint
```

---

### Task 11: Leaderboard Opt-In + Schema

**Files:**

- Modify: `packages/db/src/schema.ts` (add `leaderboardOptIn` to projects)
- Generate migration

**Step 1: Add column**

In `packages/db/src/schema.ts`, add to the projects table:

```typescript
leaderboardOptIn: boolean("leaderboard_opt_in").notNull().default(false),
```

**Step 2: Generate migration + commit**

```
feat(db): add leaderboard opt-in column to projects
```

---

### Task 12: Percentile Badge + Leaderboard Page

**Files:**

- Modify: `apps/web/src/lib/api.ts` (add client methods)
- Create: `apps/web/src/components/percentile-badge.tsx`
- Modify: `apps/web/src/app/dashboard/page.tsx` (add badge)
- Create: `apps/web/src/app/leaderboard/page.tsx`

**Step 1: Add API client for public benchmarks**

**Step 2: Create percentile badge component**

Shows: "Your average score of {X} puts you in the top {Y}% of all sites scanned."

**Step 3: Add to dashboard home**

After the stats cards section.

**Step 4: Create leaderboard page**

`/leaderboard` — public page showing opt-in projects ranked by score. Filterable by grade range.

**Step 5: Typecheck + commit**

```
feat(web): add percentile badge and public leaderboard page
```

---

## Phase 5: Team Collaboration & RBAC

### Task 13: Teams DB Schema

**Files:**

- Modify: `packages/db/src/schema.ts` (add 3 tables + projects.teamId)
- Create: `packages/db/src/queries/teams.ts`
- Modify: `packages/db/src/index.ts` (export)

**Step 1: Add schema**

```typescript
export const teamRoleEnum = pgEnum("team_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  plan: planEnum("plan").notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: teamRoleEnum("role").notNull().default("viewer"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const teamInvitations = pgTable("team_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: teamRoleEnum("role").notNull().default("viewer"),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Add to projects table: `teamId: uuid("team_id").references(() => teams.id)`

**Step 2: Create query helpers**

Create `packages/db/src/queries/teams.ts` with: `create`, `getById`, `listByUser`, `addMember`, `removeMember`, `updateMemberRole`, `createInvitation`, `getInvitationByToken`, `deleteInvitation`, `listMembers`.

**Step 3: Generate migration + export + commit**

```
feat(db): add teams, team_members, team_invitations tables
```

---

### Task 14: Team Auth Middleware

**Files:**

- Create: `apps/api/src/middleware/team-auth.ts`

**Step 1: Create middleware**

Middleware that:

1. Reads `teamId` from route param or query
2. Checks if `userId` is a member
3. Checks role permissions based on required level
4. Sets `c.set("teamRole", role)` and `c.set("teamId", teamId)`

**Step 2: Define permission levels**

```typescript
const ROLE_LEVELS: Record<string, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function requireTeamRole(minRole: string): MiddlewareHandler<AppEnv> { ... }
```

**Step 3: Commit**

```
feat(api): add team auth middleware with role-based permissions
```

---

### Task 15: Team API Routes

**Files:**

- Create: `apps/api/src/routes/teams.ts`
- Modify: `apps/api/src/index.ts` (mount)

**Step 1: Create routes**

- `POST /api/teams` — Create team (auto-add creator as owner)
- `GET /api/teams` — List user's teams
- `GET /api/teams/:id` — Get team detail with members
- `POST /api/teams/:id/invite` — Send invitation (generates token, sends email via Resend)
- `POST /api/teams/accept-invite` — Accept invitation via token
- `PATCH /api/teams/:id/members/:memberId` — Update role
- `DELETE /api/teams/:id/members/:memberId` — Remove member

**Step 2: Mount + commit**

```
feat(api): add team management routes with invitations
```

---

### Task 16: Team Frontend

**Files:**

- Modify: `apps/web/src/lib/api.ts` (add team client methods)
- Create: `apps/web/src/app/dashboard/team/page.tsx`
- Create: `apps/web/src/components/team/member-list.tsx`
- Create: `apps/web/src/components/team/invite-dialog.tsx`

**Step 1: Add API client methods for teams**

**Step 2: Create team management page**

`/dashboard/team` — Shows team name, member list with roles, invite button.

**Step 3: Create member list and invite dialog components**

**Step 4: Typecheck + commit**

```
feat(web): add team management page with invitations
```

---

## Phase 6: WordPress Plugin Completion

### Task 17: Lightweight Scoring API Endpoint

**Files:**

- Modify: `apps/api/src/routes/v1.ts` (or create if needed)

**Step 1: Add endpoint**

`POST /api/v1/score` — Accepts `{ title, content, url, metaDescription }`, runs a subset of scoring factors (no crawl, no Lighthouse), returns scores + top 5 issues. Auth via API token.

**Step 2: Commit**

```
feat(api): add lightweight /api/v1/score endpoint for real-time scoring
```

---

### Task 18: Gutenberg Sidebar Panel

**Files:**

- Create: `apps/wordpress-plugin/assets/js/editor-panel.js`
- Create: `apps/wordpress-plugin/assets/css/editor-panel.css`
- Modify: `apps/wordpress-plugin/llm-boost.php` (register Gutenberg sidebar)

**Step 1: Create React sidebar panel**

Using `@wordpress/plugins`, `@wordpress/edit-post`, `@wordpress/data` to:

1. Register a PluginSidebar component
2. Extract post title, content, excerpt via editor selectors
3. Debounce (5s) and send to LLM Rank API for scoring
4. Display score circle, category breakdown, top 3 issues

**Step 2: Register in main plugin file**

**Step 3: Commit**

```
feat(wordpress): add Gutenberg sidebar panel with real-time AI scoring
```

---

## Phase 7: Final Verification

### Task 19: Full E2E Verification

**Step 1:** Run `pnpm typecheck` — all packages must pass
**Step 2:** Run `pnpm test` — no new test failures
**Step 3:** Fix any issues found
**Step 4:** Commit fixes if needed

---

## Execution Summary

| Phase | Section              | Tasks | Key Files                              |
| ----- | -------------------- | ----- | -------------------------------------- |
| 1     | Email Digest UI      | 1     | settings, digest-preferences-section   |
| 2     | Custom Scoring       | 2-5   | schema, engine, profiles, routes, UI   |
| 3     | Exports & Generators | 6-8   | exports route, generator service, UI   |
| 4     | Leaderboard          | 9-12  | aggregation, public route, badge, page |
| 5     | Teams & RBAC         | 13-16 | schema, middleware, routes, UI         |
| 6     | WordPress            | 17-18 | v1 scoring, Gutenberg sidebar          |
| 7     | Verification         | 19    | typecheck + test                       |

**Total: 19 tasks across 7 phases.**
