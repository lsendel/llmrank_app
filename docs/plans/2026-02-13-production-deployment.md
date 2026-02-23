# LLM Rank Production Deployment Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy LLM Rank to production at https://llmrank.app with working frontend, API, and database.

**Architecture:** Next.js 15 frontend deployed via @opennextjs/cloudflare as a Cloudflare Worker. Hono API deployed as a separate Cloudflare Worker at api.llmrank.app. Neon PostgreSQL for data. Crawler deferred — crawl actions show graceful "service unavailable" messaging.

**Tech Stack:** Next.js 15, @opennextjs/cloudflare, Hono, Drizzle ORM, Neon PostgreSQL, Clerk, Stripe (test mode), Cloudflare Workers/KV/R2

---

### Task 1: Add @opennextjs/cloudflare adapter to frontend

**Files:**

- Modify: `apps/web/package.json`
- Create: `apps/web/wrangler.jsonc`
- Create: `apps/web/open-next.config.ts`
- Modify: `apps/web/.gitignore` (or create)

**Step 1: Install dependencies**

Run: `cd apps/web && pnpm add @opennextjs/cloudflare && pnpm add -D wrangler`

**Step 2: Create wrangler.jsonc**

```jsonc
// apps/web/wrangler.jsonc
{
  "name": "llm-boost-web",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
  },
}
```

**Step 3: Create open-next.config.ts**

```ts
// apps/web/open-next.config.ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
```

**Step 4: Update package.json scripts**

Add to `apps/web/package.json` scripts:

```json
{
  "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
  "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
}
```

**Step 5: Add .open-next to .gitignore**

Create `apps/web/.gitignore`:

```
.open-next
.dev.vars
```

**Step 6: Create .dev.vars for local development**

Create `apps/web/.dev.vars`:

```
NEXTJS_ENV=development
```

**Step 7: Verify build works**

Run: `cd apps/web && NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_placeholder pnpm build`
Expected: Next.js build succeeds (Clerk key needed at build time for ClerkProvider)

**Step 8: Commit**

```bash
git add apps/web/wrangler.jsonc apps/web/open-next.config.ts apps/web/.gitignore apps/web/package.json
git commit -m "feat: add @opennextjs/cloudflare adapter for CF Workers deployment"
```

---

### Task 2: Add user auto-provisioning to API

The Clerk JWT `sub` claim is a Clerk user ID (e.g., `user_2abc...`), but the DB `users.id` is a UUID. We need middleware that maps Clerk users to DB users, creating them on first request.

**Files:**

- Modify: `packages/api/src/middleware/auth.ts`
- Modify: `packages/db/src/queries/users.ts`
- Modify: `packages/db/src/schema.ts`

**Step 1: Add clerkId column to users table**

In `packages/db/src/schema.ts`, add to the `users` table:

```ts
clerkId: text("clerk_id").unique(),
```

**Step 2: Add getByClerkId and upsertFromClerk to user queries**

In `packages/db/src/queries/users.ts`:

```ts
async getByClerkId(clerkId: string) {
  return db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
},

async upsertFromClerk(clerkId: string, email: string, name?: string) {
  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
  if (existing) return existing;
  const [user] = await db.insert(users).values({ clerkId, email, name: name ?? null }).returning();
  return user;
},
```

Import `eq` from drizzle-orm (already imported). Add `clerkId` field reference.

**Step 3: Update auth middleware to resolve DB user**

In `packages/api/src/middleware/auth.ts`, after JWT verification, add user resolution:

```ts
const payload = await verifyJWT(token, c.env.CLERK_SECRET_KEY);
const db = c.get("db");

// Resolve or create DB user from Clerk ID
const { userQueries } = await import("@llm-boost/db");
let user = await userQueries(db).getByClerkId(payload.sub);
if (!user) {
  // Auto-provision on first API call
  const email = (payload.email as string) ?? `${payload.sub}@clerk.user`;
  const name = payload.name as string | undefined;
  user = await userQueries(db).upsertFromClerk(payload.sub, email, name);
}
c.set("userId", user.id); // Set DB user UUID, not Clerk ID
```

**Step 4: Push schema change**

Run: `cd packages/db && npx drizzle-kit generate`
Expected: Migration file created for the new `clerk_id` column.

**Step 5: Commit**

```bash
git add packages/db/ packages/api/src/middleware/auth.ts
git commit -m "feat: auto-provision DB users from Clerk JWT on first API call"
```

---

### Task 3: Add missing API routes

The frontend API client expects routes that don't exist yet. Add them.

**Files:**

- Create: `packages/api/src/routes/dashboard.ts`
- Modify: `packages/api/src/routes/crawls.ts`
- Modify: `packages/api/src/routes/pages.ts`
- Create: `packages/api/src/routes/account.ts`
- Modify: `packages/api/src/index.ts`
- Modify: `packages/db/src/queries/pages.ts`
- Modify: `packages/db/src/queries/scores.ts`

**Step 1: Create dashboard routes**

Create `packages/api/src/routes/dashboard.ts`:

```ts
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { projectQueries, crawlQueries, userQueries } from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use("*", authMiddleware);

// GET /stats
dashboardRoutes.get("/stats", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const user = await userQueries(db).getById(userId);
  const projects = await projectQueries(db).listByUser(userId);

  const limits = PLAN_LIMITS[user?.plan ?? "free"];

  return c.json({
    data: {
      total_projects: projects.length,
      total_crawls: 0, // Will be computed when crawls exist
      avg_score: 0,
      credits_remaining: user?.crawlCreditsRemaining ?? 0,
      credits_total:
        limits.crawlsPerMonth === Infinity ? 999 : limits.crawlsPerMonth,
    },
  });
});

// GET /activity — recent crawl jobs across all projects
dashboardRoutes.get("/activity", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const projects = await projectQueries(db).listByUser(userId);
  const allCrawls = [];
  for (const project of projects.slice(0, 10)) {
    const crawls = await crawlQueries(db).listByProject(project.id);
    for (const crawl of crawls.slice(0, 5)) {
      allCrawls.push({
        ...crawl,
        projectName: project.name,
        projectId: project.id,
      });
    }
  }

  // Sort by createdAt desc, take 5
  allCrawls.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return c.json({ data: allCrawls.slice(0, 5) });
});
```

**Step 2: Add crawl listing per project**

In `packages/api/src/routes/crawls.ts`, add after the GET /:id route:

```ts
// GET /project/:projectId — List crawls for a project
crawlRoutes.get("/project/:projectId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Project not found" } },
      404,
    );
  }

  const crawls = await crawlQueries(db).listByProject(projectId);
  return c.json({
    data: crawls,
    pagination: { page: 1, limit: 50, total: crawls.length, totalPages: 1 },
  });
});
```

**Step 3: Add pages listing per crawl job**

In `packages/api/src/routes/pages.ts`, add a route to list pages by job:

```ts
// GET /job/:jobId — List pages for a crawl job
pageRoutes.get("/job/:jobId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");

  // Verify ownership
  const crawl = await crawlQueries(db).getById(jobId);
  if (!crawl)
    return c.json(
      { error: { code: "NOT_FOUND", message: "Crawl not found" } },
      404,
    );
  const project = await projectQueries(db).getById(crawl.projectId);
  if (!project || project.userId !== userId) {
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  }

  const pageList = await pageQueries(db).listByJob(jobId);
  // Join with scores
  const pagesWithScores = await Promise.all(
    pageList.map(async (page) => {
      const score = await scoreQueries(db).getByPage(page.id);
      const issueList = await scoreQueries(db).getIssuesByPage(page.id);
      return {
        ...page,
        overall_score: score?.overallScore ?? null,
        technical_score: score?.technicalScore ?? null,
        content_score: score?.contentScore ?? null,
        ai_readiness_score: score?.aiReadinessScore ?? null,
        performance_score: null,
        letter_grade: score
          ? score.overallScore >= 90
            ? "A"
            : score.overallScore >= 80
              ? "B"
              : score.overallScore >= 70
                ? "C"
                : score.overallScore >= 60
                  ? "D"
                  : "F"
          : null,
        issue_count: issueList.length,
      };
    }),
  );

  return c.json({
    data: pagesWithScores,
    pagination: {
      page: 1,
      limit: 100,
      total: pagesWithScores.length,
      totalPages: 1,
    },
  });
});
```

Add necessary imports: `crawlQueries, projectQueries, scoreQueries` from `@llm-boost/db`.

**Step 4: Add issues listing per project and per crawl**

Add to `packages/api/src/routes/pages.ts` (or create a dedicated issues route):

```ts
// GET /issues/job/:jobId — List all issues for a crawl job
pageRoutes.get("/issues/job/:jobId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");

  const crawl = await crawlQueries(db).getById(jobId);
  if (!crawl)
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  const project = await projectQueries(db).getById(crawl.projectId);
  if (!project || project.userId !== userId)
    return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);

  const allIssues = await scoreQueries(db).getIssuesByJob(jobId);
  return c.json({
    data: allIssues,
    pagination: { page: 1, limit: 500, total: allIssues.length, totalPages: 1 },
  });
});
```

**Step 5: Create account routes**

Create `packages/api/src/routes/account.ts`:

```ts
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { userQueries } from "@llm-boost/db";

export const accountRoutes = new Hono<AppEnv>();
accountRoutes.use("*", authMiddleware);

// GET / — Get current user info
accountRoutes.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user)
    return c.json(
      { error: { code: "NOT_FOUND", message: "User not found" } },
      404,
    );
  return c.json({ data: user });
});
```

**Step 6: Register new routes in index.ts**

In `packages/api/src/index.ts`, add:

```ts
import { dashboardRoutes } from "./routes/dashboard";
import { accountRoutes } from "./routes/account";

app.route("/api/dashboard", dashboardRoutes);
app.route("/api/account", accountRoutes);
```

**Step 7: Handle crawler offline in crawl dispatch**

In `packages/api/src/routes/crawls.ts`, at the top of the POST `/` handler, add after credit check:

```ts
// If no crawler URL configured, return a clear message
if (!c.env.CRAWLER_URL) {
  // Still create the job record but mark it as failed
  const crawlJob = await crawlQueries(db).create({
    projectId,
    config: crawlConfig,
  });
  await crawlQueries(db).updateStatus(crawlJob.id, {
    status: "failed",
    errorMessage: "Crawler service is not yet available. Coming soon!",
  });
  return c.json(
    {
      data: {
        ...crawlJob,
        status: "failed",
        errorMessage: "Crawler service is not yet available.",
      },
    },
    201,
  );
}
```

**Step 8: Commit**

```bash
git add packages/api/src/ packages/db/src/
git commit -m "feat: add dashboard, account routes and crawler-offline handling"
```

---

### Task 4: Fix frontend API client to match actual API routes

The frontend `api.ts` client calls paths without `/api/` prefix, but the backend mounts all routes under `/api/`. Fix the client paths.

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Fix all route paths**

Update all paths in `apps/web/src/lib/api.ts` to include the `/api/` prefix:

```
/dashboard/stats     → /api/dashboard/stats
/dashboard/activity  → /api/dashboard/activity
/projects            → /api/projects
/projects/:id        → /api/projects/:id
/crawls/:id          → /api/crawls/:id
/crawls/:id/progress → /api/crawls/:id  (same endpoint, just use status fields)
/pages/:id           → /api/pages/:id
/billing             → /api/billing/usage
/billing/checkout    → /api/billing/checkout
/billing/portal      → /api/billing/portal
/account             → /api/account
```

Also fix:

- `crawls.start()`: Change from `POST /projects/:id/crawls` to `POST /api/crawls` with `{ projectId }` body
- `crawls.list()`: Change from `GET /projects/:id/crawls` to `GET /api/crawls/project/:projectId`
- `pages.list()`: Change from `GET /crawls/:id/pages` to `GET /api/pages/job/:crawlId`
- `issues.listForCrawl()`: Change from `GET /crawls/:id/issues` to `GET /api/pages/issues/job/:crawlId`
- `issues.listForProject()`: Remove (not needed for MVP — issues are per crawl)
- `billing.getInfo()`: Change to `GET /api/billing/usage`
- `billing.createCheckoutSession()`: Update body shape to include `successUrl` and `cancelUrl`
- `billing.createPortalSession()`: Update body to include `returnUrl`
- `projects.update()`: Change from PATCH to PUT
- Remove `crawls.getProgress()` — use `crawls.get()` instead
- Remove `crawls.cancel()` — not implemented in API
- Remove `scores.getProjectHistory()` — not implemented for MVP

**Step 2: Add Clerk token fetching helper**

Since all API calls need a Clerk Bearer token, add a helper using `@clerk/nextjs`:

```ts
import { useAuth } from "@clerk/nextjs";
```

Actually, for server components we'd use `auth()` and for client components `useAuth().getToken()`. Since most dashboard pages are client components, create a React hook:

Create `apps/web/src/lib/use-api.ts`:

```ts
"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { api } from "./api";

export function useApi() {
  const { getToken } = useAuth();

  const withToken = useCallback(
    async <T>(fn: (token: string) => Promise<T>): Promise<T> => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fn(token);
    },
    [getToken],
  );

  return { withToken, getToken };
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/
git commit -m "fix: align API client paths with backend routes, add useApi hook"
```

---

### Task 5: Wire up dashboard page

**Files:**

- Modify: `apps/web/src/app/dashboard/page.tsx`

**Step 1: Replace placeholder data with API calls**

Rewrite `apps/web/src/app/dashboard/page.tsx`:

- Import `useApi` hook and `api` client
- Add `useState` for stats, activity, loading, error
- Add `useEffect` to fetch stats and activity on mount
- Remove all hardcoded `stats` and `recentActivity` const
- Show loading skeleton while fetching
- Show empty state when no data
- Show error state on failure

Key data flow:

```ts
const { withToken } = useApi();
const [stats, setStats] = useState<DashboardStats | null>(null);
const [activity, setActivity] = useState<CrawlJob[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  withToken(async (token) => {
    const [statsRes, activityRes] = await Promise.all([
      api.dashboard.getStats(token),
      api.dashboard.getRecentActivity(token),
    ]);
    setStats(statsRes.data);
    setActivity(activityRes.data);
  })
    .catch(console.error)
    .finally(() => setLoading(false));
}, [withToken]);
```

Note: API responses are wrapped in `{ data: ... }` from Hono. Update the api client or extract `.data` in the component.

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx
git commit -m "feat: wire up dashboard page to real API"
```

---

### Task 6: Wire up projects pages

**Files:**

- Modify: `apps/web/src/app/dashboard/projects/page.tsx`
- Modify: `apps/web/src/app/dashboard/projects/new/page.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/pages/page.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/issues/page.tsx`

**Step 1: Wire up projects list page**

In `apps/web/src/app/dashboard/projects/page.tsx`:

- Convert to `"use client"` component
- Import `useApi`, `api`, `useState`, `useEffect`
- Fetch projects with `api.projects.list(token)`
- API returns `{ data: [...], pagination: {...} }` — extract `data`
- Replace `placeholderProjects` with fetched data
- Add loading state (show skeleton cards)
- Empty state already exists in the JSX

**Step 2: Wire up create project page**

In `apps/web/src/app/dashboard/projects/new/page.tsx`:

- Import `useApi` and `api`
- Replace the TODO comment in `handleSubmit`:

```ts
const { withToken } = useApi();
// In handleSubmit:
const project = await withToken((token) =>
  api.projects.create(token, { name, domain }),
);
router.push(`/dashboard/projects/${project.data.id}`);
```

**Step 3: Wire up project detail page**

In `apps/web/src/app/dashboard/projects/[id]/page.tsx`:

- Fetch project with `api.projects.get(token, id)`
- Fetch latest crawl from the project response (it includes `latestCrawl`)
- Replace all hardcoded data
- "Run Crawl" button calls `api.crawls.start(token, id)` and handles errors

**Step 4: Wire up pages list**

In `apps/web/src/app/dashboard/projects/[id]/pages/page.tsx`:

- Fetch project to get latest crawl ID
- Fetch pages with `api.pages.list(token, crawlId)`
- Replace hardcoded data

**Step 5: Wire up issues list**

In `apps/web/src/app/dashboard/projects/[id]/issues/page.tsx`:

- Fetch project to get latest crawl ID
- Fetch issues with `api.issues.listForCrawl(token, crawlId)`
- Replace hardcoded data

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/projects/
git commit -m "feat: wire up all project pages to real API"
```

---

### Task 7: Wire up crawl detail page

**Files:**

- Modify: `apps/web/src/app/dashboard/crawl/[id]/page.tsx`

**Step 1: Replace placeholder data with API calls**

- Fetch crawl status with `api.crawls.get(token, id)`
- CrawlProgress component already has polling logic — connect it to the real API
- When crawl status is "failed" with crawler-offline message, show appropriate UI

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/crawl/
git commit -m "feat: wire up crawl detail page to real API"
```

---

### Task 8: Wire up settings page

**Files:**

- Modify: `apps/web/src/app/dashboard/settings/page.tsx`

**Step 1: Replace placeholder data**

- Fetch billing usage with `api.billing.getInfo(token)` → maps to `GET /api/billing/usage`
- "Upgrade Plan" button calls `api.billing.createCheckoutSession(token, plan)` with success/cancel URLs
- "Delete Account" calls `api.account.deleteAccount(token)`
- Notification toggles: for MVP, these can remain client-side only (no account notifications route yet)

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/settings/page.tsx
git commit -m "feat: wire up settings page billing to real API"
```

---

### Task 9: Add environment variables and Clerk config

**Files:**

- Create: `apps/web/.env.local` (gitignored)
- Modify: `apps/web/src/app/layout.tsx` (if needed)

**Step 1: Create .env.local for Clerk**

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_XXXXX
CLERK_SECRET_KEY=sk_test_XXXXX
NEXT_PUBLIC_API_URL=https://api.llmrank.app
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

**Step 2: Verify local build with Clerk keys**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds with real Clerk key.

**Step 3: Commit (only config, not secrets)**

No commit needed — `.env.local` is gitignored.

---

### Task 10: Deploy API Worker

**Step 1: Set wrangler secrets**

Run each from `packages/api/`:

```bash
echo "YOUR_VALUE" | npx wrangler secret put DATABASE_URL
echo "YOUR_VALUE" | npx wrangler secret put SHARED_SECRET
echo "YOUR_VALUE" | npx wrangler secret put ANTHROPIC_API_KEY
echo "YOUR_VALUE" | npx wrangler secret put STRIPE_SECRET_KEY
echo "YOUR_VALUE" | npx wrangler secret put CLERK_PUBLISHABLE_KEY
echo "YOUR_VALUE" | npx wrangler secret put CLERK_SECRET_KEY
```

**Step 2: Create KV namespace and update wrangler.toml**

```bash
npx wrangler kv namespace create llm-boost-cache
```

Copy the returned ID into `packages/api/wrangler.toml` as the KV namespace `id`.

**Step 3: Create R2 bucket**

```bash
npx wrangler r2 bucket create ai-seo-storage
```

**Step 4: Deploy**

```bash
cd packages/api && npx wrangler deploy
```

**Step 5: Set custom domain**

In Cloudflare dashboard: Workers & Pages → llm-boost-api → Settings → Domains → Add `api.llmrank.app`.

**Step 6: Push DB schema**

```bash
cd packages/db && DATABASE_URL="your-neon-url" npx drizzle-kit push
```

**Step 7: Verify health**

```bash
curl https://api.llmrank.app/api/health
```

Expected: `{"status":"ok"}`

---

### Task 11: Deploy frontend via Cloudflare

**Step 1: Push all code to GitHub**

```bash
git push origin main
```

**Step 2: Connect to Cloudflare Workers (via dashboard)**

In Cloudflare dashboard: Workers & Pages → Create → Connect Git → Select the repo.

Configure:

- **Framework preset:** None (custom build)
- **Build command:** `cd apps/web && npx opennextjs-cloudflare build`
- **Build output directory:** `apps/web/.open-next`
- **Root directory:** `/`

Environment variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = your Clerk key
- `NEXT_PUBLIC_API_URL` = `https://api.llmrank.app`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` = `/dashboard`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` = `/dashboard`
- `NODE_VERSION` = `20`

**Step 3: Set custom domain**

In Cloudflare dashboard: Workers & Pages → llm-boost-web → Settings → Domains → Add `llmrank.app`.

**Step 4: Verify**

1. Visit https://llmrank.app — landing page loads
2. Click "Sign in" → Clerk sign-in page works
3. Sign in → redirects to /dashboard
4. Dashboard shows stats (zeros for new user)
5. Create a project → project appears in list
6. Click "Run Crawl" → shows "crawler offline" message gracefully

---

### Task 12: Configure Clerk allowed origins

**Step 1: In Clerk dashboard**

Go to dashboard.clerk.com → Your app → Settings:

- Add `https://llmrank.app` to allowed origins
- Add `https://llmrank.app` to redirect URLs
- Configure Google OAuth provider
- Configure GitHub OAuth provider

---

### Task 13: Verification and smoke test

**Step 1: End-to-end test checklist**

1. [ ] https://llmrank.app loads landing page
2. [ ] Sign up with email works
3. [ ] Sign in redirects to /dashboard
4. [ ] Dashboard shows stats (all zeros for new user)
5. [ ] "New Project" → create project form works
6. [ ] Created project appears in projects list
7. [ ] Project detail page shows (empty state)
8. [ ] "Run Crawl" shows crawler-offline message
9. [ ] Settings page shows Free plan info
10. [ ] Sign out and sign back in works
