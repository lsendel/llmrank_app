# System Audit & Auth Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove Clerk, switch to cookie-based Better Auth, re-enable auth guards, verify every page and the crawl-to-report pipeline work end-to-end.

**Architecture:** Better Auth (already implemented in API) manages sessions via cookies. The web frontend switches from Bearer token threading to `credentials: 'include'` on all API calls. A Next.js middleware protects `/dashboard/*` routes. The mock-clerk compatibility layer is deleted.

**Tech Stack:** Better Auth, Hono (API), Next.js (web), Drizzle ORM, Neon PostgreSQL

---

### Task 1: Create Clean Auth Hooks Module

**Files:**

- Create: `apps/web/src/lib/auth-hooks.tsx`

**Step 1: Create the auth hooks module**

This replaces `mock-clerk.tsx` with a clean, self-documenting module. No Clerk naming.

```tsx
"use client";

import React, { type ReactNode } from "react";
import { useSession, signOut as betterSignOut } from "./auth-client";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAuth() {
  const { data: session, isPending } = useSession();
  return {
    userId: session?.user?.id ?? null,
    isLoaded: !isPending,
    isSignedIn: !!session?.user,
    signOut: async () => {
      await betterSignOut();
      window.location.href = "/sign-in";
    },
  };
}

export function useUser() {
  const { data: session, isPending } = useSession();
  const user = session?.user;
  return {
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          image:
            user.image ??
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        }
      : null,
    isLoaded: !isPending,
    isSignedIn: !!user,
  };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function SignedIn({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  return session?.user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  return !session?.user ? <>{children}</> : null;
}

export function UserButton() {
  const { user } = useUser();
  const router = useRouter();

  if (!user) return null;

  return (
    <div
      className="flex items-center gap-2 cursor-pointer"
      onClick={async () => {
        await betterSignOut();
        router.push("/sign-in");
      }}
    >
      <img
        src={user.image}
        alt={user.name ?? "User"}
        className="h-8 w-8 rounded-full border"
      />
    </div>
  );
}
```

**Step 2: Verify the module compiles**

No test needed — this is a straightforward extraction from mock-clerk.tsx with renamed exports.

---

### Task 2: Simplify API Client (Cookie-Based)

**Files:**

- Modify: `apps/web/src/lib/api.ts` — remove `token` parameter from all methods, add `credentials: 'include'`

**Step 1: Update the `request()` helper**

In `apps/web/src/lib/api.ts`, change the `request` function and `RequestOptions`:

Replace the `RequestOptions` interface and `request` function (lines 590-630):

```ts
interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers: extraHeaders, ...init } = options;

  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? "UNKNOWN_ERROR",
      errorBody?.error?.message ?? response.statusText,
      errorBody?.error?.details,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
```

**Step 2: Remove `token` from all API methods**

Remove the `token: string` first parameter from every method in the `api` object. There are ~50 methods. Each follows the same pattern:

Before:

```ts
async getStats(token: string): Promise<DashboardStats> {
  const res = await apiClient.get<ApiEnvelope<DashboardStats>>(
    "/api/dashboard/stats",
    { token },
  );
  return res.data;
},
```

After:

```ts
async getStats(): Promise<DashboardStats> {
  const res = await apiClient.get<ApiEnvelope<DashboardStats>>(
    "/api/dashboard/stats",
  );
  return res.data;
},
```

Apply this to ALL methods in `api.dashboard`, `api.projects`, `api.crawls`, `api.pages`, `api.issues`, `api.billing`, `api.admin`, `api.scores`, `api.visibility`, `api.strategy`, `api.account`, `api.quickWins`, `api.platformReadiness`, `api.logs`, `api.integrations`, `api.share`.

The `apiClient.get/post/put/delete` methods also need `token` removed from `RequestOptions` (it was used to set Authorization header — no longer needed).

**Step 3: Update `apiClient` helper methods**

Remove `token` from the options spreading (since it was used to set the `Authorization` header):

```ts
const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "GET" });
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "POST", body });
  },
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "PUT", body });
  },
  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};
```

These don't change structurally — just removing `token` from `RequestOptions` interface is enough.

---

### Task 3: Simplify useApi and useApiSWR Hooks

**Files:**

- Modify: `apps/web/src/lib/use-api.ts`
- Modify: `apps/web/src/lib/use-api-swr.ts`

**Step 1: Rewrite `use-api.ts`**

Replace entire file:

```ts
"use client";

import { useAuth } from "@/lib/auth-hooks";
import { useCallback } from "react";
import { useRouter } from "next/navigation";

export function useApi() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const withAuth = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (error: any) {
        if (error?.status === 401) {
          router.push("/sign-in");
        }
        throw error;
      }
    },
    [router],
  );

  return { withAuth, isSignedIn };
}
```

**Step 2: Rewrite `use-api-swr.ts`**

Replace entire file:

```ts
"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { useRouter } from "next/navigation";

/**
 * SWR wrapper for cookie-authenticated API calls.
 * Cookies are sent automatically via credentials: 'include'.
 */
export function useApiSWR<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  config?: SWRConfiguration<T>,
) {
  const router = useRouter();

  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
    onError(error: any) {
      if (error?.status === 401) {
        router.push("/sign-in");
      }
    },
    ...config,
  });
}
```

---

### Task 4: Update All Dashboard Pages (Token Removal)

**Files to modify** — all files that import `useApi` or `useApiSWR`. The change pattern is identical for each:

**Pattern for `useApiSWR` consumers:**

Before:

```ts
const { data } = useApiSWR(
  "projects",
  useCallback((token: string) => api.projects.list(token), []),
);
```

After:

```ts
const { data } = useApiSWR(
  "projects",
  useCallback(() => api.projects.list(), []),
);
```

**Pattern for `useApi` consumers (mutations):**

Before:

```ts
const { withToken } = useApi();
await withToken((token) => api.projects.create(token, data));
```

After:

```ts
const { withAuth } = useApi();
await withAuth(() => api.projects.create(data));
```

**Files to update (complete list):**

1. `apps/web/src/app/dashboard/page.tsx` — also change `useUser` import from `@clerk/nextjs` to `@/lib/auth-hooks`
2. `apps/web/src/app/dashboard/settings/page.tsx` — change `useClerk` import to `useAuth` from `@/lib/auth-hooks`
3. `apps/web/src/app/dashboard/projects/page.tsx`
4. `apps/web/src/app/dashboard/projects/new/page.tsx`
5. `apps/web/src/app/dashboard/projects/[id]/page.tsx`
6. `apps/web/src/app/dashboard/projects/[id]/pages/page.tsx`
7. `apps/web/src/app/dashboard/projects/[id]/pages/[pageId]/page.tsx`
8. `apps/web/src/app/dashboard/projects/[id]/issues/page.tsx`
9. `apps/web/src/app/dashboard/projects/[id]/logs/page.tsx`
10. `apps/web/src/app/dashboard/crawl/[id]/page.tsx`
11. `apps/web/src/app/dashboard/admin/page.tsx`
12. `apps/web/src/components/charts/crawler-timeline-chart.tsx`
13. `apps/web/src/components/charts/issue-heatmap.tsx`
14. `apps/web/src/components/tabs/overview-tab.tsx`
15. `apps/web/src/components/tabs/strategy-tab.tsx`
16. `apps/web/src/components/tabs/visibility-tab.tsx`
17. `apps/web/src/components/tabs/integrations-tab.tsx`
18. `apps/web/src/components/visibility/competitor-comparison.tsx`
19. `apps/web/src/components/share-of-voice-chart.tsx`
20. `apps/web/src/components/forms/branding-settings-form.tsx`
21. `apps/web/src/components/platform-readiness-matrix.tsx`
22. `apps/web/src/components/quick-wins-card.tsx`
23. `apps/web/src/app/integrations/callback/google/page.tsx`

For each file:

1. Remove `(token: string) =>` from `useApiSWR` callbacks
2. Change `withToken((token) => api.xxx(token, ...))` to `withAuth(() => api.xxx(...))`
3. Remove `token` parameter from direct `api.xxx()` calls
4. Update imports if file imports from `@clerk/nextjs`

---

### Task 5: Update Layout, Homepage, and Static Pages

**Files:**

- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/pricing/page.tsx`
- Modify: `apps/web/src/app/dashboard/layout.tsx`

**Step 1: Update root layout**

Replace `MockClerkProvider` with plain children:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LLM Rank - AI-Readiness SEO Platform",
  description:
    "Optimize your website for AI search engines. Audit, score, and improve your content for LLM visibility.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
```

**Step 2: Update homepage**

Change import from `@clerk/nextjs` to `@/lib/auth-hooks`:

```tsx
import { SignedIn, SignedOut } from "@/lib/auth-hooks";
```

**Step 3: Update pricing page**

Same import change:

```tsx
import { SignedIn, SignedOut } from "@/lib/auth-hooks";
```

**Step 4: Update dashboard layout**

Replace mock-clerk import, re-enable auth guard:

```tsx
import Link from "next/link";
import { cookies } from "next/headers";
import { UserButton } from "@/lib/auth-hooks";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  ShieldCheck,
} from "lucide-react";

const sidebarLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/admin", label: "Admin", icon: ShieldCheck },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check is handled by middleware.ts
  // If we reach here, the user is authenticated

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-sidebar-border bg-sidebar-background md:block">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Link
            href="/dashboard"
            className="text-lg font-bold tracking-tight text-primary"
          >
            LLM Rank
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {sidebarLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-4 md:hidden">
            <span className="text-lg font-bold tracking-tight text-primary">
              LLM Rank
            </span>
          </div>
          <div className="ml-auto">
            <UserButton />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

---

### Task 6: Update Onboarding Page

**Files:**

- Modify: `apps/web/src/app/onboarding/page.tsx`

**Step 1: Switch from Clerk imports to auth-hooks and cookie-based API calls**

Replace `useAuth` import and update the fetch call:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) {
    router.push("/sign-in");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }

    setSubmitting(true);
    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
      const res = await fetch(`${apiBase}/api/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Something went wrong");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ... rest of JSX unchanged
```

---

### Task 7: Add Next.js Middleware for Route Protection

**Files:**

- Create: `apps/web/src/middleware.ts`

**Step 1: Create the middleware**

Better Auth stores session in a cookie. We can check for its presence (the cookie is named `better-auth.session_token` by default). The middleware does a lightweight check — the API will do the real validation.

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/onboarding"];
const AUTH_ROUTES = ["/sign-in", "/sign-up"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Better Auth session cookie
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");
  const hasSession = !!sessionCookie?.value;

  // Redirect unauthenticated users away from protected routes
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  if (isProtected && !hasSession) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
  ],
};
```

---

### Task 8: Remove Clerk & Cleanup

**Files:**

- Modify: `apps/web/package.json` — remove `@clerk/nextjs`
- Modify: `apps/web/tsconfig.json` — remove path aliases
- Delete: `apps/web/src/lib/mock-clerk.tsx`
- Delete: `apps/web/src/lib/mock-clerk-server.ts`
- Modify: `apps/api/src/index.ts` — remove `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` from Bindings (optional, can leave as dead code)
- Modify: `apps/api/src/middleware/auth.ts` — remove dead Clerk JWT verification code (lines 10-163)

**Step 1: Remove `@clerk/nextjs` from package.json**

In `apps/web/package.json`, remove the line:

```
"@clerk/nextjs": "^6",
```

**Step 2: Remove tsconfig path aliases**

In `apps/web/tsconfig.json`, remove these lines from `paths`:

```json
"@clerk/nextjs": ["./src/lib/mock-clerk"],
"@clerk/nextjs/server": ["./src/lib/mock-clerk-server"]
```

Final `paths` should be:

```json
"paths": {
  "@/*": ["./src/*"]
}
```

**Step 3: Delete mock-clerk files**

```bash
rm apps/web/src/lib/mock-clerk.tsx apps/web/src/lib/mock-clerk-server.ts
```

**Step 4: Clean up auth middleware**

In `apps/api/src/middleware/auth.ts`, remove the dead Clerk JWT types and functions (lines 10-163: JWK/JWKS/JWTHeader/JWTPayload interfaces, base64UrlDecode, decodeJwtPart, fetchJWKS, getSigningKey, verifyJWT). Keep only the `authMiddleware` export (lines 170-209).

**Step 5: Run `pnpm install`**

```bash
cd /Users/lsendel/Projects/LLMRank_app && pnpm install
```

---

### Task 9: Update CORS for Production

**Files:**

- Modify: `apps/api/src/index.ts` — update CORS origin to include production domain
- Modify: `apps/api/src/lib/auth.ts` — update trustedOrigins

**Step 1: Update CORS config**

The CORS config at `apps/api/src/index.ts:82-96` already has `credentials: true`. Update `origin` to use env var:

```ts
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow localhost in development, production domain in prod
      const allowed = [
        "http://localhost:3000",
        "https://llmboost.com",
        "https://www.llmboost.com",
      ];
      return allowed.includes(origin) ? origin : null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Signature",
      "X-Timestamp",
    ],
    maxAge: 86400,
  }),
);
```

**Step 2: Update Better Auth trustedOrigins**

In `apps/api/src/lib/auth.ts`, update:

```ts
trustedOrigins: ["http://localhost:3000", "https://llmboost.com", "https://www.llmboost.com"],
```

---

### Task 10: TypeScript & Build Verification

**Step 1: Run typecheck**

```bash
cd /Users/lsendel/Projects/LLMRank_app && pnpm typecheck
```

Fix any type errors. Common issues:

- Missing `token` arguments in API calls (means a consumer file was missed)
- Import resolution errors for deleted mock-clerk files

**Step 2: Run tests**

```bash
cd /Users/lsendel/Projects/LLMRank_app && pnpm test
```

Fix any test failures. API tests should still pass since auth middleware interface hasn't changed.

**Step 3: Run build**

```bash
cd /Users/lsendel/Projects/LLMRank_app && pnpm build
```

Fix any build errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: replace Clerk with Better Auth cookie-based sessions

- Remove @clerk/nextjs dependency and tsconfig path aliases
- Create clean auth-hooks.tsx module (useAuth, useUser, SignedIn, SignedOut, UserButton)
- Switch all API calls to credentials: 'include' (cookie-based auth)
- Remove token threading from api.ts (~50 methods) and all consumers
- Simplify useApi and useApiSWR hooks (no more token injection)
- Add Next.js middleware for route protection
- Re-enable dashboard auth guards
- Delete mock-clerk.tsx and mock-clerk-server.ts
- Clean up dead Clerk JWT verification code from API middleware"
```

---

### Task 11: Manual End-to-End Verification

Start both services and walk through each flow:

**Step 1: Start services**

```bash
# Terminal 1: API
cd apps/api && npx wrangler dev

# Terminal 2: Web
cd apps/web && pnpm dev
```

**Step 2: Verify each flow**

| #   | Flow                   | URL                                            | Expected                                |
| --- | ---------------------- | ---------------------------------------------- | --------------------------------------- |
| 1   | Landing page           | `http://localhost:3000`                        | Shows "Sign in" / "Get Started" buttons |
| 2   | Sign up                | `http://localhost:3000/sign-up`                | Form renders, can create account        |
| 3   | Redirect after sign up | —                                              | Redirected to `/dashboard`              |
| 4   | Sign out               | Click avatar                                   | Redirected to `/sign-in`                |
| 5   | Auth redirect          | `http://localhost:3000/dashboard` (logged out) | Redirected to `/sign-in`                |
| 6   | Sign in                | `http://localhost:3000/sign-in`                | Email/password form works               |
| 7   | Dashboard              | `http://localhost:3000/dashboard`              | Stats load (or show empty state)        |
| 8   | New project            | `http://localhost:3000/dashboard/projects/new` | Form submits, project created           |
| 9   | Project list           | `http://localhost:3000/dashboard/projects`     | Shows created project                   |
| 10  | Project detail         | Click project                                  | Shows detail with no crawl yet          |
| 11  | Pricing                | `http://localhost:3000/pricing`                | Shows plans, auth-aware CTA             |
| 12  | Public scan            | `http://localhost:3000/scan`                   | Can enter URL, no auth needed           |
| 13  | Settings               | `http://localhost:3000/dashboard/settings`     | Billing info renders                    |
| 14  | Admin                  | `http://localhost:3000/dashboard/admin`        | Stats load (if user is admin)           |

**Step 3: Check browser Network tab**

Verify that API calls:

- Include the `better-auth.session_token` cookie (visible in request headers)
- Do NOT include `Authorization: Bearer` header
- Return 200/201 responses (not 401)

---

### Task 12: Final Cleanup

**Step 1: Remove Clerk bindings from wrangler.toml (if present)**

Check `apps/api/wrangler.toml` for any `CLERK_SECRET_KEY` or `CLERK_PUBLISHABLE_KEY` entries and remove them.

**Step 2: Optionally remove from Bindings type**

In `apps/api/src/index.ts`, remove `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` from the `Bindings` type if nothing references them.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: remove Clerk bindings and final cleanup"
```
