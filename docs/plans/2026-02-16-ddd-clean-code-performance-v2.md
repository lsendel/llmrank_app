# DDD, Clean Code & Performance V2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate frontend duplication, centralize data fetching, refactor API services into a clean container + DTO architecture, and introduce lightweight DDD value objects and aggregates.

**Architecture:** Outside-In refactoring: Phase 1 cleans the frontend (utilities, hooks, perf), Phase 2 tightens the API (container, ownership middleware, service splits, DTOs), Phase 3 extracts domain (value objects, aggregates, type-safe issue codes). Each task is one shippable commit.

**Tech Stack:** Next.js (App Router), SWR, Hono, Drizzle ORM, Neon PostgreSQL, TypeScript, Vitest

---

## Phase 1: Frontend Cleanup

### Task 1: Extract shared frontend utilities

**Files:**

- Create: `apps/web/src/lib/format.ts`
- Create: `apps/web/src/lib/status.ts`
- Create: `apps/web/src/lib/error-messages.ts`
- Modify: `apps/web/src/app/dashboard/page.tsx:44-65` (remove inline functions)
- Modify: `apps/web/src/components/score-circle.tsx:6-27` (remove local duplicates)
- Test: `apps/web/src/lib/__tests__/format.test.ts`
- Test: `apps/web/src/lib/__tests__/status.test.ts`

**Step 1: Write failing tests for format utilities**

```typescript
// apps/web/src/lib/__tests__/format.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeTime } from "../format";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats minutes ago", () => {
    vi.setSystemTime(new Date("2026-02-16T12:30:00Z"));
    expect(formatRelativeTime("2026-02-16T12:25:00Z")).toBe("5m ago");
  });

  it("formats hours ago", () => {
    vi.setSystemTime(new Date("2026-02-16T15:00:00Z"));
    expect(formatRelativeTime("2026-02-16T12:00:00Z")).toBe("3h ago");
  });

  it("formats days ago", () => {
    vi.setSystemTime(new Date("2026-02-19T12:00:00Z"));
    expect(formatRelativeTime("2026-02-16T12:00:00Z")).toBe("3d ago");
  });

  it("falls back to date string for >7 days", () => {
    vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));
    const result = formatRelativeTime("2026-02-16T12:00:00Z");
    expect(result).toMatch(/2\/16\/2026/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/lib/__tests__/format.test.ts`
Expected: FAIL — module not found

**Step 3: Implement format.ts**

```typescript
// apps/web/src/lib/format.ts

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/lib/__tests__/format.test.ts`
Expected: PASS

**Step 5: Write status.ts tests and implementation**

```typescript
// apps/web/src/lib/__tests__/status.test.ts
import { describe, it, expect } from "vitest";
import { getStatusBadgeVariant } from "../status";

describe("getStatusBadgeVariant", () => {
  it("returns success for complete", () => {
    expect(getStatusBadgeVariant("complete")).toBe("success");
  });
  it("returns destructive for failed", () => {
    expect(getStatusBadgeVariant("failed")).toBe("destructive");
  });
  it("returns warning for crawling", () => {
    expect(getStatusBadgeVariant("crawling")).toBe("warning");
  });
  it("returns secondary for unknown", () => {
    expect(getStatusBadgeVariant("pending")).toBe("secondary");
  });
});
```

```typescript
// apps/web/src/lib/status.ts

type BadgeVariant = "success" | "destructive" | "warning" | "secondary";

export function getStatusBadgeVariant(status: string): BadgeVariant {
  if (status === "complete") return "success";
  if (status === "failed") return "destructive";
  if (status === "crawling" || status === "scoring") return "warning";
  return "secondary";
}
```

**Step 6: Create error-messages.ts**

```typescript
// apps/web/src/lib/error-messages.ts

export const ERROR_MESSAGES: Record<string, string> = {
  CRAWLER_UNAVAILABLE:
    "The crawler service is temporarily unavailable. Please try again in a few minutes.",
  CRAWLER_TIMEOUT:
    "The crawler service took too long to respond. Please try again.",
  CRAWL_IN_PROGRESS:
    "A crawl is already running for this project. Please wait for it to complete.",
  PLAN_LIMIT_REACHED:
    "You've reached the limit for your current plan. Upgrade to continue.",
  CRAWL_LIMIT_REACHED: "You've used all your crawl credits this month.",
  INVALID_DOMAIN: "Please enter a valid domain (e.g. example.com).",
};

export function getErrorMessage(code: string, fallback: string): string {
  return ERROR_MESSAGES[code] ?? fallback;
}
```

**Step 7: Update dashboard/page.tsx — replace inline functions with imports**

In `apps/web/src/app/dashboard/page.tsx`:

- Remove `formatRelativeTime` (lines 44-56) — import from `@/lib/format`
- Remove `getStatusBadgeVariant` (lines 58-65) — import from `@/lib/status`

**Step 8: Update score-circle.tsx — remove duplicate getLetterGrade**

In `apps/web/src/components/score-circle.tsx`:

- Remove `getLetterGrade` (lines 6-20) — import `letterGrade` from `@llm-boost/shared`
- Remove `getScoreColor` (lines 22-27) — import `scoreColor` from `@/lib/utils`
- Keep `getStrokeColor` (unique to this component — stroke- prefix not reusable)
- Update line 63: `const grade = letterGrade(score);`
- Update line 64: `const colorClass = scoreColor(score);`

**Step 9: Run full test suite and typecheck**

Run: `pnpm typecheck && cd apps/web && pnpm vitest run`
Expected: All pass, no type errors

**Step 10: Commit**

```bash
git add apps/web/src/lib/format.ts apps/web/src/lib/status.ts apps/web/src/lib/error-messages.ts apps/web/src/lib/__tests__/format.test.ts apps/web/src/lib/__tests__/status.test.ts apps/web/src/app/dashboard/page.tsx apps/web/src/components/score-circle.tsx
git commit -m "refactor(web): extract shared utilities (format, status, error-messages)"
```

---

### Task 2: Create domain data-fetching hooks (use-project, use-crawl)

**Files:**

- Create: `apps/web/src/hooks/use-project.ts`
- Create: `apps/web/src/hooks/use-crawl.ts`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx` (consume hooks)

**Step 1: Create use-project hook**

```typescript
// apps/web/src/hooks/use-project.ts
"use client";

import { useCallback } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";

export function useProject(id: string | undefined) {
  return useApiSWR(
    id ? `project-${id}` : null,
    useCallback(() => api.projects.get(id!), [id]),
  );
}

export function useProjects() {
  return useApiSWR(
    "projects",
    useCallback(() => api.projects.list(), []),
  );
}

export function useCreateProject() {
  const { withAuth } = useApi();

  async function createProject(data: { name: string; domain: string }) {
    return withAuth(() => api.projects.create(data));
  }

  return { createProject };
}
```

**Step 2: Create use-crawl hook with polling**

```typescript
// apps/web/src/hooks/use-crawl.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { isActiveCrawlStatus } from "@/components/crawl-progress";
import type { CrawlStatus } from "@/components/crawl-progress";

export function useCrawl(id: string | undefined) {
  return useApiSWR(
    id ? `crawl-${id}` : null,
    useCallback(() => api.crawls.get(id!), [id]),
  );
}

export function useCrawlHistory(projectId: string | undefined) {
  return useApiSWR(
    projectId ? `crawl-history-${projectId}` : null,
    useCallback(() => api.crawls.list(projectId!), [projectId]),
  );
}

/**
 * Polls a crawl until it reaches a terminal status.
 * Uses exponential backoff: 3s → 4.5s → 6.75s → ... capped at 30s.
 */
export function useCrawlPolling(crawlId: string | null) {
  const [crawl, setCrawl] = useState<any>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef(3000);

  useEffect(() => {
    if (!crawlId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const updated = await api.crawls.get(crawlId);
        if (cancelled) return;
        setCrawl(updated);

        if (isActiveCrawlStatus(updated.status as CrawlStatus)) {
          intervalRef.current = Math.min(intervalRef.current * 1.5, 30000);
          pollingRef.current = setTimeout(poll, intervalRef.current);
        }
      } catch {
        if (cancelled) return;
        intervalRef.current = Math.min(intervalRef.current * 1.5, 30000);
        pollingRef.current = setTimeout(poll, intervalRef.current);
      }
    };

    // Reset interval on new crawlId
    intervalRef.current = 3000;
    poll();

    return () => {
      cancelled = true;
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [crawlId]);

  return { crawl };
}
```

**Step 3: Update project detail page to use hooks**

In `apps/web/src/app/dashboard/projects/[id]/page.tsx`:

- Replace manual `useApiSWR` calls for project, crawl history, and pages with:

  ```typescript
  import { useProject } from "@/hooks/use-project";
  import { useCrawlHistory } from "@/hooks/use-crawl";

  const { data: project } = useProject(params.id);
  const { data: crawlHistoryData } = useCrawlHistory(params.id);
  ```

**Step 4: Typecheck and verify**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/web/src/hooks/use-project.ts apps/web/src/hooks/use-crawl.ts apps/web/src/app/dashboard/projects/\[id\]/page.tsx
git commit -m "refactor(web): add domain hooks for project and crawl data fetching"
```

---

### Task 3: Create dashboard and strategy hooks

**Files:**

- Create: `apps/web/src/hooks/use-dashboard.ts`
- Create: `apps/web/src/hooks/use-strategy.ts`
- Modify: `apps/web/src/app/dashboard/page.tsx` (use hook)
- Modify: `apps/web/src/components/tabs/strategy-tab.tsx` (use hook)

**Step 1: Create use-dashboard hook**

```typescript
// apps/web/src/hooks/use-dashboard.ts
"use client";

import { useCallback } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

export function useDashboardStats() {
  return useApiSWR(
    "dashboard-stats",
    useCallback(() => api.dashboard.getStats(), []),
  );
}

export function useRecentActivity() {
  return useApiSWR(
    "dashboard-activity",
    useCallback(() => api.dashboard.getRecentActivity(), []),
  );
}
```

**Step 2: Create use-strategy hook with mutation**

```typescript
// apps/web/src/hooks/use-strategy.ts
"use client";

import { useCallback, useState } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api, type StrategyCompetitor, type StrategyPersona } from "@/lib/api";

export function useCompetitors(projectId: string) {
  const { withAuth } = useApi();
  const { data, mutate, ...rest } = useApiSWR<StrategyCompetitor[]>(
    `competitors-${projectId}`,
    useCallback(() => api.strategy.getCompetitors(projectId), [projectId]),
  );

  async function addCompetitor(domain: string) {
    await withAuth(() => api.strategy.addCompetitor(projectId, domain));
    await mutate();
  }

  async function removeCompetitor(id: string) {
    await withAuth(() => api.strategy.removeCompetitor(id));
    await mutate();
  }

  return { competitors: data, addCompetitor, removeCompetitor, ...rest };
}

export function usePersonas(projectId: string) {
  const { withAuth } = useApi();
  const [personas, setPersonas] = useState<StrategyPersona[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generatePersonas(niche: string) {
    setGenerating(true);
    setError(null);
    try {
      const data = await withAuth(() =>
        api.strategy.generatePersonas(projectId, { niche }),
      );
      setPersonas(data as StrategyPersona[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate personas",
      );
      throw err;
    } finally {
      setGenerating(false);
    }
  }

  return { personas, generating, error, generatePersonas };
}
```

**Step 3: Update dashboard/page.tsx — use useDashboardStats + useRecentActivity**

In `apps/web/src/app/dashboard/page.tsx`:

- Replace manual `useApiSWR("dashboard-stats", ...)` with `useDashboardStats()`
- Replace manual `useApiSWR("dashboard-activity", ...)` with `useRecentActivity()`
- Remove `useCallback` import if no longer needed

**Step 4: Update strategy-tab.tsx — use useCompetitors + usePersonas**

In `apps/web/src/components/tabs/strategy-tab.tsx`:

- Replace manual `useApiSWR` + `mutateComps()` with `useCompetitors(projectId)`
- Replace inline persona state + generation logic with `usePersonas(projectId)`
- Remove `useApi` import (hooks handle auth internally)
- Component becomes ~50 lines shorter

**Step 5: Typecheck**

Run: `pnpm typecheck`

**Step 6: Commit**

```bash
git add apps/web/src/hooks/use-dashboard.ts apps/web/src/hooks/use-strategy.ts apps/web/src/app/dashboard/page.tsx apps/web/src/components/tabs/strategy-tab.tsx
git commit -m "refactor(web): add dashboard and strategy hooks, simplify components"
```

---

### Task 4: Extract onboarding wizard reducer

**Files:**

- Create: `apps/web/src/hooks/use-onboarding-wizard.ts`
- Modify: `apps/web/src/app/onboarding/page.tsx` (simplify to presentational)

**Step 1: Create useOnboardingWizard reducer hook**

Extract the 13 state variables (lines 56-83 of `onboarding/page.tsx`) into a single reducer that manages step transitions, form state, crawl polling, and error handling.

```typescript
// apps/web/src/hooks/use-onboarding-wizard.ts
"use client";

import { useReducer, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-hooks";
import { api, ApiError } from "@/lib/api";
import { isActiveCrawlStatus } from "@/components/crawl-progress";
import type { CrawlStatus } from "@/components/crawl-progress";

type Step = 0 | 1 | 2;

interface WizardState {
  step: Step;
  guardChecked: boolean;
  // Step 0
  name: string;
  nameError: string | null;
  // Step 1
  domain: string;
  projectName: string;
  submitting: boolean;
  stepError: string | null;
  // Step 2
  projectId: string | null;
  crawlId: string | null;
  crawl: any | null;
  crawlError: string | null;
  startingCrawl: boolean;
}

type Action =
  | { type: "SET_GUARD_CHECKED" }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_NAME_ERROR"; error: string | null }
  | { type: "SET_DOMAIN"; domain: string; projectName: string }
  | { type: "SET_PROJECT_NAME"; projectName: string }
  | { type: "SET_STEP"; step: Step }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; projectId: string }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "CRAWL_STARTING" }
  | { type: "CRAWL_STARTED"; crawlId: string; crawl: any }
  | { type: "CRAWL_ERROR"; error: string }
  | { type: "CRAWL_UPDATED"; crawl: any }
  | { type: "RETRY_CRAWL" };

const initialState: WizardState = {
  step: 0,
  guardChecked: false,
  name: "",
  nameError: null,
  domain: "",
  projectName: "",
  submitting: false,
  stepError: null,
  projectId: null,
  crawlId: null,
  crawl: null,
  crawlError: null,
  startingCrawl: false,
};

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_GUARD_CHECKED":
      return { ...state, guardChecked: true };
    case "SET_NAME":
      return { ...state, name: action.name, nameError: null };
    case "SET_NAME_ERROR":
      return { ...state, nameError: action.error };
    case "SET_DOMAIN":
      return {
        ...state,
        domain: action.domain,
        projectName: action.projectName,
      };
    case "SET_PROJECT_NAME":
      return { ...state, projectName: action.projectName };
    case "SET_STEP":
      return { ...state, step: action.step, stepError: null };
    case "SUBMIT_START":
      return { ...state, submitting: true, stepError: null };
    case "SUBMIT_SUCCESS":
      return {
        ...state,
        submitting: false,
        projectId: action.projectId,
        step: 2,
      };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, stepError: action.error };
    case "CRAWL_STARTING":
      return { ...state, startingCrawl: true, crawlError: null };
    case "CRAWL_STARTED":
      return {
        ...state,
        startingCrawl: false,
        crawlId: action.crawlId,
        crawl: action.crawl,
      };
    case "CRAWL_ERROR":
      return { ...state, startingCrawl: false, crawlError: action.error };
    case "CRAWL_UPDATED":
      return { ...state, crawl: action.crawl };
    case "RETRY_CRAWL":
      return { ...state, crawlId: null, crawl: null, crawlError: null };
    default:
      return state;
  }
}

export function useOnboardingWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef(3000);

  // Guard: redirect if not signed in or already has projects
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    let cancelled = false;
    api.projects
      .list()
      .then((res) => {
        if (cancelled) return;
        if (res.pagination.total > 0) router.push("/dashboard");
        else dispatch({ type: "SET_GUARD_CHECKED" });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "SET_GUARD_CHECKED" });
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router]);

  // Polling
  useEffect(() => {
    if (!state.crawlId || !state.crawl) return;
    if (!isActiveCrawlStatus(state.crawl.status)) return;

    const poll = async () => {
      try {
        const updated = await api.crawls.get(state.crawlId!);
        dispatch({ type: "CRAWL_UPDATED", crawl: updated });
        if (isActiveCrawlStatus(updated.status as CrawlStatus)) {
          intervalRef.current = Math.min(intervalRef.current * 1.5, 30000);
          pollingRef.current = setTimeout(poll, intervalRef.current);
        }
      } catch {
        intervalRef.current = Math.min(intervalRef.current * 1.5, 30000);
        pollingRef.current = setTimeout(poll, intervalRef.current);
      }
    };
    pollingRef.current = setTimeout(poll, intervalRef.current);
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [state.crawlId, state.crawl?.status]);

  const startCrawl = useCallback(async (pid: string) => {
    dispatch({ type: "CRAWL_STARTING" });
    try {
      const job = await api.crawls.start(pid);
      intervalRef.current = 3000;
      dispatch({ type: "CRAWL_STARTED", crawlId: job.id, crawl: job });
    } catch (err) {
      dispatch({
        type: "CRAWL_ERROR",
        error: err instanceof ApiError ? err.message : "Failed to start scan.",
      });
    }
  }, []);

  // Auto-start crawl on step 2
  useEffect(() => {
    if (
      state.step === 2 &&
      state.projectId &&
      !state.crawlId &&
      !state.startingCrawl
    ) {
      startCrawl(state.projectId);
    }
  }, [
    state.step,
    state.projectId,
    state.crawlId,
    state.startingCrawl,
    startCrawl,
  ]);

  const handleContinue = useCallback(() => {
    if (!state.name.trim()) {
      dispatch({ type: "SET_NAME_ERROR", error: "Name is required" });
      return;
    }
    dispatch({ type: "SET_STEP", step: 1 });
  }, [state.name]);

  const handleDomainChange = useCallback((value: string) => {
    let projectName = value.trim();
    try {
      let hostname = value.trim();
      if (hostname && !hostname.startsWith("http"))
        hostname = `https://${hostname}`;
      projectName = new URL(hostname).hostname;
    } catch {
      /* keep raw value */
    }
    dispatch({ type: "SET_DOMAIN", domain: value, projectName });
  }, []);

  const handleStartScan = useCallback(async () => {
    if (!state.domain.trim()) {
      dispatch({ type: "SUBMIT_ERROR", error: "Domain is required" });
      return;
    }
    if (!state.projectName.trim()) {
      dispatch({ type: "SUBMIT_ERROR", error: "Project name is required" });
      return;
    }
    dispatch({ type: "SUBMIT_START" });
    try {
      await api.account.updateProfile({
        name: state.name.trim(),
        onboardingComplete: true,
      });
      let normalizedDomain = state.domain.trim();
      if (
        !normalizedDomain.startsWith("http://") &&
        !normalizedDomain.startsWith("https://")
      ) {
        normalizedDomain = `https://${normalizedDomain}`;
      }
      const project = await api.projects.create({
        name: state.projectName.trim(),
        domain: normalizedDomain,
      });
      dispatch({ type: "SUBMIT_SUCCESS", projectId: project.id });
    } catch (err) {
      dispatch({
        type: "SUBMIT_ERROR",
        error: err instanceof ApiError ? err.message : "Something went wrong.",
      });
    }
  }, [state.domain, state.projectName, state.name]);

  const handleRetry = useCallback(() => {
    if (!state.projectId) return;
    dispatch({ type: "RETRY_CRAWL" });
    startCrawl(state.projectId);
  }, [state.projectId, startCrawl]);

  return {
    state,
    dispatch,
    isLoaded,
    isSignedIn,
    handleContinue,
    handleDomainChange,
    handleStartScan,
    handleRetry,
    router,
  };
}
```

**Step 2: Simplify onboarding/page.tsx to be presentational**

In `apps/web/src/app/onboarding/page.tsx`:

- Replace all 13 `useState` + `useRef` + `useEffect` blocks with:
  ```typescript
  const {
    state,
    dispatch,
    isLoaded,
    isSignedIn,
    handleContinue,
    handleDomainChange,
    handleStartScan,
    handleRetry,
    router,
  } = useOnboardingWizard();
  ```
- Component body becomes pure JSX — reads `state.step`, `state.crawl`, etc.
- All handlers come from the hook

**Step 3: Typecheck**

Run: `pnpm typecheck`

**Step 4: Commit**

```bash
git add apps/web/src/hooks/use-onboarding-wizard.ts apps/web/src/app/onboarding/page.tsx
git commit -m "refactor(web): extract onboarding wizard state into useReducer hook"
```

---

### Task 5: Frontend performance quick wins

**Files:**

- Modify: `apps/web/src/app/dashboard/layout.tsx` (add ErrorBoundary)
- Modify: Tab components that re-fetch parent data

**Step 1: Add global ErrorBoundary to dashboard layout**

In `apps/web/src/app/dashboard/layout.tsx`, wrap the main content area:

```typescript
import { ErrorBoundary } from "@/components/error-boundary";

// Inside the layout JSX, wrap the {children} slot:
<ErrorBoundary>
  {children}
</ErrorBoundary>
```

**Step 2: Audit and remove duplicate data fetches in tab components**

Check each tab component in `apps/web/src/components/tabs/`:

- If `overview-tab.tsx` fetches `api.crawls.getInsights(crawlId)` but the parent already passes insights as a prop (or could), refactor to accept the data as a prop instead.
- Apply same pattern to any other tab that re-fetches data the parent loaded.

**Step 3: Add React.memo to chart components**

In heavy chart components (`score-radar-chart.tsx`, `issue-distribution-chart.tsx`, `grade-distribution-chart.tsx`), wrap the export:

```typescript
export const ScoreRadarChart = memo(function ScoreRadarChart(props: Props) {
  // ... existing implementation
});
```

**Step 4: Typecheck and verify**

Run: `pnpm typecheck`

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/layout.tsx apps/web/src/components/tabs/ apps/web/src/components/charts/
git commit -m "perf(web): add ErrorBoundary, remove duplicate fetches, memo chart components"
```

---

## Phase 2: API Service Refactoring

### Task 6: Create request-scoped dependency container

**Files:**

- Create: `apps/api/src/container.ts`
- Modify: `apps/api/src/index.ts` (add container middleware)
- Modify: 2-3 busiest route files (projects, crawls, dashboard) to use container

**Step 1: Create container.ts**

```typescript
// apps/api/src/container.ts
import type { Database } from "@llm-boost/db";
import {
  createProjectRepository,
  createUserRepository,
  createCrawlRepository,
  createScoreRepository,
  createVisibilityRepository,
  createPageRepository,
  createBillingRepository,
  createCompetitorRepository,
  createLogRepository,
  createEnrichmentRepository,
  createReportRepository,
  createOutboxRepository,
  type ProjectRepository,
  type UserRepository,
  type CrawlRepository,
  type ScoreRepository,
  type PageRepository,
} from "./repositories";
import { createProjectService } from "./services/project-service";
import { createCrawlService } from "./services/crawl-service";
import { createDashboardService } from "./services/dashboard-service";

export interface Container {
  // Repositories
  projects: ProjectRepository;
  users: UserRepository;
  crawls: CrawlRepository;
  scores: ScoreRepository;
  pages: PageRepository;
  // Services (add as migrated)
  projectService: ReturnType<typeof createProjectService>;
  crawlService: ReturnType<typeof createCrawlService>;
  dashboardService: ReturnType<typeof createDashboardService>;
}

export function createContainer(db: Database): Container {
  const projects = createProjectRepository(db);
  const users = createUserRepository(db);
  const crawls = createCrawlRepository(db);
  const scores = createScoreRepository(db);
  const pages = createPageRepository(db);

  return {
    projects,
    users,
    crawls,
    scores,
    pages,
    projectService: createProjectService({ projects, users, crawls, scores }),
    crawlService: createCrawlService({ crawls, projects, users, scores }),
    dashboardService: createDashboardService({
      projects,
      crawls,
      scores,
      users,
    }),
  };
}
```

**Step 2: Add container middleware in index.ts**

In `apps/api/src/index.ts`, after the `db` middleware, add:

```typescript
import { createContainer, type Container } from "./container";

// Add to Variables type:
// container: Container;

app.use("*", async (c, next) => {
  const db = c.get("db");
  c.set("container", createContainer(db));
  await next();
});
```

**Step 3: Migrate projects.ts route to use container**

Replace:

```typescript
const service = createProjectService({
  projects: createProjectRepository(db),
  users: createUserRepository(db),
  // ...
});
```

With:

```typescript
const { projectService } = c.get("container");
```

**Step 4: Migrate 2 more route files (crawls.ts, dashboard.ts) similarly**

**Step 5: Typecheck**

Run: `pnpm typecheck`

**Step 6: Commit**

```bash
git add apps/api/src/container.ts apps/api/src/index.ts apps/api/src/routes/projects.ts apps/api/src/routes/crawls.ts apps/api/src/routes/dashboard.ts
git commit -m "refactor(api): add request-scoped dependency container, migrate 3 routes"
```

---

### Task 7: Standardize ownership via middleware

**Files:**

- Create: `apps/api/src/middleware/ownership.ts`
- Modify: Route files that use `assertProjectOwnership`
- Modify: Service files to remove ownership assertions

**Step 1: Create ownership middleware factory**

```typescript
// apps/api/src/middleware/ownership.ts
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";
import { ServiceError } from "../services/errors";

type ResourceType = "project" | "crawl";

export function withOwnership(
  resource: ResourceType,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const userId = c.get("userId");
    const id = c.req.param("id") ?? c.req.param("projectId");
    if (!id)
      throw new ServiceError("VALIDATION_ERROR", 400, "Missing resource ID");

    const { projects, crawls } = c.get("container");

    if (resource === "project") {
      const project = await projects.getById(id);
      if (!project)
        throw new ServiceError("NOT_FOUND", 404, "Project not found");
      if (project.userId !== userId)
        throw new ServiceError("FORBIDDEN", 403, "Access denied");
      c.set("project", project);
    } else if (resource === "crawl") {
      const crawl = await crawls.getById(id);
      if (!crawl) throw new ServiceError("NOT_FOUND", 404, "Crawl not found");
      // Verify via project ownership
      const project = await projects.getById(crawl.projectId);
      if (!project || project.userId !== userId)
        throw new ServiceError("FORBIDDEN", 403, "Access denied");
      c.set("crawl", crawl);
    }

    await next();
  };
}
```

**Step 2: Apply to route files**

In route files, replace inline ownership checks:

```typescript
// Before:
projectRoutes.get("/:id", authMiddleware, async (c) => {
  await assertProjectOwnership(deps.projects, userId, id);
  // ...
});

// After:
projectRoutes.get(
  "/:id",
  authMiddleware,
  withOwnership("project"),
  async (c) => {
    const project = c.get("project"); // already verified
    // ...
  },
);
```

**Step 3: Remove assertProjectOwnership from services that no longer need it**

**Step 4: Typecheck and run tests**

Run: `pnpm typecheck && cd apps/api && pnpm vitest run`

**Step 5: Commit**

```bash
git add apps/api/src/middleware/ownership.ts apps/api/src/routes/ apps/api/src/services/
git commit -m "refactor(api): add ownership middleware, remove scattered assertions"
```

---

### Task 8: Split ingest-service into focused services

**Files:**

- Modify: `apps/api/src/services/ingest-service.ts` (reduce to orchestrator)
- Create: `apps/api/src/services/scoring-service.ts`
- Create: `apps/api/src/services/enrichment-service.ts`
- Create: `apps/api/src/services/recommendation-service.ts`

**Step 1: Extract scoring-service.ts**

Move the scoring logic (internal `scorePage` calls + LLM scoring) from `ingest-service.ts` into `scoring-service.ts`. The service accepts page data and returns scores.

**Step 2: Extract enrichment-service.ts**

Move integration-driven enrichment logic into its own service.

**Step 3: Extract recommendation-service.ts**

Move recommendation generation, regression detection, and summary generation.

**Step 4: Update ingest-service.ts as orchestrator**

```typescript
export function createIngestService(deps: IngestDeps) {
  return {
    async processBatch(args: BatchArgs) {
      // 1. Parse & validate batch
      // 2. Insert pages (own responsibility)
      // 3. Call scoringService.scorePages(pages)
      // 4. Call enrichmentService.enrichPages(pages) if integrations exist
      // 5. Call recommendationService.generateRecommendations(scores)
      // 6. Queue notifications
    },
  };
}
```

**Step 5: Update existing tests — they should still pass since behavior is unchanged**

Run: `cd apps/api && pnpm vitest run`

**Step 6: Commit**

```bash
git add apps/api/src/services/ingest-service.ts apps/api/src/services/scoring-service.ts apps/api/src/services/enrichment-service.ts apps/api/src/services/recommendation-service.ts
git commit -m "refactor(api): split ingest-service into scoring, enrichment, recommendation services"
```

---

### Task 9: Add DTO layer

**Files:**

- Create: `apps/api/src/dto/project.dto.ts`
- Create: `apps/api/src/dto/crawl.dto.ts`
- Create: `apps/api/src/dto/page.dto.ts`
- Modify: Route files to use DTO mappers before `c.json()`

**Step 1: Create project DTO mapper**

```typescript
// apps/api/src/dto/project.dto.ts

export function toProjectResponse(entity: any) {
  return {
    id: entity.id,
    name: entity.name,
    domain: entity.domain,
    settings: entity.settings,
    branding: entity.branding,
    latestCrawl: entity.latestCrawl ?? null,
    createdAt: entity.createdAt,
  };
}

export function toProjectListResponse(entities: any[]) {
  return entities.map(toProjectResponse);
}
```

**Step 2: Create crawl and page DTOs similarly**

**Step 3: Update route files**

```typescript
// Before:
return c.json({ data: project });

// After:
return c.json({ data: toProjectResponse(project) });
```

**Step 4: Typecheck**

Run: `pnpm typecheck`

**Step 5: Commit**

```bash
git add apps/api/src/dto/
git commit -m "refactor(api): add DTO mappers to decouple API response shape from DB schema"
```

---

### Task 10: API performance quick wins

**Files:**

- Modify: `apps/api/src/index.ts` (add compress middleware)
- Modify: Repository layer (add query timing)

**Step 1: Add compression middleware**

```typescript
import { compress } from "hono/compress";
// Add early in middleware stack:
app.use("*", compress());
```

**Step 2: Add query timing wrapper**

Create a helper that wraps Drizzle queries and logs slow ones (>100ms) via the structured logger.

**Step 3: Audit and fix N+1 patterns**

Check crawl history and page listing endpoints for sequential queries that should be joins or batch queries.

**Step 4: Run tests**

Run: `cd apps/api && pnpm vitest run`

**Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/repositories/
git commit -m "perf(api): add response compression, query timing, fix N+1 patterns"
```

---

## Phase 3: Domain Layer Extraction

### Task 11: Create Plan and Score value objects

**Files:**

- Create: `packages/shared/src/domain/plan.ts`
- Create: `packages/shared/src/domain/score.ts`
- Test: `packages/shared/src/__tests__/domain/plan.test.ts`
- Test: `packages/shared/src/__tests__/domain/score.test.ts`
- Modify: `packages/shared/src/index.ts` (export new modules)
- Modify: `packages/shared/src/domain/plan-enforcer.ts` (delegate to Plan class)

**Step 1: Write failing tests for Plan value object**

```typescript
// packages/shared/src/__tests__/domain/plan.test.ts
import { describe, it, expect } from "vitest";
import { Plan } from "../../domain/plan";

describe("Plan", () => {
  it("returns correct max projects for free tier", () => {
    const plan = Plan.from("free");
    expect(plan.maxProjects).toBe(1);
  });

  it("canCreateProject returns true when under limit", () => {
    const plan = Plan.from("starter");
    expect(plan.canCreateProject(3)).toBe(true);
  });

  it("canCreateProject returns false when at limit", () => {
    const plan = Plan.from("free");
    expect(plan.canCreateProject(1)).toBe(false);
  });

  it("meetsMinimumTier compares correctly", () => {
    const plan = Plan.from("pro");
    expect(plan.meetsMinimumTier("starter")).toBe(true);
    expect(plan.meetsMinimumTier("agency")).toBe(false);
  });

  it("getMaxPages returns correct value", () => {
    const plan = Plan.from("agency");
    expect(plan.maxPagesPerCrawl).toBe(2000);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/shared && pnpm vitest run src/__tests__/domain/plan.test.ts`

**Step 3: Implement Plan value object**

```typescript
// packages/shared/src/domain/plan.ts
import {
  PLAN_LIMITS,
  type PlanTier,
  type PlanLimits,
} from "../constants/plans";
import {
  PLAN_INTEGRATION_ACCESS,
  type IntegrationProvider,
} from "../constants/integrations";

const TIER_ORDER: PlanTier[] = ["free", "starter", "pro", "agency"];

export class Plan {
  private constructor(
    public readonly tier: PlanTier,
    private readonly limits: PlanLimits,
  ) {}

  static from(tier: PlanTier): Plan {
    return new Plan(tier, PLAN_LIMITS[tier]);
  }

  get maxProjects(): number {
    return this.limits.projects;
  }
  get maxPagesPerCrawl(): number {
    return this.limits.pagesPerCrawl;
  }
  get maxCrawlsPerMonth(): number {
    return this.limits.crawlsPerMonth;
  }

  canCreateProject(currentCount: number): boolean {
    return currentCount < this.limits.projects;
  }

  meetsMinimumTier(required: PlanTier): boolean {
    return TIER_ORDER.indexOf(this.tier) >= TIER_ORDER.indexOf(required);
  }

  canAccessIntegration(provider: IntegrationProvider): boolean {
    return (PLAN_INTEGRATION_ACCESS[this.tier] ?? []).includes(provider);
  }

  canRunVisibilityChecks(usedThisMonth: number, newCount: number): boolean {
    return usedThisMonth + newCount <= this.limits.visibilityChecks;
  }
}
```

**Step 4: Run tests**

Run: `cd packages/shared && pnpm vitest run src/__tests__/domain/plan.test.ts`
Expected: PASS

**Step 5: Write Score value object tests + implementation**

```typescript
// packages/shared/src/domain/score.ts

export class Score {
  constructor(public readonly value: number) {
    if (value < 0 || value > 100)
      throw new RangeError(`Score must be 0-100, got ${value}`);
  }

  get letterGrade(): string {
    if (this.value >= 90) return "A";
    if (this.value >= 80) return "B";
    if (this.value >= 70) return "C";
    if (this.value >= 60) return "D";
    return "F";
  }

  get color(): string {
    if (this.value >= 80) return "text-success";
    if (this.value >= 60) return "text-warning";
    return "text-destructive";
  }

  get isPassingGrade(): boolean {
    return this.value >= 60;
  }
}
```

**Step 6: Update plan-enforcer.ts to delegate to Plan class**

```typescript
// packages/shared/src/domain/plan-enforcer.ts
// Keep existing function signatures for backward compatibility,
// but delegate internally to Plan class:

import { Plan } from "./plan";

export function meetsMinimumTier(
  userPlan: PlanTier,
  requiredTier: PlanTier,
): boolean {
  return Plan.from(userPlan).meetsMinimumTier(requiredTier);
}

export function canCreateProject(
  plan: PlanTier,
  currentProjectCount: number,
): boolean {
  return Plan.from(plan).canCreateProject(currentProjectCount);
}
// ... etc
```

**Step 7: Export from index.ts**

Add to `packages/shared/src/index.ts`:

```typescript
export { Plan } from "./domain/plan";
export { Score } from "./domain/score";
```

**Step 8: Run all shared tests**

Run: `cd packages/shared && pnpm vitest run`
Expected: All pass

**Step 9: Commit**

```bash
git add packages/shared/src/domain/plan.ts packages/shared/src/domain/score.ts packages/shared/src/__tests__/domain/ packages/shared/src/domain/plan-enforcer.ts packages/shared/src/index.ts
git commit -m "feat(shared): add Plan and Score value objects"
```

---

### Task 12: Create CrawlStatus value object and branded IDs

**Files:**

- Create: `packages/shared/src/domain/crawl-status.ts`
- Create: `packages/shared/src/domain/branded-ids.ts`
- Test: `packages/shared/src/__tests__/domain/crawl-status.test.ts`

**Step 1: Write CrawlStatus tests**

```typescript
describe("CrawlStatus", () => {
  it("allows valid transition: pending → crawling", () => {
    const status = CrawlStatus.from("pending");
    expect(status.canTransitionTo("crawling")).toBe(true);
  });

  it("rejects invalid transition: complete → crawling", () => {
    const status = CrawlStatus.from("complete");
    expect(status.canTransitionTo("crawling")).toBe(false);
  });

  it("isTerminal returns true for complete and failed", () => {
    expect(CrawlStatus.from("complete").isTerminal).toBe(true);
    expect(CrawlStatus.from("failed").isTerminal).toBe(true);
    expect(CrawlStatus.from("crawling").isTerminal).toBe(false);
  });
});
```

**Step 2: Implement CrawlStatus with state machine**

```typescript
// packages/shared/src/domain/crawl-status.ts

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["crawling", "failed"],
  crawling: ["scoring", "failed"],
  scoring: ["complete", "failed"],
  complete: [],
  failed: [],
};

const TERMINAL_STATES = new Set(["complete", "failed"]);

export class CrawlStatus {
  private constructor(public readonly value: string) {}

  static from(value: string): CrawlStatus {
    if (!(value in VALID_TRANSITIONS))
      throw new Error(`Invalid crawl status: ${value}`);
    return new CrawlStatus(value);
  }

  get isTerminal(): boolean {
    return TERMINAL_STATES.has(this.value);
  }
  get isActive(): boolean {
    return !this.isTerminal;
  }

  canTransitionTo(next: string): boolean {
    return (VALID_TRANSITIONS[this.value] ?? []).includes(next);
  }

  transition(next: string): CrawlStatus {
    if (!this.canTransitionTo(next)) {
      throw new Error(`Invalid transition: ${this.value} → ${next}`);
    }
    return CrawlStatus.from(next);
  }
}
```

**Step 3: Create branded IDs**

```typescript
// packages/shared/src/domain/branded-ids.ts

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type ProjectId = Brand<string, "ProjectId">;
export type UserId = Brand<string, "UserId">;
export type CrawlId = Brand<string, "CrawlId">;
export type PageId = Brand<string, "PageId">;

export function projectId(id: string): ProjectId {
  return id as ProjectId;
}
export function userId(id: string): UserId {
  return id as UserId;
}
export function crawlId(id: string): CrawlId {
  return id as CrawlId;
}
export function pageId(id: string): PageId {
  return id as PageId;
}
```

**Step 4: Run tests and commit**

```bash
git add packages/shared/src/domain/crawl-status.ts packages/shared/src/domain/branded-ids.ts packages/shared/src/__tests__/domain/
git commit -m "feat(shared): add CrawlStatus value object with state machine and branded IDs"
```

---

### Task 13: Create Project and CrawlJob aggregates

**Files:**

- Create: `packages/shared/src/domain/project-aggregate.ts`
- Create: `packages/shared/src/domain/crawl-aggregate.ts`
- Test: `packages/shared/src/__tests__/domain/project-aggregate.test.ts`
- Test: `packages/shared/src/__tests__/domain/crawl-aggregate.test.ts`

**Step 1: Write Project aggregate tests**

Test `canStartCrawl()`, `canAddPage()`, `isOwnedBy()`.

**Step 2: Implement Project aggregate**

```typescript
// packages/shared/src/domain/project-aggregate.ts
import { Plan } from "./plan";
import type { PlanTier } from "../constants/plans";

export class ProjectAggregate {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly domain: string,
    private readonly activeCrawlId: string | null,
  ) {}

  isOwnedBy(uid: string): boolean {
    return this.userId === uid;
  }

  canStartCrawl(plan: PlanTier, creditsRemaining: number): boolean {
    if (this.activeCrawlId) return false; // already crawling
    return creditsRemaining > 0;
  }

  canAddPage(currentPageCount: number, plan: PlanTier): boolean {
    return currentPageCount < Plan.from(plan).maxPagesPerCrawl;
  }
}
```

**Step 3: Write CrawlJob aggregate tests + implementation**

Test `transition()`, `isExpired()`, `canIngest()`.

**Step 4: Run tests, commit**

```bash
git commit -m "feat(shared): add Project and CrawlJob aggregate roots"
```

---

### Task 14: Migrate services to use aggregates

**Files:**

- Modify: `apps/api/src/services/project-service.ts`
- Modify: `apps/api/src/services/crawl-service.ts`

**Step 1: Update project-service to use Plan value object**

Replace:

```typescript
if (!canCreateProject(user.plan, existingProjects.length)) { ... }
```

With:

```typescript
const plan = Plan.from(user.plan);
if (!plan.canCreateProject(existingProjects.length)) { ... }
```

**Step 2: Update crawl-service to use CrawlStatus transitions**

Replace:

```typescript
if (crawl.status === "complete" || crawl.status === "failed") { ... }
```

With:

```typescript
const status = CrawlStatus.from(crawl.status);
if (status.isTerminal) { ... }
```

**Step 3: Run all API tests**

Run: `cd apps/api && pnpm vitest run`

**Step 4: Commit**

```bash
git commit -m "refactor(api): migrate project and crawl services to use domain value objects"
```

---

### Task 15: Type-safe issue codes and deduct() refactor

**Files:**

- Modify: `packages/shared/src/constants/issues.ts` (add IssueCode type)
- Modify: `packages/scoring/src/factors/helpers.ts` (update deduct signature)
- Modify: `packages/scoring/src/factors/technical.ts` (use new signature)
- Modify: `packages/scoring/src/factors/content.ts`
- Modify: `packages/scoring/src/factors/ai-readiness.ts`
- Modify: `packages/scoring/src/factors/performance.ts`

**Step 1: Add IssueCode type to shared**

```typescript
// In packages/shared/src/constants/issues.ts, add:
export type IssueCode = keyof typeof ISSUE_DEFINITIONS;
```

**Step 2: Update deduct() to derive amount from definition**

```typescript
// packages/scoring/src/factors/helpers.ts
import {
  ISSUE_DEFINITIONS,
  type Issue,
  type IssueCode,
} from "@llm-boost/shared";

export function deduct(
  state: ScoreState,
  code: IssueCode,
  data?: Record<string, unknown>,
): void {
  const def = ISSUE_DEFINITIONS[code];
  state.score = Math.max(0, state.score + def.scoreImpact);
  state.issues.push({
    code: def.code,
    category: def.category,
    severity: def.severity,
    message: def.message,
    recommendation: def.recommendation,
    data,
  });
}
```

**Step 3: Update all factor files**

Replace: `deduct(s, "MISSING_TITLE", -15, { titleLength: 0 })`
With: `deduct(s, "MISSING_TITLE", { titleLength: 0 })`

The amount is now derived from `ISSUE_DEFINITIONS.MISSING_TITLE.scoreImpact`.

**Step 4: Run all scoring tests**

Run: `cd packages/scoring && pnpm vitest run`
Expected: All 119 tests pass (behavior unchanged — amounts match definitions)

**Step 5: Commit**

```bash
git commit -m "refactor(scoring): type-safe issue codes, derive deduction amounts from definitions"
```

---

### Task 16: LLM package performance and cleanup

**Files:**

- Create: `packages/llm/src/utils.ts` (shared `stripFences`)
- Create: `packages/llm/src/llm-config.ts` (centralized model selection)
- Modify: `packages/llm/src/optimizer.ts` (use shared utils + config)
- Modify: `packages/llm/src/personas.ts` (use shared utils + config)
- Modify: `packages/llm/src/summary.ts` (use config)
- Modify: `packages/db/package.json` (remove unused dep)

**Step 1: Extract stripFences into shared utility**

````typescript
// packages/llm/src/utils.ts
export function stripFences(text: string): string {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}
````

**Step 2: Create centralized model config**

```typescript
// packages/llm/src/llm-config.ts
export const LLM_MODELS = {
  scoring: "claude-sonnet-4-5-20250929",
  summary: "claude-haiku-4-5-20251001",
  personas: "claude-sonnet-4-5-20250929",
  optimizer: "claude-sonnet-4-5-20250929",
  visibility: {
    claude: "claude-sonnet-4-5-20250929",
    chatgpt: "gpt-4o",
    gemini: "gemini-2.0-flash",
  },
} as const;
```

**Step 3: Update optimizer.ts and personas.ts**

Replace local `stripFences` with import from `./utils`. Replace hardcoded model strings with `LLM_MODELS.optimizer` etc.

**Step 4: Remove unused dependency from packages/db**

In `packages/db/package.json`, remove `"@llm-boost/shared": "workspace:*"` from dependencies.

**Step 5: Run all LLM tests**

Run: `cd packages/llm && pnpm vitest run`

**Step 6: Commit**

```bash
git add packages/llm/src/utils.ts packages/llm/src/llm-config.ts packages/llm/src/optimizer.ts packages/llm/src/personas.ts packages/llm/src/summary.ts packages/db/package.json
git commit -m "refactor(llm): centralize model config, extract shared utils, remove unused db dep"
```
