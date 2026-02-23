# Public Sharing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to share AI-readiness reports publicly via configurable links and embeddable card-style SVG badges.

**Architecture:** Extend existing `crawlJobs` share infrastructure (token/enabled/sharedAt) with `shareLevel` enum and `shareExpiresAt` timestamp. Modify existing public report endpoint to filter by level and check expiry. Add SVG badge endpoint. Build public Next.js page at `/share/[token]`. Create ShareButton modal component for the dashboard.

**Tech Stack:** Drizzle ORM (pgEnum, migration), Hono (API routes), Next.js App Router (public page), SVG (badge), shadcn/ui (modal)

---

### Task 1: Add shareLevel enum and shareExpiresAt column to schema

**Files:**

- Modify: `packages/db/src/schema.ts` (add enum ~line 113, add columns ~line 256)

**Step 1: Add the pgEnum and columns**

In `packages/db/src/schema.ts`, after the last enum definition (~line 113, after `fixStatusEnum`), add:

```typescript
export const shareLevelEnum = pgEnum("share_level", [
  "summary",
  "issues",
  "full",
]);
```

In the `crawlJobs` table definition, after the `sharedAt` column (~line 256), add:

```typescript
    shareLevel: shareLevelEnum("share_level").default("summary"),
    shareExpiresAt: timestamp("share_expires_at"),
```

**Step 2: Export the enum from the package barrel**

In `packages/db/src/index.ts`, verify `shareLevelEnum` is exported (it should be if schema.ts is re-exported via `*`).

**Step 3: Generate the migration**

Run: `cd packages/db && npx drizzle-kit generate`

Expect: A new migration file `0008_*.sql` with `CREATE TYPE share_level` and two `ALTER TABLE crawl_jobs ADD COLUMN` statements.

**Step 4: Push to dev database**

Run: `cd packages/db && npx drizzle-kit push`

Expected: Schema applied successfully.

**Step 5: Typecheck**

Run: `pnpm typecheck`

Expected: All packages pass.

**Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/migrations/
git commit -m "feat(db): add shareLevel enum and shareExpiresAt column to crawlJobs"
```

---

### Task 2: Update crawl queries for share level and expiry

**Files:**

- Modify: `packages/db/src/queries/crawls.ts` (~lines 70-94)

**Step 1: Update generateShareToken to accept level and expiresAt**

Modify the `generateShareToken` function:

```typescript
async generateShareToken(
  id: string,
  options?: { level?: "summary" | "issues" | "full"; expiresAt?: Date | null },
) {
  const token = crypto.randomUUID();
  const [updated] = await db
    .update(crawlJobs)
    .set({
      shareToken: token,
      shareEnabled: true,
      sharedAt: new Date(),
      shareLevel: options?.level ?? "summary",
      shareExpiresAt: options?.expiresAt ?? null,
    })
    .where(eq(crawlJobs.id, id))
    .returning();
  return updated;
},
```

**Step 2: Add updateShareSettings query**

After `disableSharing`, add:

```typescript
async updateShareSettings(
  id: string,
  settings: { level?: "summary" | "issues" | "full"; expiresAt?: Date | null },
) {
  const update: Record<string, unknown> = {};
  if (settings.level !== undefined) update.shareLevel = settings.level;
  if (settings.expiresAt !== undefined) update.shareExpiresAt = settings.expiresAt;
  const [updated] = await db
    .update(crawlJobs)
    .set(update)
    .where(eq(crawlJobs.id, id))
    .returning();
  return updated;
},
```

**Step 3: Update getByShareToken to check expiry**

```typescript
async getByShareToken(token: string) {
  const job = await db.query.crawlJobs.findFirst({
    where: (fields, { and, eq: eq_ }) =>
      and(eq_(fields.shareToken, token), eq_(fields.shareEnabled, true)),
  });
  if (!job) return null;
  // Check expiry
  if (job.shareExpiresAt && new Date(job.shareExpiresAt) < new Date()) {
    return null;
  }
  return job;
},
```

**Step 4: Typecheck**

Run: `pnpm typecheck`

Expected: All packages pass.

**Step 5: Commit**

```bash
git add packages/db/src/queries/crawls.ts
git commit -m "feat(db): update share queries with level, expiry, and settings update"
```

---

### Task 3: Update repository and service layer

**Files:**

- Modify: `apps/api/src/repositories/index.ts` (CrawlRepository interface, ~line 86)
- Modify: `apps/api/src/services/crawl-service.ts` (enableSharing ~line 271)

**Step 1: Add updateShareSettings to CrawlRepository interface**

In `apps/api/src/repositories/index.ts`, add to the `CrawlRepository` interface:

```typescript
updateShareSettings(
  id: string,
  settings: { level?: "summary" | "issues" | "full"; expiresAt?: Date | null },
): ReturnType<ReturnType<typeof crawlQueries>["updateShareSettings"]>;
```

And in `createCrawlRepository`, add to the return object:

```typescript
updateShareSettings: (id, settings) => queries.updateShareSettings(id, settings),
```

**Step 2: Update generateShareToken signature in repo**

Update the interface to match the new query signature:

```typescript
generateShareToken(
  id: string,
  options?: { level?: "summary" | "issues" | "full"; expiresAt?: Date | null },
): ReturnType<ReturnType<typeof crawlQueries>["generateShareToken"]>;
```

And the implementation:

```typescript
generateShareToken: (id, options) => queries.generateShareToken(id, options),
```

**Step 3: Update crawl-service.ts enableSharing**

Modify `enableSharing` in `apps/api/src/services/crawl-service.ts` (~line 271):

```typescript
async enableSharing(
  userId: string,
  crawlId: string,
  options?: { level?: "summary" | "issues" | "full"; expiresAt?: Date | null },
) {
  const crawlJob = await deps.crawls.getById(crawlId);
  if (!crawlJob) {
    const err = ERROR_CODES.NOT_FOUND;
    throw new ServiceError("NOT_FOUND", err.status, "Crawl not found");
  }
  await assertProjectOwnership(deps.projects, userId, crawlJob.projectId);
  if (crawlJob.shareToken && crawlJob.shareEnabled) {
    // Update settings if provided, keep existing token
    if (options?.level || options?.expiresAt !== undefined) {
      await deps.crawls.updateShareSettings(crawlId, {
        level: options.level,
        expiresAt: options.expiresAt,
      });
    }
    return {
      shareToken: crawlJob.shareToken,
      shareUrl: `/share/${crawlJob.shareToken}`,
      badgeUrl: `/api/public/badge/${crawlJob.shareToken}.svg`,
      level: options?.level ?? crawlJob.shareLevel ?? "summary",
      expiresAt: options?.expiresAt ?? crawlJob.shareExpiresAt,
    };
  }
  const updated = await deps.crawls.generateShareToken(crawlId, options);
  return {
    shareToken: updated.shareToken,
    shareUrl: `/share/${updated.shareToken}`,
    badgeUrl: `/api/public/badge/${updated.shareToken}.svg`,
    level: updated.shareLevel ?? "summary",
    expiresAt: updated.shareExpiresAt,
  };
},
```

**Step 4: Add updateShareSettings to service**

After `disableSharing`:

```typescript
async updateShareSettings(
  userId: string,
  crawlId: string,
  settings: { level?: "summary" | "issues" | "full"; expiresAt?: Date | null },
) {
  const crawlJob = await deps.crawls.getById(crawlId);
  if (!crawlJob) {
    throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
  }
  await assertProjectOwnership(deps.projects, userId, crawlJob.projectId);
  if (!crawlJob.shareEnabled || !crawlJob.shareToken) {
    throw new ServiceError("BAD_REQUEST", 400, "Sharing is not enabled for this crawl");
  }
  const updated = await deps.crawls.updateShareSettings(crawlId, settings);
  return {
    shareToken: updated.shareToken,
    shareUrl: `/share/${updated.shareToken}`,
    badgeUrl: `/api/public/badge/${updated.shareToken}.svg`,
    level: updated.shareLevel ?? "summary",
    expiresAt: updated.shareExpiresAt,
  };
},
```

**Step 5: Typecheck**

Run: `pnpm typecheck`

Expected: All packages pass.

**Step 6: Commit**

```bash
git add apps/api/src/repositories/index.ts apps/api/src/services/crawl-service.ts
git commit -m "feat(api): update share service with level, expiry, and settings update"
```

---

### Task 4: Update API routes (crawl share + public report)

**Files:**

- Modify: `apps/api/src/routes/crawls.ts` (~lines 170-213)
- Modify: `apps/api/src/routes/public.ts` (~lines 231-326)

**Step 1: Update POST /:id/share to accept level and expiresAt**

In `apps/api/src/routes/crawls.ts`, modify the share POST handler:

```typescript
crawlRoutes.post("/:id/share", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const service = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const data = await service.enableSharing(userId, crawlId, {
      level: body.level,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 2: Add PATCH /:id/share for updating settings**

After the DELETE handler:

```typescript
crawlRoutes.patch("/:id/share", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const crawlId = c.req.param("id");
  const body = await c.req.json();

  const service = createCrawlService({
    crawls: createCrawlRepository(db),
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    scores: createScoreRepository(db),
  });

  try {
    const data = await service.updateShareSettings(userId, crawlId, {
      level: body.level,
      expiresAt:
        body.expiresAt === null
          ? null
          : body.expiresAt
            ? new Date(body.expiresAt)
            : undefined,
    });
    return c.json({ data });
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 3: Update public report endpoint to filter by shareLevel**

In `apps/api/src/routes/public.ts`, modify the `/reports/:token` handler. After fetching `crawlJob`, add level-based response filtering:

```typescript
// After: const aggregated = aggregateReportData(raw, { type: "detailed" });
const level = (crawlJob.shareLevel as string) || "summary";
const quickWins = level === "summary" ? [] : aggregated.quickWins.slice(0, 5);

c.header("Cache-Control", "public, max-age=3600");
return c.json({
  data: {
    shareLevel: level,
    crawlId: crawlJob.id,
    projectId: project.id,
    completedAt: crawlJob.completedAt,
    pagesScored: crawlJob.pagesScored,
    summary: crawlJob.summary,
    summaryData: crawlJob.summaryData ?? null,
    project: {
      name: project.name,
      domain: project.domain,
      branding: (project.branding as any) ?? null,
    },
    scores: {
      overall: aggregated.scores.overall,
      technical: aggregated.scores.technical,
      content: aggregated.scores.content,
      aiReadiness: aggregated.scores.aiReadiness,
      performance: aggregated.scores.performance,
      letterGrade: aggregated.scores.letterGrade,
    },
    // Only include pages for "issues" and "full" levels
    pages:
      level !== "summary"
        ? aggregated.pages.map((p) => ({
            url: p.url,
            title: p.title,
            overallScore: p.overall,
            technicalScore: p.technical,
            contentScore: p.content,
            aiReadinessScore: p.aiReadiness,
            issueCount: p.issueCount,
          }))
        : [],
    issueCount: aggregated.issues.total,
    readinessCoverage: aggregated.readinessCoverage,
    scoreDeltas: level === "full" ? aggregated.scoreDeltas : null,
    quickWins: quickWins.map((win) => ({
      code: win.code,
      category: win.category,
      severity: win.severity,
      scoreImpact: win.scoreImpact,
      effortLevel: win.effort,
      effort: win.effort,
      message: win.message,
      recommendation: win.recommendation,
      priority: win.scoreImpact,
      affectedPages: win.affectedPages,
      owner: win.owner,
      pillar: win.pillar,
      docsUrl: win.docsUrl,
    })),
  },
});
```

**Step 4: Typecheck**

Run: `pnpm typecheck`

Expected: All packages pass.

**Step 5: Commit**

```bash
git add apps/api/src/routes/crawls.ts apps/api/src/routes/public.ts
git commit -m "feat(api): add share level/expiry to routes and filter public reports"
```

---

### Task 5: Add SVG badge endpoint

**Files:**

- Create: `apps/api/src/routes/badge.ts`
- Modify: `apps/api/src/routes/public.ts` (import and mount badge route)

**Step 1: Create the badge route**

Create `apps/api/src/routes/badge.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { crawlQueries, projectQueries } from "@llm-boost/db";
import { createDb } from "@llm-boost/db";

const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "#22c55e", text: "#ffffff" },
  B: { bg: "#3b82f6", text: "#ffffff" },
  C: { bg: "#eab308", text: "#1a1a1a" },
  D: { bg: "#f97316", text: "#ffffff" },
  F: { bg: "#ef4444", text: "#ffffff" },
};

function renderBadgeSvg(data: {
  grade: string;
  score: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
  domain: string;
  scannedAt: string;
}): string {
  const color = GRADE_COLORS[data.grade] ?? GRADE_COLORS.F;
  const dateStr = new Date(data.scannedAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="100%" stop-color="#181825"/>
    </linearGradient>
  </defs>
  <rect width="320" height="120" rx="8" fill="url(#bg)"/>
  <rect x="1" y="1" width="318" height="118" rx="7" fill="none" stroke="#333" stroke-width="1"/>

  <!-- Title -->
  <text x="16" y="24" font-family="system-ui,sans-serif" font-size="11" fill="#a0a0b0" font-weight="500">AI Readiness Score</text>

  <!-- Grade box -->
  <rect x="16" y="32" width="40" height="40" rx="6" fill="${color.bg}"/>
  <text x="36" y="59" font-family="system-ui,sans-serif" font-size="22" fill="${color.text}" font-weight="700" text-anchor="middle">${data.grade}</text>

  <!-- Score -->
  <text x="68" y="50" font-family="system-ui,sans-serif" font-size="20" fill="#e0e0e0" font-weight="600">${data.score}</text>
  <text x="${68 + String(data.score).length * 12}" y="50" font-family="system-ui,sans-serif" font-size="12" fill="#666"> / 100</text>

  <!-- Category scores -->
  <text x="16" y="90" font-family="system-ui,sans-serif" font-size="10" fill="#888">Tech ${data.technical}  ·  Content ${data.content}  ·  AI ${data.aiReadiness}  ·  Perf ${data.performance}</text>

  <!-- Domain + date -->
  <text x="16" y="108" font-family="system-ui,sans-serif" font-size="10" fill="#555">${data.domain}  ·  Scanned ${dateStr}</text>

  <!-- Branding -->
  <text x="304" y="108" font-family="system-ui,sans-serif" font-size="9" fill="#444" text-anchor="end">LLM Rank</text>
</svg>`;
}

export const badgeRoutes = new Hono<AppEnv>();

badgeRoutes.get("/:token.svg", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");

  const crawlJob = await crawlQueries(db).getByShareToken(token);
  if (!crawlJob) {
    // Return a "not found" badge
    c.header("Content-Type", "image/svg+xml");
    c.header("Cache-Control", "public, max-age=300");
    return c.body(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="30" viewBox="0 0 200 30">
        <rect width="200" height="30" rx="4" fill="#333"/>
        <text x="100" y="19" font-family="system-ui,sans-serif" font-size="11" fill="#999" text-anchor="middle">Report not found</text>
      </svg>`,
    );
  }

  const project = await projectQueries(db).getById(crawlJob.projectId);
  if (!project) {
    c.header("Content-Type", "image/svg+xml");
    c.header("Cache-Control", "public, max-age=300");
    return c.body(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="30"><text x="10" y="20" fill="#999" font-size="11">Not found</text></svg>`,
    );
  }

  const sd = (crawlJob.summaryData as Record<string, unknown>) ?? {};
  const cats = (sd.categoryScores as Record<string, number>) ?? {};

  const badge = renderBadgeSvg({
    grade: typeof sd.letterGrade === "string" ? sd.letterGrade : "F",
    score:
      typeof sd.overallScore === "number" ? Math.round(sd.overallScore) : 0,
    technical: Math.round(cats.technical ?? 0),
    content: Math.round(cats.content ?? 0),
    aiReadiness: Math.round(cats.aiReadiness ?? 0),
    performance: Math.round(cats.performance ?? 0),
    domain: project.domain,
    scannedAt:
      crawlJob.completedAt?.toISOString() ?? crawlJob.createdAt.toISOString(),
  });

  c.header("Content-Type", "image/svg+xml");
  c.header("Cache-Control", "public, max-age=3600");
  return c.body(badge);
});
```

**Step 2: Mount in public routes**

In `apps/api/src/routes/public.ts`, import and mount:

```typescript
import { badgeRoutes } from "./badge";

// After other public route definitions:
publicRoutes.route("/badge", badgeRoutes);
```

**Step 3: Typecheck**

Run: `pnpm typecheck`

Expected: All packages pass.

**Step 4: Commit**

```bash
git add apps/api/src/routes/badge.ts apps/api/src/routes/public.ts
git commit -m "feat(api): add SVG card badge endpoint for public sharing"
```

---

### Task 6: Update frontend API client

**Files:**

- Modify: `apps/web/src/lib/api.ts` (~lines 1631-1645, share namespace)

**Step 1: Add types**

Near the other interface definitions (~line 280), add:

```typescript
export interface ShareInfo {
  shareToken: string;
  shareUrl: string;
  badgeUrl: string;
  level: "summary" | "issues" | "full";
  expiresAt: string | null;
}

export interface PublicReport {
  shareLevel: string;
  crawlId: string;
  projectId: string;
  completedAt: string;
  pagesScored: number;
  summary: string | null;
  summaryData: {
    overallScore: number;
    letterGrade: string;
    categoryScores: {
      technical: number;
      content: number;
      aiReadiness: number;
      performance: number;
    };
    quickWins: unknown[];
  } | null;
  project: { name: string; domain: string; branding: unknown };
  scores: {
    overall: number;
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
    letterGrade: string;
  };
  pages: Array<{
    url: string;
    title: string;
    overallScore: number;
    technicalScore: number;
    contentScore: number;
    aiReadinessScore: number;
    issueCount: number;
  }>;
  issueCount: number;
  readinessCoverage: Record<string, number>;
  scoreDeltas: Record<string, number> | null;
  quickWins: Array<{
    code: string;
    category: string;
    severity: string;
    scoreImpact: number;
    effortLevel: string;
    message: string;
    recommendation: string;
    affectedPages: number;
  }>;
}
```

**Step 2: Update the share namespace**

Replace the existing `share` object (~lines 1631-1645):

```typescript
share: {
  async enable(
    crawlId: string,
    options?: { level?: "summary" | "issues" | "full"; expiresAt?: string | null },
  ): Promise<ShareInfo> {
    const res = await apiClient.post<ApiEnvelope<ShareInfo>>(
      `/api/crawls/${crawlId}/share`,
      options,
    );
    return res.data;
  },

  async update(
    crawlId: string,
    settings: { level?: "summary" | "issues" | "full"; expiresAt?: string | null },
  ): Promise<ShareInfo> {
    const res = await apiClient.patch<ApiEnvelope<ShareInfo>>(
      `/api/crawls/${crawlId}/share`,
      settings,
    );
    return res.data;
  },

  async disable(crawlId: string): Promise<void> {
    await apiClient.delete(`/api/crawls/${crawlId}/share`);
  },

  async getPublicReport(token: string): Promise<PublicReport> {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/public/reports/${token}`,
    );
    if (!res.ok) throw new Error("Report not found");
    const json = await res.json();
    return json.data;
  },
},
```

**Step 3: Typecheck**

Run: `pnpm typecheck`

Expected: All packages pass.

**Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): update share API client with level, expiry, and public report types"
```

---

### Task 7: Create ShareButton modal component

**Files:**

- Create: `apps/web/src/components/share/share-modal.tsx`

**Step 1: Create the ShareModal component**

This is a complex UI component with meaningful design decisions. Create `apps/web/src/components/share/share-modal.tsx` using shadcn Dialog, RadioGroup, Select, and Button components. The modal has two states:

**State 1 — Configure (no active share):** Radio for level selection (Summary / Issues / Full), dropdown for expiry (Permanent / 7d / 30d / 90d), "Generate Link" button.

**State 2 — Manage (share active):** Show share URL with copy button, badge embed code in tabs (HTML / Markdown) with copy button, edit level/expiry, "Revoke Access" button with confirmation.

The component should accept `crawlId`, `currentShare` (null or existing share info), and callbacks `onEnable`, `onUpdate`, `onDisable`.

> **User contribution opportunity:** The exact layout, copy text, and tab structure for embed code is a UX decision. The component structure and API integration is straightforward.

**Step 2: Typecheck**

Run: `pnpm typecheck`

**Step 3: Commit**

```bash
git add apps/web/src/components/share/
git commit -m "feat(web): add ShareModal component with level picker, embed code, and revoke"
```

---

### Task 8: Wire ShareButton into crawl detail page

**Files:**

- Modify: `apps/web/src/app/dashboard/crawl/[id]/page.tsx` (~line 144)

**Step 1: Import and use ShareModal**

The crawl detail page already references `<ShareButton crawlId={params.id} />` at line 144. Replace this with a button that opens the ShareModal:

```typescript
import { ShareModal } from "@/components/share/share-modal";

// In component state:
const [shareModalOpen, setShareModalOpen] = useState(false);

// In JSX, replace <ShareButton crawlId={params.id} />:
<Button variant="outline" onClick={() => setShareModalOpen(true)}>
  <Share2 className="h-4 w-4" />
  Share
</Button>
<ShareModal
  open={shareModalOpen}
  onOpenChange={setShareModalOpen}
  crawlId={params.id}
/>
```

**Step 2: Typecheck**

Run: `pnpm typecheck`

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/crawl/[id]/page.tsx
git commit -m "feat(web): wire ShareModal into crawl detail page"
```

---

### Task 9: Create public share page (`/share/[token]`)

**Files:**

- Create: `apps/web/src/app/share/[token]/page.tsx`

**Step 1: Create the public page**

This is a Next.js App Router page at `apps/web/src/app/share/[token]/page.tsx`. It should:

1. Fetch the public report from the API using the token (server-side via `fetch`)
2. Set OG/Twitter meta tags via `generateMetadata` (title: "{domain} AI Readiness: {grade} ({score}/100)")
3. Render based on `shareLevel`:
   - **Summary:** Hero card with grade, score ring, 4 category bars
   - **Issues:** Summary + issue list grouped by severity
   - **Full:** Summary + issues + page table + quick wins + score history
4. Include "Powered by LLM Rank" footer and "Get your free scan" CTA

> **User contribution opportunity:** The visual design of the public page is a creative decision — color scheme, layout, animations. This is where the `frontend-design` skill should be invoked.

**Step 2: Test locally**

Visit `http://localhost:3000/share/test-token` — should show "Report not found" (expected until a real token is used).

**Step 3: Commit**

```bash
git add apps/web/src/app/share/
git commit -m "feat(web): add public share page with level-based rendering and OG tags"
```

---

### Task 10: End-to-end verification

**Step 1: Typecheck all packages**

Run: `pnpm typecheck`

Expected: 11/11 pass.

**Step 2: Run tests**

Run: `pnpm test`

Expected: All existing tests pass (no regressions).

**Step 3: Manual smoke test**

1. Start local dev: `cd apps/web && pnpm dev` and `cd apps/api && pnpm dev`
2. Navigate to a completed crawl's detail page
3. Click "Share" button — modal should open
4. Select "Full" level, "30 days" expiry, click "Generate Link"
5. Copy the share URL, open in incognito — public page should render
6. Copy badge embed URL — should return SVG in browser
7. Click "Revoke Access" — public page should show 404

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: public sharing with configurable reports, SVG badges, and share modal"
```
