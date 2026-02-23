# Onboarding Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the minimal name/phone onboarding page with a 3-step guided wizard that gets new users to their first crawl result ASAP.

**Architecture:** Single client-side wizard component at `/onboarding` with step state managed in React. Steps: Welcome+Profile → Add Website → Crawl Progress. Adds `onboardingComplete` boolean column to users table. Dashboard layout redirects to `/onboarding` if user has no projects and `onboardingComplete` is false.

**Tech Stack:** Next.js (App Router), React state, existing `api` client (`apps/web/src/lib/api.ts`), existing `ScoreCircle` component, Drizzle ORM for schema changes, Tailwind CSS.

---

### Task 1: Add `onboardingComplete` column to users table

**Files:**

- Modify: `packages/db/src/schema.ts` (users table, ~line 155)
- Modify: `packages/db/src/queries/users.ts` (updateProfile, ~line 46)
- Modify: `packages/shared/src/schemas/api.ts` (UpdateProfileSchema, ~line 30)

**Context:** The `users` table is in `packages/db/src/schema.ts` at line 131. It uses `pgTable` with Drizzle ORM. The `updateProfile` query at `packages/db/src/queries/users.ts:46` currently accepts `{ name?, phone? }`. The `UpdateProfileSchema` at `packages/shared/src/schemas/api.ts:30` currently requires phone with strict E.164 validation.

**What to do:**

1. Add `onboardingComplete` boolean column to `users` table in schema.ts, after `isAdmin` (line 151):

```ts
onboardingComplete: boolean("onboarding_complete").notNull().default(false),
```

2. Update `updateProfile` in `packages/db/src/queries/users.ts` to accept `onboardingComplete`:

```ts
async updateProfile(id: string, data: { name?: string; phone?: string; onboardingComplete?: boolean }) {
```

3. Update `UpdateProfileSchema` in `packages/shared/src/schemas/api.ts` to make `phone` fully optional and add `company` (optional string, stored in name for now) and `onboardingComplete`:

```ts
export const UpdateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .transform((p) => p.replace(/[\s\-().]/g, ""))
    .pipe(z.string().regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format"))
    .optional(),
  onboardingComplete: z.boolean().optional(),
});
```

4. Generate the migration:

```bash
cd packages/db && npx drizzle-kit generate
```

5. Run typecheck:

```bash
pnpm typecheck
```

6. Run tests (the UpdateProfileSchema tests in `packages/shared/src/__tests__/schemas.test.ts` should still pass since phone was already optional):

```bash
pnpm test
```

7. Commit:

```bash
git add packages/db/src/schema.ts packages/db/src/queries/users.ts packages/shared/src/schemas/api.ts packages/db/migrations/
git commit -m "feat(db): add onboardingComplete column to users table"
```

---

### Task 2: Add `updateProfile` method to API client and update account route

**Files:**

- Modify: `apps/web/src/lib/api.ts` (account namespace, ~line 1408)
- Modify: `apps/api/src/routes/account.ts` (PUT route, ~line 31)

**Context:** The frontend API client is at `apps/web/src/lib/api.ts`. The `account` namespace starts at line 1408. It has `getMe()` but no `updateProfile()`. The API route at `apps/api/src/routes/account.ts:31` already handles `PUT /api/account` with `UpdateProfileSchema`.

**What to do:**

1. Add `updateProfile` method to the `account` namespace in `apps/web/src/lib/api.ts` after `getMe()`:

```ts
async updateProfile(data: { name?: string; phone?: string; onboardingComplete?: boolean }): Promise<void> {
  await apiClient.put("/api/account", data);
},
```

2. The `PUT /api/account` route already uses `UpdateProfileSchema.safeParse(body)` and passes to `userQueries(db).updateProfile(userId, parsed.data)` — since we updated both the schema and the query in Task 1, no changes needed to the route handler.

3. Run typecheck:

```bash
pnpm typecheck
```

4. Commit:

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add updateProfile to API client account namespace"
```

---

### Task 3: Build the Stepper UI component

**Files:**

- Create: `apps/web/src/components/onboarding/stepper.tsx`

**Context:** This is a simple horizontal 3-dot stepper showing which step the user is on. Used at the top of the onboarding wizard. Uses Tailwind CSS and Lucide icons. The project uses `cn()` from `@/lib/utils` for className merging.

**What to do:**

Create `apps/web/src/components/onboarding/stepper.tsx`:

```tsx
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Profile" },
  { label: "Website" },
  { label: "Scanning" },
];

export function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;
        return (
          <div key={step.label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8 sm:w-12",
                  isCompleted ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isActive &&
                    "border-2 border-primary bg-primary/10 text-primary",
                  !isCompleted &&
                    !isActive &&
                    "border border-border text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

Run typecheck:

```bash
pnpm typecheck
```

Commit:

```bash
git add apps/web/src/components/onboarding/stepper.tsx
git commit -m "feat(web): add Stepper component for onboarding wizard"
```

---

### Task 4: Build the onboarding wizard page

**Files:**

- Modify: `apps/web/src/app/onboarding/page.tsx` (replace entire file)

**Context:** The current onboarding page is at `apps/web/src/app/onboarding/page.tsx` — it's a simple name+phone form that redirects to `/dashboard`. We're replacing it with a 3-step wizard.

The wizard needs:

- `useAuth()` from `@/lib/auth-hooks` for auth check
- `api` from `@/lib/api` for API calls (projects.create, crawls.start, crawls.get, account.updateProfile)
- `Stepper` from `@/components/onboarding/stepper`
- `ScoreCircle` from `@/components/score-circle`
- `isActiveCrawlStatus` from `@/components/crawl-progress`
- Standard UI components (Button, Input, Label, Card)

**What to do:**

Replace `apps/web/src/app/onboarding/page.tsx` with a wizard that has 3 steps:

**Step 1 — Welcome + Profile:**

- State: `name` (string), `error` (string | null)
- Headline: "Welcome to LLM Rank"
- Subtext: "Let's get your first AI-readiness score in under 2 minutes."
- Field: Name (required)
- "Continue" button validates name is non-empty, advances to step 2 (no API call)

**Step 2 — Add Your Website:**

- State: `domain` (string), `projectName` (string)
- `projectName` auto-fills from domain hostname when user types domain
- Headline: "What site should we audit?"
- Fields: Domain (required), Project Name (auto-filled, editable)
- "Start Scan" button:
  1. Calls `api.account.updateProfile({ name, onboardingComplete: true })`
  2. Calls `api.projects.create({ name: projectName, domain })`
  3. Stores the returned project ID and advances to step 3
- Error handling: show inline error, stay on step 2

**Step 3 — Crawl Progress:**

- On mount: calls `api.crawls.start(projectId)` to get crawl ID
- Polls `api.crawls.get(crawlId)` every 3s with exponential backoff (cap 30s)
- Shows: animated progress indicator, pages found/crawled/scored counters
- Rotating tips array cycling every 5s
- On complete: shows ScoreCircle with overall score + letter grade + 4 category bars
- "View Full Report" button → `router.push(/dashboard/crawl/${crawlId})`
- On failure: error message + "Try Again" button that re-dispatches crawl

**Guard logic (top of component):**

- If not signed in → redirect to `/sign-in`
- If already has projects (check via `api.projects.list()`) → redirect to `/dashboard`

The full component will be ~300 lines. Key imports:

```tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-hooks";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper } from "@/components/onboarding/stepper";
import { ScoreCircle } from "@/components/score-circle";
import {
  isActiveCrawlStatus,
  type CrawlStatus,
} from "@/components/crawl-progress";
import { cn, scoreColor } from "@/lib/utils";
import { Loader2, ArrowRight, Globe, RotateCcw } from "lucide-react";
```

Tips array for step 3:

```ts
const TIPS = [
  "73% of AI citations come from pages with structured data.",
  "Pages with clear H1-H3 hierarchy rank 2x better in AI responses.",
  "Sites with llms.txt get 40% more AI crawler visits.",
  "Content over 1,500 words is 3x more likely to be cited by AI.",
  "Schema markup helps AI understand your content structure.",
];
```

Run typecheck:

```bash
pnpm typecheck
```

Commit:

```bash
git add apps/web/src/app/onboarding/page.tsx
git commit -m "feat(web): replace onboarding page with 3-step guided wizard"
```

---

### Task 5: Add dashboard redirect guard

**Files:**

- Modify: `apps/web/src/app/dashboard/layout.tsx`

**Context:** The dashboard layout is at `apps/web/src/app/dashboard/layout.tsx`. We need to add a check: if the user has no projects and `onboardingComplete` is false, redirect them to `/onboarding`. This ensures first-time users go through the wizard.

**What to do:**

Read the current `apps/web/src/app/dashboard/layout.tsx` to understand its structure. Then add a client-side hook or effect that:

1. Fetches the user's project list (check if `api.projects.list()` returns 0 results)
2. Fetches the user's account info (check `onboardingComplete`)
3. If no projects AND not onboardingComplete → `router.push("/onboarding")`
4. Otherwise, render the dashboard normally

This should be a lightweight check that runs once on mount. Use `useEffect` with `api.account.getMe()` — we need to update `getMe()` to return `onboardingComplete` in the response type.

Update the `getMe` return type in `apps/web/src/lib/api.ts`:

```ts
async getMe(): Promise<{ isAdmin: boolean; plan: string; email: string; onboardingComplete: boolean }> {
```

The guard logic should not block rendering — show the dashboard loading state while checking, then redirect if needed.

Run typecheck:

```bash
pnpm typecheck
```

Commit:

```bash
git add apps/web/src/app/dashboard/layout.tsx apps/web/src/lib/api.ts
git commit -m "feat(web): add onboarding redirect guard to dashboard layout"
```

---

### Task 6: End-to-end verification

**What to do:**

1. Run full typecheck:

```bash
pnpm typecheck
```

2. Run full test suite:

```bash
pnpm test
```

3. Fix any test failures caused by the `UpdateProfileSchema` change (the existing tests at `packages/shared/src/__tests__/schemas.test.ts:195-208` test phone validation — these should still pass since phone is optional, but verify).

4. Verify the guard logic doesn't break existing dashboard access for users who already have projects.

5. Commit any fixes:

```bash
git commit -m "fix: resolve test failures from onboarding changes"
```
