# Frontend Performance Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Dramatically improve dashboard load times and navigation speed through SWR caching, dynamic imports, loading skeletons, and component splitting.

**Architecture:** Add SWR as the data-fetching layer between React components and the existing `api.*` methods. Lazy-load Recharts via `next/dynamic`. Add `loading.tsx` skeletons per route. Split the 937-line project page into tab components.

**Tech Stack:** SWR, next/dynamic, React Suspense

---

### Task 1: Install SWR and Create `useApiSWR` Hook

**Files:**

- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/use-api-swr.ts`

**Step 1: Install SWR**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm add swr --filter @llm-boost/web`

**Step 2: Create the `useApiSWR` hook**

Create `apps/web/src/lib/use-api-swr.ts`:

```typescript
"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

/**
 * SWR wrapper that auto-injects Clerk auth token.
 * Usage: const { data, error, isLoading } = useApiSWR("dashboard-stats", (token) => api.dashboard.getStats(token));
 */
export function useApiSWR<T>(
  key: string | null,
  fetcher: (token: string) => Promise<T>,
  config?: SWRConfiguration<T>,
) {
  const { getToken } = useAuth();

  const wrappedFetcher = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");
    return fetcher(token);
  }, [getToken, fetcher]);

  return useSWR<T>(key, wrappedFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
    ...config,
  });
}
```

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/use-api-swr.ts pnpm-lock.yaml
git commit -m "feat: add SWR and useApiSWR hook for cached data fetching"
```

---

### Task 2: Migrate Dashboard Page to SWR

**Files:**

- Modify: `apps/web/src/app/dashboard/page.tsx`

**Step 1: Replace useEffect/useState with useApiSWR**

Replace the imports and data-fetching logic in `apps/web/src/app/dashboard/page.tsx`:

- Remove: `useEffect`, `useState` for `stats`, `activity`, `loading`
- Remove: the `useApi` import and `withToken` usage
- Add: `import { useApiSWR } from "@/lib/use-api-swr"`
- Replace the data-fetching block (lines 65-88) with:

```typescript
const { data: stats, isLoading: statsLoading } = useApiSWR(
  "dashboard-stats",
  useCallback((token: string) => api.dashboard.getStats(token), []),
);

const { data: activity, isLoading: activityLoading } = useApiSWR(
  "dashboard-activity",
  useCallback((token: string) => api.dashboard.getRecentActivity(token), []),
);

const loading = statsLoading || activityLoading;
```

- Update the `activity` references: change `activity.map(...)` to `(activity ?? []).map(...)`

**Step 2: Verify the page still renders correctly**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm typecheck --filter @llm-boost/web`

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/page.tsx
git commit -m "refactor: migrate dashboard page to SWR for cached data fetching"
```

---

### Task 3: Migrate Project Detail Page to SWR + Split Into Tab Components

**Files:**

- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx`
- Create: `apps/web/src/components/tabs/overview-tab.tsx`
- Create: `apps/web/src/components/tabs/pages-tab.tsx`
- Create: `apps/web/src/components/tabs/issues-tab.tsx`
- Create: `apps/web/src/components/tabs/history-tab.tsx`
- Create: `apps/web/src/components/tabs/visibility-tab.tsx`

**Step 1: Extract tab components**

Move each tab's content to its own file under `apps/web/src/components/tabs/`:

- `overview-tab.tsx` — Score hero, category breakdown, QuickWinsCard, top issues (lines 191-303)
- `pages-tab.tsx` — PagesTabContent component (lines 337-508)
- `issues-tab.tsx` — IssuesTabContent component (lines 510-584)
- `history-tab.tsx` — HistoryTabContent component (lines 854-936)
- `visibility-tab.tsx` — VisibilityTabContent + VisibilityResultCard + PlatformReadinessMatrix + ShareOfVoiceChart (lines 588-850)

Each tab component receives its data as props. The visibility tab fetches its own data internally (it already does this).

**Step 2: Replace useEffect data fetching with SWR in the parent**

In the parent `page.tsx`, replace the `useEffect` block (lines 73-94) with:

```typescript
const { data: project, isLoading: projectLoading } = useApiSWR(
  `project-${params.id}`,
  useCallback(
    (token: string) => api.projects.get(token, params.id),
    [params.id],
  ),
);

const latestCrawlId = project?.latestCrawl?.id;

const { data: crawlHistory } = useApiSWR(
  `crawl-history-${params.id}`,
  useCallback(
    (token: string) => api.crawls.list(token, params.id),
    [params.id],
  ),
);

const { data: pagesData } = useApiSWR(
  latestCrawlId ? `pages-${latestCrawlId}` : null,
  useCallback(
    (token: string) => api.pages.list(token, latestCrawlId!),
    [latestCrawlId],
  ),
);

const { data: issuesData } = useApiSWR(
  latestCrawlId ? `issues-${latestCrawlId}` : null,
  useCallback(
    (token: string) => api.issues.listForCrawl(token, latestCrawlId!),
    [latestCrawlId],
  ),
);
```

**Step 3: Dynamically import heavy tab components**

```typescript
import dynamic from "next/dynamic";

const VisibilityTab = dynamic(() => import("@/components/tabs/visibility-tab"), {
  loading: () => <div className="py-8 text-center text-muted-foreground">Loading...</div>,
});
```

This ensures Recharts (~200KB) is only loaded when the Visibility tab is opened.

**Step 4: Typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm typecheck --filter @llm-boost/web`

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/projects/[id]/page.tsx apps/web/src/components/tabs/
git commit -m "refactor: split project page into tab components with SWR and dynamic imports"
```

---

### Task 4: Migrate Crawl Detail Page to SWR with Exponential Backoff

**Files:**

- Modify: `apps/web/src/app/dashboard/crawl/[id]/page.tsx`

**Step 1: Replace useEffect polling with SWR refreshInterval**

Replace the manual polling logic (lines 30-81) with:

```typescript
const [pollInterval, setPollInterval] = useState(3000);

const {
  data: crawl,
  error,
  isLoading: loading,
} = useApiSWR(
  `crawl-${params.id}`,
  useCallback((token: string) => api.crawls.get(token, params.id), [params.id]),
  {
    refreshInterval: pollInterval,
    onSuccess: (data) => {
      if (!isActiveCrawlStatus(data.status as CrawlStatus)) {
        setPollInterval(0); // stop polling
      } else {
        // Exponential backoff: 3s → 5s → 10s → 15s → 30s
        setPollInterval((prev) => Math.min(prev * 1.5, 30_000));
      }
    },
  },
);
```

Remove: `pollRef`, `fetchCrawl` callback, both `useEffect` blocks.

**Step 2: Typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm typecheck --filter @llm-boost/web`

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/crawl/[id]/page.tsx
git commit -m "refactor: replace crawl polling with SWR exponential backoff"
```

---

### Task 5: Migrate Remaining Pages to SWR

**Files:**

- Modify: `apps/web/src/app/dashboard/projects/page.tsx` (projects list)
- Modify: `apps/web/src/components/quick-wins-card.tsx`
- Modify: `apps/web/src/components/platform-readiness-matrix.tsx`
- Modify: `apps/web/src/components/share-of-voice-chart.tsx`

**Step 1: Projects list page**

Replace `useEffect` + `useState` with `useApiSWR("projects-list", ...)`.

**Step 2: QuickWinsCard component**

Replace `useEffect` + `useState` with `useApiSWR(`quick-wins-${crawlId}`, ...)`.

**Step 3: PlatformReadinessMatrix component**

Replace `useEffect` + `useState` with `useApiSWR(`platform-readiness-${crawlId}`, ...)`.

**Step 4: ShareOfVoiceChart component**

Replace `useEffect` + `useState` with `useApiSWR(`sov-trends-${projectId}`, ...)`.

**Step 5: Typecheck**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm typecheck --filter @llm-boost/web`

**Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/projects/page.tsx apps/web/src/components/quick-wins-card.tsx apps/web/src/components/platform-readiness-matrix.tsx apps/web/src/components/share-of-voice-chart.tsx
git commit -m "refactor: migrate remaining pages and components to SWR"
```

---

### Task 6: Add Loading Skeletons

**Files:**

- Create: `apps/web/src/app/dashboard/loading.tsx`
- Create: `apps/web/src/app/dashboard/projects/loading.tsx`
- Create: `apps/web/src/app/dashboard/projects/[id]/loading.tsx`
- Create: `apps/web/src/app/dashboard/crawl/[id]/loading.tsx`

**Step 1: Create skeleton components**

Each `loading.tsx` should render a shimmer skeleton matching the page layout. Use Tailwind's `animate-pulse` on placeholder `<div>` blocks.

Dashboard skeleton: 4 stat cards + activity list.
Projects skeleton: grid of project cards.
Project detail skeleton: score circle + category bars + tab content.
Crawl detail skeleton: progress bar + score summary.

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/loading.tsx apps/web/src/app/dashboard/projects/loading.tsx apps/web/src/app/dashboard/projects/[id]/loading.tsx apps/web/src/app/dashboard/crawl/[id]/loading.tsx
git commit -m "feat: add loading skeletons for instant perceived navigation"
```

---

### Task 7: Fix Dashboard Layout Caching

**Files:**

- Modify: `apps/web/src/app/dashboard/layout.tsx`

**Step 1: Remove `cache: "no-store"` from onboarding check**

In `apps/web/src/app/dashboard/layout.tsx`, line 18, change:

```typescript
// Before
cache: "no-store",

// After — cache for 5 minutes, onboarding status rarely changes
next: { revalidate: 300 },
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/layout.tsx
git commit -m "perf: cache onboarding check for 5 minutes instead of no-store"
```

---

### Task 8: Verify Everything

**Step 1: Typecheck all packages**

Run: `pnpm typecheck`
Expected: All 6 packages clean.

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All 145+ tests pass.

**Step 3: Build the web app**

Run: `pnpm build --filter @llm-boost/web`
Expected: Build succeeds with no errors.
