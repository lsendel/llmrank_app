# Navigation, Tools & Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global sidebar (Approach B), six free public tools, and redesign auth pages with Google One Tap.

**Architecture:** Global `AppSidebar` at dashboard layout level coexists with existing `ProjectSidebar`. Six tool pages at `/tools/[slug]` with public access and 1/day rate limit. Auth pages rebuilt Google-first with GIS One Tap SDK.

**Tech Stack:** Next.js App Router, shadcn/ui, Tailwind, Hono API, better-auth, Google Identity Services SDK, existing scoring engine + robots parser.

---

## Phase 1: Global Sidebar + Layout Restructure

### Task 1: Create SidebarContext for collapse state

**Files:**

- Create: `apps/web/src/components/sidebar/sidebar-context.tsx`
- Test: `apps/web/src/components/sidebar/sidebar-context.test.tsx`

**Step 1: Write the test**

```tsx
// sidebar-context.test.tsx
import { renderHook, act } from "@testing-library/react";
import { SidebarProvider, useSidebar } from "./sidebar-context";

function wrapper({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>;
}

describe("useSidebar", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to collapsed", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });
    expect(result.current.collapsed).toBe(true);
  });

  it("toggles collapse state", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
  });

  it("persists state to localStorage", () => {
    const { result } = renderHook(() => useSidebar(), { wrapper });
    act(() => result.current.toggle());
    expect(localStorage.getItem("sidebar-collapsed")).toBe("false");
  });

  it("reads initial state from localStorage", () => {
    localStorage.setItem("sidebar-collapsed", "false");
    const { result } = renderHook(() => useSidebar(), { wrapper });
    expect(result.current.collapsed).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/sidebar/sidebar-context.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement SidebarContext**

```tsx
// sidebar-context.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "sidebar-collapsed";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function getInitial(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedRaw] = useState(getInitial);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedRaw(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  const value = useMemo(
    () => ({ collapsed, toggle, setCollapsed }),
    [collapsed, toggle, setCollapsed],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/sidebar/sidebar-context.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/components/sidebar/
git commit -m "feat: add SidebarContext with localStorage persistence"
```

---

### Task 2: Create AppSidebar component

**Files:**

- Create: `apps/web/src/components/sidebar/app-sidebar.tsx`
- Create: `apps/web/src/components/sidebar/sidebar-nav-item.tsx`
- Create: `apps/web/src/components/sidebar/sidebar-user-footer.tsx`
- Create: `apps/web/src/components/sidebar/index.ts`

**Step 1: Create SidebarNavItem (atomic nav element)**

```tsx
// sidebar-nav-item.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "./sidebar-context";

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

export function SidebarNavItem({
  href,
  label,
  icon: Icon,
  exact,
}: SidebarNavItemProps) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  const link = (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
```

**Step 2: Create SidebarUserFooter**

```tsx
// sidebar-user-footer.tsx
"use client";

import { useUser, useAuth } from "@/lib/auth-hooks";
import { useSidebar } from "./sidebar-context";
import { LogOut } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarUserFooter() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { collapsed } = useSidebar();

  if (!user) return null;

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border-t border-border p-3">
      <div
        className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
          {user.image ? (
            <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            initials
          )}
        </div>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.name ?? "User"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="ml-2 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create AppSidebar**

```tsx
// app-sidebar.tsx
"use client";

import Link from "next/link";
import {
  Home,
  FolderKanban,
  Search,
  FileCode,
  MessageSquare,
  FileText,
  PenLine,
  ShieldCheck,
  CreditCard,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebar } from "./sidebar-context";
import { SidebarNavItem } from "./sidebar-nav-item";
import { SidebarUserFooter } from "./sidebar-user-footer";

const mainNav = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
];

const toolsNav = [
  { href: "/tools/readiness", label: "Readiness Checker", icon: Search },
  { href: "/tools/schema", label: "Schema Validator", icon: FileCode },
  { href: "/tools/snippet", label: "Snippet Simulator", icon: MessageSquare },
  { href: "/tools/llms-txt", label: "llms.txt Generator", icon: FileText },
  { href: "/tools/meta", label: "Meta Optimizer", icon: PenLine },
  { href: "/tools/crawler-check", label: "Crawler Checker", icon: ShieldCheck },
];

const bottomNav = [
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const { collapsed, toggle } = useSidebar();

  return (
    <TooltipProvider>
      <aside
        className={`flex h-screen flex-col border-r border-border bg-background transition-[width] duration-200 ${
          collapsed ? "w-[60px]" : "w-[200px]"
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-primary"
          >
            <span className="text-lg font-bold">L</span>
            {!collapsed && (
              <span className="text-sm font-bold tracking-tight">LLM Rank</span>
            )}
          </Link>
          <button
            onClick={toggle}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <div className="space-y-0.5">
            {mainNav.map((item) => (
              <SidebarNavItem key={item.href} {...item} />
            ))}
          </div>

          {/* Tools section */}
          <div className="mt-4">
            {!collapsed && (
              <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Tools
              </p>
            )}
            <div className="space-y-0.5">
              {toolsNav.map((item) => (
                <SidebarNavItem key={item.href} {...item} />
              ))}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom nav */}
          <div className="space-y-0.5">
            {bottomNav.map((item) => (
              <SidebarNavItem key={item.href} {...item} />
            ))}
          </div>
        </nav>

        {/* User footer */}
        <SidebarUserFooter />
      </aside>
    </TooltipProvider>
  );
}
```

**Step 4: Create barrel export**

```tsx
// index.ts
export { AppSidebar } from "./app-sidebar";
export { SidebarProvider, useSidebar } from "./sidebar-context";
```

**Step 5: Commit**

```bash
git add apps/web/src/components/sidebar/
git commit -m "feat: add AppSidebar with nav items, user footer, collapse toggle"
```

---

### Task 3: Create TopBar with breadcrumbs

**Files:**

- Create: `apps/web/src/components/sidebar/top-bar.tsx`
- Create: `apps/web/src/components/sidebar/breadcrumb-nav.tsx`

**Step 1: Create BreadcrumbNav**

```tsx
// breadcrumb-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Home",
  projects: "Projects",
  settings: "Settings",
  billing: "Billing",
  team: "Team",
  admin: "Admin",
  history: "History",
  crawl: "Crawl",
  tools: "Tools",
  readiness: "Readiness Checker",
  schema: "Schema Validator",
  snippet: "Snippet Simulator",
  "llms-txt": "llms.txt Generator",
  meta: "Meta Optimizer",
  "crawler-check": "Crawler Checker",
  new: "New",
};

export function BreadcrumbNav() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const isUuid = /^[0-9a-f-]{36}$/.test(segment);
    const label = isUuid ? "..." : (ROUTE_LABELS[segment] ?? segment);
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {i === 0 ? <Home className="h-3.5 w-3.5" /> : crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
```

**Step 2: Create TopBar**

```tsx
// top-bar.tsx
"use client";

import { BreadcrumbNav } from "./breadcrumb-nav";

export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
      <BreadcrumbNav />
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/sidebar/top-bar.tsx apps/web/src/components/sidebar/breadcrumb-nav.tsx
git commit -m "feat: add TopBar with breadcrumb navigation"
```

---

### Task 4: Rewire dashboard layout

**Files:**

- Modify: `apps/web/src/app/dashboard/layout.tsx`
- Verify: All existing dashboard pages still render correctly

**Step 1: Update dashboard layout**

Replace the current layout with:

```tsx
// dashboard/layout.tsx
import { AppSidebar, SidebarProvider } from "@/components/sidebar";
import { TopBar } from "@/components/sidebar/top-bar";
import { ErrorBoundary } from "@/components/error-boundary";
import { OnboardingGuard } from "./onboarding-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="dashboard-main flex-1 overflow-y-auto">
            <ErrorBoundary>
              <OnboardingGuard>
                <div className="dashboard-shell">{children}</div>
              </OnboardingGuard>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
```

**Step 2: Extract onboarding guard from DashboardNav**

Create: `apps/web/src/app/dashboard/onboarding-guard.tsx`

```tsx
// onboarding-guard.tsx
"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const { data: me } = useApiSWR(
    "account-me",
    useCallback(() => api.account.getMe(), []),
  );

  const { data: projectList } = useApiSWR(
    "projects-guard",
    useCallback(() => api.projects.list({ limit: 1 }), []),
  );

  useEffect(() => {
    if (me && projectList) {
      if (!me.onboardingComplete && projectList.pagination.total === 0) {
        router.push("/onboarding");
      }
    }
  }, [me, projectList, router]);

  return <>{children}</>;
}
```

**Step 3: DO NOT delete `dashboard-nav.tsx` yet — keep it for reference until verified**

**Step 4: Run the app locally and verify**

Run: `cd apps/web && pnpm dev`
Verify:

- `/dashboard` — sidebar visible, breadcrumb shows "Home"
- `/dashboard/projects` — sidebar visible, "Projects" highlighted
- `/dashboard/projects/[id]` — both sidebars visible (global + project)
- `/dashboard/settings` — sidebar visible, "Settings" highlighted
- `/dashboard/billing` — sidebar visible, "Billing" highlighted
- Collapse/expand works, persists on refresh
- Mobile: sidebar hidden (will handle in Task 5)

**Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/layout.tsx apps/web/src/app/dashboard/onboarding-guard.tsx
git commit -m "feat: replace top nav with global sidebar + breadcrumb top bar"
```

---

### Task 5: Mobile sidebar (bottom tab bar + hamburger)

**Files:**

- Create: `apps/web/src/components/sidebar/mobile-tab-bar.tsx`
- Modify: `apps/web/src/components/sidebar/app-sidebar.tsx` — hide on mobile
- Modify: `apps/web/src/app/dashboard/layout.tsx` — add mobile tab bar

**Step 1: Create MobileTabBar**

```tsx
// mobile-tab-bar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderKanban, Wrench, CreditCard, User } from "lucide-react";
import { useState } from "react";

const tabs = [
  { href: "/dashboard", label: "Home", icon: Home, exact: true },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/tools/readiness", label: "Tools", icon: Wrench },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Account", icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-background md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] ${
              isActive ? "font-medium text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

**Step 2: Update AppSidebar — add `hidden md:flex` to the aside**

In `app-sidebar.tsx`, change the aside className to include `hidden md:flex`:

```tsx
<aside
  className={`hidden md:flex h-screen flex-col border-r border-border bg-background transition-[width] duration-200 ${
    collapsed ? "w-[60px]" : "w-[200px]"
  }`}
>
```

**Step 3: Update layout to include MobileTabBar**

Add `<MobileTabBar />` after the main content area, add `pb-14 md:pb-0` to main for bottom padding on mobile.

**Step 4: Commit**

```bash
git add apps/web/src/components/sidebar/mobile-tab-bar.tsx apps/web/src/components/sidebar/app-sidebar.tsx apps/web/src/app/dashboard/layout.tsx
git commit -m "feat: add mobile bottom tab bar, hide sidebar on small screens"
```

---

### Task 6: Keyboard shortcut (Cmd+B)

**Files:**

- Modify: `apps/web/src/components/sidebar/app-sidebar.tsx`

**Step 1: Add useEffect for keyboard shortcut**

Add inside `AppSidebar`:

```tsx
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      toggle();
    }
  }
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [toggle]);
```

**Step 2: Commit**

```bash
git add apps/web/src/components/sidebar/app-sidebar.tsx
git commit -m "feat: add Cmd+B keyboard shortcut for sidebar toggle"
```

---

### Task 7: Remove old DashboardNav

**Files:**

- Delete: `apps/web/src/app/dashboard/dashboard-nav.tsx`
- Verify: No other files import it

**Step 1: Search for imports**

Run: `grep -r "dashboard-nav" apps/web/src/`
Expected: Only the layout.tsx import (already replaced)

**Step 2: Delete the file**

```bash
rm apps/web/src/app/dashboard/dashboard-nav.tsx
```

**Step 3: Run typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old DashboardNav top bar"
```

---

## Phase 2: Free Tools

### Task 8: Tools layout + rate limit API endpoint

**Files:**

- Create: `apps/web/src/app/tools/layout.tsx`
- Create: `apps/api/src/routes/tools.ts`
- Modify: `apps/api/src/index.ts` — mount tools routes

**Step 1: Create tools layout**

```tsx
// apps/web/src/app/tools/layout.tsx
import Link from "next/link";

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Marketing nav */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-primary"
        >
          LLM Rank
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/tools/readiness"
            className="text-muted-foreground hover:text-foreground"
          >
            Tools
          </Link>
          <Link
            href="/pricing"
            className="text-muted-foreground hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            href="/sign-in"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Sign In
          </Link>
        </nav>
      </header>

      {/* Tool content */}
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">{children}</main>

      {/* Conversion banner */}
      <div className="border-t border-border bg-muted/30 px-4 py-8 text-center">
        <p className="text-lg font-medium">
          Want deeper analysis across your entire site?
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Score every page, track AI visibility, and get fix-by-fix
          recommendations.
        </p>
        <Link
          href="/sign-up"
          className="mt-4 inline-flex rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Start free &rarr;
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Create tools API routes with rate limiting**

```ts
// apps/api/src/routes/tools.ts
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { rateLimit } from "../middleware/rate-limit";

const app = new Hono<AppEnv>();

// Public rate limit: 1 per tool per day per IP (86400 seconds)
const toolRateLimit = (toolName: string) =>
  rateLimit({
    limit: 1,
    windowSeconds: 86400,
    keyPrefix: `tool:${toolName}`,
  });

// Check remaining uses for a tool
app.get("/check-limit/:tool", async (c) => {
  const tool = c.req.param("tool");
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for") ??
    "unknown";
  const kv = c.env.KV;
  const key = `tool:${tool}:${ip}`;
  const existing = await kv.get(key);
  return c.json({ remaining: existing ? 0 : 1 });
});

// Each tool endpoint applies its own rate limit
// (Individual tool endpoints added in subsequent tasks)

export default app;
```

**Step 3: Mount in API index**

In `apps/api/src/index.ts`, add:

```ts
import toolsRoutes from "./routes/tools";
// ...
app.route("/tools", toolsRoutes);
```

**Step 4: Commit**

```bash
git add apps/web/src/app/tools/layout.tsx apps/api/src/routes/tools.ts apps/api/src/index.ts
git commit -m "feat: add tools layout and rate-limited API routes"
```

---

### Task 9: Tool 1 — LLM Readiness Checker

**Files:**

- Create: `apps/web/src/app/tools/readiness/page.tsx`
- Modify: `apps/api/src/routes/tools.ts` — add `/readiness` endpoint

**Step 1: Add API endpoint**

In `apps/api/src/routes/tools.ts`, add:

```ts
import { scorePage } from "@llm-boost/scoring";

app.post("/readiness", toolRateLimit("readiness"), async (c) => {
  const { url } = await c.req.json<{ url: string }>();

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return c.json(
      { error: { code: "INVALID_URL", message: "Invalid URL" } },
      422,
    );
  }

  // Lightweight fetch of the page
  const response = await fetch(parsed.toString(), {
    headers: { "User-Agent": "LLMRank-Tool/1.0" },
    signal: AbortSignal.timeout(10000),
  });

  const html = await response.text();

  // Score using existing engine
  const result = scorePage({
    url: parsed.toString(),
    statusCode: response.status,
    html,
    headers: Object.fromEntries(response.headers.entries()),
  });

  return c.json({
    url: parsed.toString(),
    score: result.overall,
    grade: result.grade,
    categories: {
      technical: {
        score: result.technical.score,
        grade: result.technical.grade,
      },
      content: { score: result.content.score, grade: result.content.grade },
      aiReadiness: {
        score: result.aiReadiness.score,
        grade: result.aiReadiness.grade,
      },
      performance: {
        score: result.performance.score,
        grade: result.performance.grade,
      },
    },
    topIssues: result.issues.slice(0, 5).map((i) => ({
      code: i.code,
      title: i.title,
      severity: i.severity,
      category: i.category,
    })),
  });
});
```

**Step 2: Create the page**

```tsx
// apps/web/src/app/tools/readiness/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

// ... (full implementation with form, loading state, results display)
// Key sections: URL input form, score card with letter grade,
// category breakdown bars, top 5 issues list, CTA to sign up
```

Note: The page component will be ~150 lines. It includes:

- URL input with submit button
- Loading skeleton during analysis
- Score card: large letter grade, overall score, 4 category bars
- Top 5 issues with severity badges
- "Used your free check" state with sign-up CTA
- SEO metadata export (generateMetadata) with HowTo schema

**Step 3: Commit**

```bash
git add apps/web/src/app/tools/readiness/ apps/api/src/routes/tools.ts
git commit -m "feat: add LLM Readiness Checker tool (public, 1/day limit)"
```

---

### Task 10: Tool 2 — Schema Validator

**Files:**

- Create: `apps/web/src/app/tools/schema/page.tsx`
- Modify: `apps/api/src/routes/tools.ts` — add `/schema` endpoint

**API endpoint logic:**

1. Fetch URL HTML
2. Parse all `<script type="application/ld+json">` tags
3. Validate against common schema.org types (Organization, WebPage, Article, Product, FAQPage, HowTo, BreadcrumbList)
4. Check for missing recommended properties per type
5. Return: found schemas, missing recommended schemas, validation warnings

**Step 1: Add API endpoint, Step 2: Create page, Step 3: Commit**

Pattern identical to Task 9. Page displays: found schemas as JSON-LD previews, missing schema types as recommendations, validation warnings.

```bash
git commit -m "feat: add Schema Validator tool"
```

---

### Task 11: Tool 3 — AI Snippet Simulator

**Files:**

- Create: `apps/web/src/app/tools/snippet/page.tsx`
- Modify: `apps/api/src/routes/tools.ts` — add `/snippet` endpoint

**API endpoint logic:**

1. Accept query string + optional URL
2. Call LLM (Haiku for cost) with prompt: "Answer this query as an AI search engine would. If the URL content is relevant, cite it."
3. Return: simulated response, whether URL was mentioned, confidence score

**Step 1: Add API endpoint, Step 2: Create page, Step 3: Commit**

```bash
git commit -m "feat: add AI Snippet Simulator tool"
```

---

### Task 12: Tool 4 — llms.txt Generator

**Files:**

- Create: `apps/web/src/app/tools/llms-txt/page.tsx`

**No API needed — client-side only.**

Page has form fields:

- Site name, description, main URL
- Key pages (add/remove rows: label + URL)
- Contact email (optional)

Generates llms.txt in standard format. Copy-to-clipboard button.

Uses existing `LlmsTxtParser` from `@llm-boost/shared` for validation.

```bash
git commit -m "feat: add llms.txt Generator tool (client-side)"
```

---

### Task 13: Tool 5 — Meta Description Optimizer

**Files:**

- Create: `apps/web/src/app/tools/meta/page.tsx`
- Modify: `apps/api/src/routes/tools.ts` — add `/meta` endpoint

**API endpoint logic:**

1. Accept current meta description + target keyword
2. Call LLM with prompt to generate 3 optimized variants
3. Score each variant: character count, keyword presence/placement, uniqueness
4. Return 3 options with scores

```bash
git commit -m "feat: add Meta Description Optimizer tool"
```

---

### Task 14: Tool 6 — Crawler Blocked Checker

**Files:**

- Create: `apps/web/src/app/tools/crawler-check/page.tsx`
- Modify: `apps/api/src/routes/tools.ts` — add `/crawler-check` endpoint

**API endpoint logic:**

1. Fetch `{domain}/robots.txt`
2. Use existing `RobotsParser` from `@llm-boost/shared`
3. Check against known AI bot user agents: GPTBot, ChatGPT-User, Googlebot, Google-Extended, Bingbot, PerplexityBot, ClaudeBot, Anthropic-AI, cohere-ai, FacebookBot
4. Return: table of bot name → allowed/blocked/not specified

```bash
git commit -m "feat: add Crawler Blocked Checker tool"
```

---

### Task 15: Tools index page

**Files:**

- Create: `apps/web/src/app/tools/page.tsx`

A landing page listing all 6 tools with descriptions, icons, and links. SEO-optimized with structured data (ItemList schema).

```bash
git commit -m "feat: add tools index page with all 6 tools"
```

---

## Phase 3: Auth Redesign

### Task 16: Google One Tap component

**Files:**

- Create: `apps/web/src/components/auth/google-one-tap.tsx`

**Step 1: Create GoogleOneTap component**

```tsx
// google-one-tap.tsx
"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface GoogleOneTapProps {
  clientId: string;
  redirectTo?: string;
}

export function GoogleOneTap({
  clientId,
  redirectTo = "/dashboard",
}: GoogleOneTapProps) {
  const router = useRouter();
  const initialized = useRef(false);

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      // Send the Google ID token to our API for verification
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/sign-in/social`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "google",
            idToken: response.credential,
          }),
          credentials: "include",
        },
      );

      if (res.ok) {
        router.push(redirectTo);
      }
    },
    [redirectTo, router],
  );

  const initializeGsi = useCallback(() => {
    if (initialized.current || !window.google?.accounts) return;
    initialized.current = true;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: true,
      cancel_on_tap_outside: false,
    });

    // Render the button
    const buttonDiv = document.getElementById("google-signin-button");
    if (buttonDiv) {
      window.google.accounts.id.renderButton(buttonDiv, {
        type: "standard",
        shape: "pill",
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: 320,
      });
    }

    // Show One Tap prompt
    window.google.accounts.id.prompt();
  }, [clientId, handleCredentialResponse]);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initializeGsi}
      />
      <div id="google-signin-button" />
    </>
  );
}
```

**Step 2: Add Google types**

Create: `apps/web/src/types/google.d.ts`

```ts
interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
  prompt: (
    callback?: (notification: { isNotDisplayed: () => boolean }) => void,
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

export {};
```

**Step 3: Commit**

```bash
git add apps/web/src/components/auth/google-one-tap.tsx apps/web/src/types/google.d.ts
git commit -m "feat: add Google One Tap component with GIS SDK"
```

---

### Task 17: Redesign sign-in page

**Files:**

- Modify: `apps/web/src/components/auth/sign-in.tsx`
- Modify: `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`

**Step 1: Rebuild SignIn component**

Key changes:

- Google button is primary CTA (via GoogleOneTap component)
- Email/password is a collapsible secondary section ("Sign in with Email" expander)
- Use shadcn/ui Card, Input, Button, Label components
- Trust signals below the card
- Benefit-driven headline

**Step 2: Update sign-in page layout**

Key changes:

- Replace "Sign In" heading with "See how AI ranks your website"
- Update right panel with animated product showcase
- Add trust signals: "No credit card required", "Free plan available", "Secure & private"

**Step 3: Commit**

```bash
git add apps/web/src/components/auth/sign-in.tsx apps/web/src/app/sign-in/
git commit -m "feat: redesign sign-in page with Google-first auth"
```

---

### Task 18: Redesign sign-up page

**Files:**

- Modify: `apps/web/src/components/auth/sign-up.tsx`
- Modify: `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`

Same pattern as Task 17:

- Google button primary
- Email/password secondary (expandable)
- Headline: "Start optimizing for AI search — free"
- Keep existing password strength indicator in email flow
- Add trust signals

**Step 1: Rebuild, Step 2: Update page, Step 3: Commit**

```bash
git commit -m "feat: redesign sign-up page with Google-first auth"
```

---

### Task 19: Add Google One Tap to tool pages

**Files:**

- Modify: `apps/web/src/app/tools/layout.tsx`

After a user exhausts their 1 free use, show Google One Tap as a conversion trigger. Add the `GoogleOneTap` component to the tools layout, triggered conditionally when rate limit is hit.

```bash
git commit -m "feat: show Google One Tap on tool pages after free use"
```

---

## Phase 4: Verification

### Task 20: Full integration verification

**Step 1: Run typecheck**

```bash
pnpm typecheck
```

**Step 2: Run all tests**

```bash
pnpm test
```

**Step 3: Manual smoke test**

- [ ] Dashboard loads with sidebar
- [ ] Sidebar collapse/expand works + persists
- [ ] Cmd+B toggles sidebar
- [ ] Breadcrumbs update correctly per route
- [ ] Project page shows both sidebars (global + project)
- [ ] Mobile shows bottom tab bar, no sidebar
- [ ] All 6 tool pages load at `/tools/*`
- [ ] Tool rate limit works (1/day)
- [ ] Sign-in shows Google-first
- [ ] Sign-up shows Google-first
- [ ] Google One Tap popup appears
- [ ] Email fallback works on both pages
- [ ] No regressions in existing dashboard functionality

**Step 4: Commit any fixes**

**Step 5: Final commit**

```bash
git commit -m "chore: verify full integration of sidebar, tools, and auth redesign"
```
