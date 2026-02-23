# Project Completion & HTMX Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Commit all in-flight work, close remaining feature gaps (content gap analysis component), then migrate the frontend from Next.js/React to HTMX + Hono server-rendered HTML.

**Architecture:** The Hono API Worker (`apps/api`) currently serves JSON-only. We add an `html` middleware layer that serves HTMX-powered HTML pages alongside existing JSON endpoints. During migration, Next.js handles un-migrated routes while Hono serves migrated ones. Charts and interactive graphs remain as vanilla JS "islands" loaded via `<script>` tags.

**Tech Stack:** Hono (html helper + JSX), HTMX 2.x, Alpine.js (minimal client state), Tailwind CSS (standalone CLI), vanilla JS chart islands

**Existing Plans Referenced:**

- `docs/plans/2026-02-22-api-token-provisioning.md` — **COMPLETE, no work needed**
- `docs/plans/2026-02-22-mcp-seo-interface.md` — **95% complete, Phase 7-12 remain (docs, npm, deployment)**
- `docs/plans/2026-02-19-business-growth-10-features.md` — **95% complete, 1 gap: content-gap-analysis component**

---

## Gap Analysis Summary

| Area                             | Status            | Remaining Work                                                 |
| -------------------------------- | ----------------- | -------------------------------------------------------------- |
| API Token Provisioning (9 tasks) | 100% done         | None — schema, service, routes, UI all shipped                 |
| MCP Server (Tasks 1-17)          | 95% done          | Phase 7-12: API extensions, Mintlify docs, npm publish, deploy |
| Business Growth Features (10/10) | 95% done          | 1 gap: `ContentGapAnalysis` component not wired                |
| Unstaged changes (6 files)       | Code complete     | Needs commit                                                   |
| Root snapshot files (15 .md)     | Testing artifacts | Clean up                                                       |
| HTMX Migration                   | 0%                | Full plan below                                                |

---

## Phase 0: Commit & Clean Up

### Task 1: Commit in-flight changes

The following files are modified but unstaged. They are feature-complete and need committing.

**Files (modified, unstaged):**

- `apps/api/src/dto/project.dto.ts` — siteDescription + industry fields
- `apps/api/src/routes/projects.ts` — site-context, rerun-auto-generation, rediscover-competitors endpoints
- `apps/api/src/routes/visibility.ts` — 9 visibility endpoints (check, gaps, trends, AI score, recommendations, discover-keywords, suggest-keywords)
- `apps/web/src/app/dashboard/crawl/[id]/page.tsx` — crawl detail page with progress + "What to Do Next"
- `apps/web/src/components/settings/digest-preferences-section.tsx` — email digest frequency settings
- `packages/db/src/queries/scores.ts` — enhanced getIssuesByJob(), batch operations

**Files (new, untracked):**

- `apps/web/src/components/platform-guide.tsx` — platform optimization guide component

**Step 1: Stage and commit feature files**

```bash
git add apps/api/src/dto/project.dto.ts apps/api/src/routes/projects.ts apps/api/src/routes/visibility.ts apps/web/src/app/dashboard/crawl/\[id\]/page.tsx apps/web/src/components/settings/digest-preferences-section.tsx packages/db/src/queries/scores.ts apps/web/src/components/platform-guide.tsx
git commit -m "feat: site context, visibility tracking, digest preferences, platform guides, score queries"
```

**Step 2: Add snapshot files to .gitignore**

Add to `.gitignore`:

```
# Testing artifacts
competitors-*.md
crawl-snapshot.md
new-project-snapshot.md
personas-*.md
settings-*.md
smoke-*.md
suggest-queries-result.md
```

**Step 3: Commit .gitignore**

```bash
git add .gitignore
git commit -m "chore: gitignore testing snapshot artifacts"
```

---

### Task 2: Wire ContentGapAnalysis component (last business growth gap)

The competitors tab references content gaps in the API (`GET /api/projects/:id/visibility/gaps`) but has no dedicated `ContentGapAnalysis` component. The competitor tab already shows gap data inline.

**Files:**

- Create: `apps/web/src/components/content-gap-analysis.tsx`
- Modify: `apps/web/src/components/tabs/competitors-tab.tsx`

**Step 1: Read the competitors tab to understand current gap display**

Read `apps/web/src/components/tabs/competitors-tab.tsx` to see how content gaps are currently shown.

**Step 2: Create ContentGapAnalysis component**

```tsx
// apps/web/src/components/content-gap-analysis.tsx
"use client";

import { useCallback, useState } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface ContentGap {
  topic: string;
  competitorDomains: string[];
  suggestedOutline: string[];
  priority: "high" | "medium" | "low";
}

export function ContentGapAnalysis({ projectId }: { projectId: string }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const { data, isLoading } = useApiSWR<{ data: ContentGap[] }>(
    `content-gaps-${projectId}`,
    useCallback(() => api.visibility.gaps(projectId), [projectId]),
  );

  const gaps = data?.data ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (gaps.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">No content gaps found</p>
            <p className="text-xs text-muted-foreground">
              Run a visibility check with competitors to discover gaps.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const priorityColor = {
    high: "destructive",
    medium: "warning",
    low: "secondary",
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Content Gaps ({gaps.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {gaps.map((gap, i) => (
          <button
            key={i}
            className="w-full rounded-lg border p-3 text-left hover:bg-muted/50"
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium">{gap.topic}</span>
              <Badge variant={priorityColor[gap.priority]}>
                {gap.priority}
              </Badge>
              {expanded === i ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Covered by: {gap.competitorDomains.join(", ")}
            </p>
            {expanded === i && gap.suggestedOutline.length > 0 && (
              <ul className="mt-2 space-y-1 border-t pt-2 text-sm">
                {gap.suggestedOutline.map((item, j) => (
                  <li key={j} className="text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Step 3: Add to competitors tab**

In `apps/web/src/components/tabs/competitors-tab.tsx`, import and place after the competitor benchmarks:

```tsx
import { ContentGapAnalysis } from "@/components/content-gap-analysis";

// After the competitor benchmark cards, before the closing div:
<ContentGapAnalysis projectId={projectId} />;
```

**Step 4: Verify locally**

Run: `pnpm --filter web dev`
Navigate to a project's Competitors tab. The content gap section should appear.

**Step 5: Commit**

```bash
git add apps/web/src/components/content-gap-analysis.tsx apps/web/src/components/tabs/competitors-tab.tsx
git commit -m "feat(web): add content gap analysis component to competitors tab"
```

---

## Phase 1: HTMX Foundation

### Task 3: Add HTMX + template infrastructure to Hono API

The Hono API Worker currently serves JSON only. We add the ability to serve HTML pages using Hono's built-in JSX support (no extra dependencies needed — Hono JSX works on Cloudflare Workers).

**Files:**

- Modify: `apps/api/tsconfig.json` (enable JSX)
- Create: `apps/api/src/views/layout.tsx` (base HTML layout with HTMX + Tailwind CDN)
- Create: `apps/api/src/views/components.tsx` (shared UI components)
- Create: `apps/api/src/middleware/htmx.ts` (HTMX request detection)
- Create: `apps/api/src/routes/app.tsx` (HTMX page router)
- Modify: `apps/api/src/index.ts` (mount app routes)

**Step 1: Enable JSX in API tsconfig**

In `apps/api/tsconfig.json`, add to compilerOptions:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "hono"
  }
}
```

**Step 2: Create base layout**

```tsx
// apps/api/src/views/layout.tsx
import type { FC, PropsWithChildren } from "hono/jsx";

export const Layout: FC<
  PropsWithChildren<{ title: string; user?: { email: string; plan: string } }>
> = ({ title, user, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — LLM Rank</title>
      <script src="https://unpkg.com/htmx.org@2.0.4"></script>
      <script
        src="https://unpkg.com/alpinejs@3.14.8/dist/cdn.min.js"
        defer
      ></script>
      <link
        href="https://cdn.jsdelivr.net/npm/tailwindcss@4/dist/tailwind.min.css"
        rel="stylesheet"
      />
    </head>
    <body class="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <nav class="border-b bg-white px-6 py-3 dark:bg-gray-900">
        <div class="mx-auto flex max-w-7xl items-center justify-between">
          <a href="/app" class="text-lg font-bold">
            LLM Rank
          </a>
          {user && (
            <div class="flex items-center gap-4 text-sm">
              <span class="text-gray-500">{user.email}</span>
              <span class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium capitalize text-blue-700">
                {user.plan}
              </span>
              <a href="/app/settings" class="hover:underline">
                Settings
              </a>
            </div>
          )}
        </div>
      </nav>
      <main class="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </body>
  </html>
);

export const PageHeader: FC<{
  title: string;
  description?: string;
  actions?: any;
}> = ({ title, description, actions }) => (
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">{title}</h1>
      {description && <p class="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
    {actions}
  </div>
);
```

**Step 3: Create HTMX middleware**

```tsx
// apps/api/src/middleware/htmx.ts
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";

/** Detects HX-Request header; sets c.get("isHtmx") and c.get("hxTarget") */
export const htmxMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set("isHtmx", c.req.header("HX-Request") === "true");
  c.set("hxTarget", c.req.header("HX-Target") ?? null);
  await next();
});
```

**Step 4: Create first HTMX route (settings page)**

```tsx
// apps/api/src/routes/app.tsx
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { htmxMiddleware } from "../middleware/htmx";
import { Layout, PageHeader } from "../views/layout";
import { userQueries, type Database } from "@llm-boost/db";

export const appRoutes = new Hono<AppEnv>();

appRoutes.use("*", authMiddleware);
appRoutes.use("*", htmxMiddleware);

// ─── Settings page ─────────────────────────────────────
appRoutes.get("/settings", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const content = (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account preferences"
      />

      {/* Digest preferences — HTMX form */}
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h2 class="mb-4 text-lg font-semibold">Email Digest</h2>
        <form
          hx-patch="/api/account/digest"
          hx-target="#digest-status"
          hx-swap="innerHTML"
          class="flex items-end gap-4"
        >
          <div>
            <label class="mb-1 block text-sm font-medium" for="digestFrequency">
              Frequency
            </label>
            <select
              name="digestFrequency"
              id="digestFrequency"
              class="rounded border px-3 py-2 text-sm"
            >
              <option value="off" selected={user.digestFrequency === "off"}>
                Off
              </option>
              <option
                value="weekly"
                selected={user.digestFrequency === "weekly"}
              >
                Weekly
              </option>
              <option
                value="monthly"
                selected={user.digestFrequency === "monthly"}
              >
                Monthly
              </option>
            </select>
          </div>
          <button
            type="submit"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save
          </button>
          <span id="digest-status" class="text-sm text-green-600"></span>
        </form>
      </section>
    </div>
  );

  // If HTMX partial request, return just the content
  if (c.get("isHtmx")) {
    return c.html(content);
  }

  // Full page render
  return c.html(
    <Layout
      title="Settings"
      user={{ email: user.email ?? "", plan: user.plan }}
    >
      {content}
    </Layout>,
  );
});
```

**Step 5: Mount app routes in index.ts**

In `apps/api/src/index.ts`, add:

```typescript
import { appRoutes } from "./routes/app";

// Mount HTMX app routes (after API routes)
app.route("/app", appRoutes);
```

**Step 6: Verify locally**

Run: `cd apps/api && npx wrangler dev`
Navigate to `http://localhost:8787/app/settings`
Expected: See the settings page rendered as HTML with HTMX attributes.

**Step 7: Commit**

```bash
git add apps/api/tsconfig.json apps/api/src/views/ apps/api/src/middleware/htmx.ts apps/api/src/routes/app.tsx apps/api/src/index.ts
git commit -m "feat(api): add HTMX foundation — layout, middleware, settings page"
```

---

### Task 4: Add HTMX response helpers

Create utilities for common HTMX patterns: toasts, redirects, and OOB swaps.

**Files:**

- Create: `apps/api/src/views/htmx-helpers.tsx`

**Step 1: Create helpers**

```tsx
// apps/api/src/views/htmx-helpers.tsx
import type { Context } from "hono";

/** Return an HTMX redirect via HX-Redirect header */
export function htmxRedirect(c: Context, url: string) {
  return c.body(null, 204, { "HX-Redirect": url });
}

/** Return a toast notification via OOB swap */
export function htmxToast(
  message: string,
  type: "success" | "error" = "success",
) {
  const color = type === "success" ? "green" : "red";
  return (
    <div
      id="toast"
      hx-swap-oob="true"
      class={`fixed right-4 top-4 z-50 rounded-lg border bg-${color}-50 px-4 py-3 text-sm text-${color}-700 shadow-lg`}
      x-data="{ show: true }"
      x-init="setTimeout(() => show = false, 3000)"
      x-show="show"
      x-transition
    >
      {message}
    </div>
  );
}

/** Render an empty element to clear a target */
export function htmxClear(id: string) {
  return <div id={id} hx-swap-oob="true"></div>;
}

/** Return inline "Saved ✓" confirmation */
export function htmxSaved() {
  return <span class="text-sm text-green-600">Saved ✓</span>;
}
```

**Step 2: Commit**

```bash
git add apps/api/src/views/htmx-helpers.tsx
git commit -m "feat(api): add HTMX response helpers (redirect, toast, OOB swaps)"
```

---

## Phase 2: Migrate Simple Pages

Migration order (simplest → most complex):

1. Settings — forms, toggles (Task 3 already started this)
2. Team management — CRUD list
3. New project — single form
4. Project logs — read-only list
5. Project issues — filterable list

### Task 5: Complete settings page migration

Extend the settings page from Task 3 to include all settings sections: general, API tokens, notification channels, branding.

**Files:**

- Modify: `apps/api/src/routes/app.tsx`
- Create: `apps/api/src/views/settings/general.tsx`
- Create: `apps/api/src/views/settings/api-tokens.tsx`
- Create: `apps/api/src/views/settings/notifications.tsx`

**Step 1: Read current React settings page for feature parity**

Read `apps/web/src/app/dashboard/settings/page.tsx` to identify all tabs:

- General (name, email, delete account)
- Billing (plan, invoices)
- Branding (logo, colors)
- Notifications (channels)
- API Tokens (CRUD)
- Digest (frequency)
- Team (members, invites)
- SSO (enterprise only)
- Audit Log (enterprise only)

**Step 2: Implement settings as HTMX tabs**

The settings page uses tab navigation. In HTMX, tabs load partials:

```tsx
// In apps/api/src/routes/app.tsx, extend the /settings route:

// Tab navigation — each tab loads its content via HTMX
appRoutes.get("/settings", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");
  const tab = c.req.query("tab") ?? "general";

  const tabs = [
    "general",
    "billing",
    "tokens",
    "notifications",
    "digest",
    "team",
  ];

  const tabNav = (
    <div class="mb-6 flex gap-1 border-b" role="tablist">
      {tabs.map((t) => (
        <button
          hx-get={`/app/settings/${t}`}
          hx-target="#settings-content"
          hx-push-url={`/app/settings?tab=${t}`}
          class={`px-4 py-2 text-sm font-medium border-b-2 ${
            t === tab
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          role="tab"
        >
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );

  // ... render layout with tabNav + <div id="settings-content"> loaded with default tab
});

// Tab partials
appRoutes.get("/settings/general", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  // Return just the general settings form (HTMX partial)
  return c.html(/* general settings form JSX */);
});

appRoutes.get("/settings/tokens", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const tokens = await apiTokenQueries(db).listByUser(userId);
  // Return token list + create form
  return c.html(/* token list JSX */);
});

// ... repeat for each tab
```

**Step 3: Verify feature parity with React version**

Check each tab renders correctly and forms submit via HTMX.

**Step 4: Commit**

```bash
git add apps/api/src/routes/app.tsx apps/api/src/views/settings/
git commit -m "feat(api): complete HTMX settings page with all tabs"
```

---

### Task 6: Migrate team management page

**Files:**

- Modify: `apps/api/src/routes/app.tsx` (add /app/team routes)

**Step 1: Read current team page for feature list**

Read `apps/web/src/app/dashboard/team/page.tsx`. Features:

- Create team (if none exists)
- Member list with roles
- Invite dialog
- Remove member

**Step 2: Implement as HTMX page**

```tsx
// In apps/api/src/routes/app.tsx

appRoutes.get("/team", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  // Fetch team, members, invites
  // Render team management page with:
  // - hx-post="/api/teams" for team creation
  // - hx-post="/api/teams/:id/invite" for invites
  // - hx-delete="/api/teams/:id/members/:userId" for removal
  // All forms use HTMX to submit and swap results inline
});
```

**Step 3: Commit**

```bash
git commit -m "feat(api): HTMX team management page"
```

---

### Task 7: Migrate new project page

**Files:**

- Modify: `apps/api/src/routes/app.tsx`

**Step 1: Read current new project page**

Read `apps/web/src/app/dashboard/projects/new/page.tsx`. Features:

- Domain input with validation
- Project name (auto-filled from domain)
- Create button → redirect to project page

**Step 2: Implement as HTMX form**

```tsx
appRoutes.get("/projects/new", async (c) => {
  // Render form with hx-post="/api/projects" hx-target="body"
  // On success, HX-Redirect to /app/projects/:id
});
```

**Step 3: Commit**

```bash
git commit -m "feat(api): HTMX new project page"
```

---

### Task 8: Migrate project issues page

This is the first page with filtering and pagination — a good HTMX pattern to establish.

**Files:**

- Modify: `apps/api/src/routes/app.tsx`
- Create: `apps/api/src/views/issues.tsx`

**Step 1: Read current issues page**

Read `apps/web/src/app/dashboard/projects/[id]/issues/page.tsx`. Features:

- Issue list with severity badges
- Filter by severity, category
- Sort by impact
- Fix tracking status dropdown

**Step 2: Implement filterable list with HTMX**

```tsx
// Server-side filtering — each filter change triggers hx-get with query params
appRoutes.get("/projects/:id/issues", async (c) => {
  const projectId = c.req.param("id");
  const severity = c.req.query("severity");
  const category = c.req.query("category");

  // Fetch filtered issues from DB
  // Render as table/cards

  // Filter bar uses hx-get to reload the issue list:
  // <select hx-get="/app/projects/:id/issues" hx-target="#issue-list" hx-include="[name]" name="severity">
  //   <option value="">All</option>
  //   <option value="critical">Critical</option>
  //   ...
  // </select>

  // Issue status dropdown uses hx-patch:
  // <select hx-patch="/api/action-items/:id" hx-vals='{"status": "fixed"}' hx-swap="outerHTML">
});
```

**Step 3: Commit**

```bash
git commit -m "feat(api): HTMX project issues page with filtering"
```

---

## Phase 3: Migrate Medium-Complexity Pages

### Task 9: Migrate projects list (dashboard home)

**Files:**

- Modify: `apps/api/src/routes/app.tsx`

Features to replicate:

- Project cards with domain, score, grade, last crawl date
- "New Project" button
- Usage meter
- Quick actions (run crawl, view report)

This page uses no charts — it's a card grid. Good HTMX fit.

**Step 1: Implement project list**

```tsx
appRoutes.get("/", async (c) => {
  // Redirect to /app/projects
  return c.redirect("/app/projects");
});

appRoutes.get("/projects", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  // Fetch projects with latest scores
  // Render card grid with hx-get links to /app/projects/:id
});
```

**Step 2: Add "Run Crawl" as HTMX action**

```html
<button
  hx-post="/api/projects/{id}/crawls"
  hx-target="#crawl-status-{id}"
  hx-swap="innerHTML"
  class="btn-primary"
>
  Run Crawl
</button>
<span id="crawl-status-{id}"></span>
```

**Step 3: Commit**

```bash
git commit -m "feat(api): HTMX projects list page"
```

---

### Task 10: Migrate project detail page (tab container)

This is the most complex page — it's a tab container that loads different content sections. Each tab becomes an HTMX partial.

**Files:**

- Create: `apps/api/src/views/project/overview.tsx`
- Create: `apps/api/src/views/project/pages-tab.tsx`
- Create: `apps/api/src/views/project/issues-tab.tsx`
- Create: `apps/api/src/views/project/competitors-tab.tsx`
- Create: `apps/api/src/views/project/visibility-tab.tsx`
- Create: `apps/api/src/views/project/history-tab.tsx`
- Create: `apps/api/src/views/project/settings-tab.tsx`

**Step 1: Implement tab container**

```tsx
appRoutes.get("/projects/:id", async (c) => {
  const projectId = c.req.param("id");
  const tab = c.req.query("tab") ?? "overview";
  // Fetch project
  // Render tab navigation + load default tab content
  // Each tab link: hx-get="/app/projects/:id/tab/:tabName" hx-target="#tab-content"
});

// Tab partials
appRoutes.get("/projects/:id/tab/overview", async (c) => {
  /* score cards, alerts, quick actions */
});
appRoutes.get("/projects/:id/tab/pages", async (c) => {
  /* paginated page list */
});
appRoutes.get("/projects/:id/tab/issues", async (c) => {
  /* filtered issue list */
});
appRoutes.get("/projects/:id/tab/competitors", async (c) => {
  /* competitor benchmarks + gaps */
});
appRoutes.get("/projects/:id/tab/visibility", async (c) => {
  /* visibility checks + trends */
});
appRoutes.get("/projects/:id/tab/history", async (c) => {
  /* crawl history + comparison */
});
appRoutes.get("/projects/:id/tab/settings", async (c) => {
  /* project settings form */
});
```

**Step 2: Handle score display (no chart needed)**

Score cards (overall, technical, content, AI readiness, performance) are just numbers + grades + colored bars. No recharts needed — use Tailwind progress bars:

```html
<div class="h-2 w-full rounded-full bg-gray-200">
  <div class="h-2 rounded-full bg-green-500" style="width: 85%"></div>
</div>
```

**Step 3: Commit per tab (overview first, then pages, issues, etc.)**

```bash
git commit -m "feat(api): HTMX project detail page with tab navigation"
```

---

### Task 11: Chart islands for score trends and distributions

Charts can't be pure HTMX. They stay as vanilla JS loaded into designated `<div>` containers. We use lightweight chart libraries that don't need React.

**Options (pick one):**

- **Chart.js** (296KB, no React needed, canvas-based)
- **uPlot** (35KB, fastest, SVG)
- **Apache ECharts** (800KB, most features)

Recommendation: **uPlot** for line/area charts (score trends), **Chart.js** for pie/bar (issue distribution).

**Files:**

- Create: `apps/api/src/views/islands/score-trend.ts` (vanilla JS chart island)
- Create: `apps/api/src/views/islands/issue-distribution.ts`

**Step 1: Add chart islands as inline scripts**

Charts are loaded via `<script>` tags that target specific `<canvas>` elements:

```html
<!-- In the overview tab partial -->
<div id="score-trend-chart" class="h-64">
  <canvas id="score-trend-canvas"></canvas>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<script>
  // Data injected server-side as JSON
  const trendData = __SCORE_TREND_DATA__;
  new Chart(document.getElementById("score-trend-canvas"), {
    type: "line",
    data: {
      labels: trendData.labels,
      datasets: [{ data: trendData.scores, borderColor: "#3b82f6" }],
    },
    options: { responsive: true, plugins: { legend: { display: false } } },
  });
</script>
```

**Step 2: Server injects chart data**

```tsx
// In the overview tab handler:
const scoreHistory = await scoreQueries(db).getHistory(projectId);
const chartDataJson = JSON.stringify({
  labels: scoreHistory.map((s) => s.date),
  scores: scoreHistory.map((s) => s.overall),
});

return c.html(
  <>
    <div id="score-trend-chart">
      <canvas id="score-trend-canvas"></canvas>
    </div>
    <script>{`const __SCORE_TREND_DATA__ = ${chartDataJson};`}</script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
    <script src="/static/js/score-trend.js"></script>
  </>,
);
```

**Step 3: Commit**

```bash
git commit -m "feat(api): chart islands for score trends and issue distribution"
```

---

## Phase 4: Migrate Complex Pages

### Task 12: Migrate crawl detail page (live progress)

The crawl detail page shows real-time progress. HTMX handles this with **polling**:

```html
<div
  hx-get="/app/crawl/{id}/progress"
  hx-trigger="every 2s"
  hx-target="this"
  hx-swap="outerHTML"
>
  <!-- Progress bar, page count, status -->
  <div class="h-3 w-full rounded-full bg-gray-200">
    <div
      class="h-3 rounded-full bg-blue-500 transition-all"
      style="width: {pct}%"
    ></div>
  </div>
  <p class="text-sm">{pagesCrawled}/{totalPages} pages • {status}</p>
</div>
```

When crawl completes, the polling partial returns without `hx-trigger`, stopping the poll and showing results.

**Step 1: Implement progress polling endpoint**

```tsx
appRoutes.get("/crawl/:id/progress", async (c) => {
  const crawlId = c.req.param("id");
  const db = c.get("db");
  const job = await crawlQueries(db).getById(crawlId);

  if (job.status === "complete" || job.status === "failed") {
    // Return final state WITHOUT hx-trigger (stops polling)
    return c.html(/* final results */);
  }

  // Return progress WITH hx-trigger="every 2s" (continues polling)
  return c.html(/* progress bar with hx-trigger */);
});
```

**Step 2: Commit**

```bash
git commit -m "feat(api): HTMX crawl detail page with live polling"
```

---

### Task 13: Migrate page detail page

The most content-heavy page: score breakdown, issue list, content analysis, platform readiness.

All data is server-rendered. The only interactive element is the fix generation button, which uses `hx-post`.

**Step 1: Implement as sectioned page with lazy-loaded sections**

```html
<!-- Heavy sections load on reveal -->
<section
  hx-get="/app/projects/{id}/pages/{pageId}/content-analysis"
  hx-trigger="revealed"
  hx-swap="innerHTML"
>
  <p class="text-sm text-gray-400">Loading content analysis...</p>
</section>
```

**Step 2: Commit**

```bash
git commit -m "feat(api): HTMX page detail page with lazy sections"
```

---

### Task 14: Migrate admin page

Admin page is internal-only and relatively simple: user list, search, actions (ban, suspend, promote).

**Step 1: Implement with HTMX search + action buttons**

```html
<input
  type="search"
  name="q"
  hx-get="/app/admin/users"
  hx-trigger="keyup changed delay:300ms"
  hx-target="#user-list"
  placeholder="Search users..."
/>
<div id="user-list">
  <!-- Server-rendered user table with action buttons -->
</div>
```

**Step 2: Commit**

```bash
git commit -m "feat(api): HTMX admin page with search and actions"
```

---

## Phase 5: Routing Cutover & Next.js Retirement

### Task 15: Configure routing for coexistence

During migration, both apps serve pages. Use Cloudflare Workers routing:

**Files:**

- Modify: `apps/api/wrangler.toml` (add `/app/*` route)
- Modify: `apps/web/next.config.js` (add redirect from migrated paths)

**Step 1: Route /app/\* to Hono Worker**

The Hono API Worker already handles `/api/*`. Now it also handles `/app/*`.
In `apps/api/wrangler.toml`, the existing route pattern should already cover this since the Worker handles all paths.

**Step 2: Add Next.js redirects for migrated pages**

In `apps/web/next.config.js`:

```javascript
async redirects() {
  return [
    // Redirect migrated pages to HTMX versions
    { source: '/dashboard/settings', destination: '/app/settings', permanent: false },
    { source: '/dashboard/team', destination: '/app/team', permanent: false },
    // Add more as pages migrate
  ];
}
```

**Step 3: Commit**

```bash
git commit -m "feat: configure routing for HTMX/Next.js coexistence"
```

---

### Task 16: Migrate remaining marketing/public pages

Public pages (`/`, `/pricing`, `/mcp`, `/scan`, `/chatgpt-seo`, `/ai-seo-tool`, `/leaderboard`, `/privacy`, `/terms`) are the final frontier. These are good HTMX candidates since they're mostly static with light interactivity.

**Step 1: Migrate one at a time, starting with `/pricing` (simplest)**

**Step 2: Migrate `/scan` (has a form + results)**

**Step 3: Final cutover — remove `apps/web` dependency**

When all pages are migrated:

1. Remove `apps/web/` from turborepo pipeline
2. Remove Next.js, React, and all frontend dependencies
3. Update CI/CD to only deploy Hono Worker
4. Update DNS/routing to point everything to the Hono Worker

This is the end state. Don't rush it — run both systems in parallel until confident.

**Step 4: Commit**

```bash
git commit -m "feat: retire Next.js, all pages served from Hono + HTMX"
```

---

## Phase 6: MCP Remaining Work (Parallel Track)

These tasks from the existing MCP plan are the remaining 5%:

### Task 17: MCP Phase 7 — Audit and add missing API endpoints

Some MCP tools reference endpoints that may not exist. Audit the 25 tools against actual API routes and add stubs for missing ones.

Reference: `docs/plans/2026-02-22-mcp-seo-interface.md` Task 18

### Task 18: MCP Phase 8 — Mintlify documentation portal

Set up `apps/docs/` with Mintlify. Document all 25 tools, 3 resources, 3 prompts.

Reference: `docs/plans/2026-02-22-mcp-seo-interface.md` Task 21

### Task 19: MCP Phase 11 — npm package publishing

Prepare `packages/mcp` for npm publish as `@llmrank.app/mcp`. Add build script, README, .npmignore, GitHub Actions workflow.

Reference: `docs/plans/2026-02-22-mcp-seo-interface.md` Tasks 26-27

### Task 20: MCP Phase 12 — Production deployment

Deploy MCP gateway to Cloudflare, create KV namespace, set secrets, verify health.

Reference: `docs/plans/2026-02-22-mcp-seo-interface.md` Task 28

---

## Page Migration Tracker

| #   | Page            | Route                             | Complexity | Phase | Status                   |
| --- | --------------- | --------------------------------- | ---------- | ----- | ------------------------ |
| 1   | Settings        | `/app/settings`                   | Simple     | 2     | Task 3+5                 |
| 2   | Team            | `/app/team`                       | Simple     | 2     | Task 6                   |
| 3   | New Project     | `/app/projects/new`               | Simple     | 2     | Task 7                   |
| 4   | Project Logs    | `/app/projects/:id/logs`          | Simple     | 2     | (follow Task 7 pattern)  |
| 5   | Project Issues  | `/app/projects/:id/issues`        | Medium     | 2     | Task 8                   |
| 6   | Projects List   | `/app/projects`                   | Medium     | 3     | Task 9                   |
| 7   | Project Detail  | `/app/projects/:id`               | Complex    | 3     | Task 10                  |
| 8   | Chart Islands   | (embedded)                        | Complex    | 3     | Task 11                  |
| 9   | Crawl Detail    | `/app/crawl/:id`                  | Complex    | 4     | Task 12                  |
| 10  | Page Detail     | `/app/projects/:id/pages/:pageId` | Complex    | 4     | Task 13                  |
| 11  | Admin           | `/app/admin`                      | Medium     | 4     | Task 14                  |
| 12  | History         | `/app/history`                    | Medium     | 4     | (follow Task 10 pattern) |
| 13  | Reports         | `/app/projects/:id/reports`       | Medium     | 4     | (follow Task 10 pattern) |
| 14  | Crawl History   | `/app/projects/:id/history`       | Medium     | 4     | (follow Task 10 pattern) |
| 15  | Pricing         | `/pricing`                        | Simple     | 5     | Task 16                  |
| 16  | Home            | `/`                               | Medium     | 5     | Task 16                  |
| 17  | Scan            | `/scan`                           | Medium     | 5     | Task 16                  |
| 18  | MCP             | `/mcp`                            | Simple     | 5     | Task 16                  |
| 19  | Other marketing | various                           | Simple     | 5     | Task 16                  |

---

## Summary

| Phase | Tasks | Focus                          | Can Parallelize With |
| ----- | ----- | ------------------------------ | -------------------- |
| 0     | 1-2   | Commit + last gap              | —                    |
| 1     | 3-4   | HTMX foundation                | MCP (Phase 6)        |
| 2     | 5-8   | Simple pages                   | MCP (Phase 6)        |
| 3     | 9-11  | Medium pages + chart islands   | MCP (Phase 6)        |
| 4     | 12-14 | Complex pages                  | —                    |
| 5     | 15-16 | Routing cutover + retirement   | —                    |
| 6     | 17-20 | MCP remaining (parallel track) | Phases 1-3           |

**Critical path:** Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
**Parallel track:** Phase 6 (MCP) runs alongside Phases 1-3
