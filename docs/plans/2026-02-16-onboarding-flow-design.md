# Onboarding Flow Design

## Goal

Replace the current minimal name/phone onboarding page with a 3-step guided wizard that gets new users to their first AI-readiness crawl result as fast as possible.

## Architecture

A single client-side wizard component at `/onboarding` with 3 steps managed via React state. No URL changes between steps. Replaces the existing `/onboarding/page.tsx`.

## Steps

### Step 1 — Welcome + Profile

- Headline: "Welcome to LLM Rank"
- Subtext: "Let's get your first AI-readiness score in under 2 minutes."
- Fields: Name (required), Company (optional)
- Step indicator: 1 of 3
- "Continue" button (client-side advance only, no API call yet)

### Step 2 — Add Your Website

- Headline: "What site should we audit?"
- Fields: Project name (auto-filled from domain hostname), Domain (required)
- On "Start Scan" click:
  1. `PUT /api/account` with `{ name, company }`
  2. `POST /api/projects` with `{ name, domain }`
- Advances to step 3 on success

### Step 3 — Crawl Progress

- Auto-triggers `POST /api/crawls` with `{ projectId }` on mount
- Polls `GET /api/crawls/:id` every 3s with exponential backoff (cap 30s)
- Live progress: circular indicator + pages found/crawled/scored counters
- Rotating tips while waiting
- On completion: score preview card (letter grade + overall + 4 category bars)
- "View Full Report" button → `/dashboard/crawl/[id]`
- On failure: error message + "Try Again" button

## Data Flow

```
Step 1 (client only) → Step 2 (PUT account + POST project) → Step 3 (POST crawl + poll GET crawl/:id) → redirect to /dashboard/crawl/[id]
```

On completion, sets `onboardingComplete` flag on user record via the account update.

## UI Design

- Centered card layout (max-w-lg), no dashboard chrome, `bg-secondary` background
- Horizontal 3-dot stepper: filled = active, checkmark = completed, outline = upcoming
- Labels: "Profile", "Website", "Scanning"
- CSS fade/slide transitions between steps
- Step 3 reuses `ScoreCircle` for progress visualization
- Completion state: grade + score + 4 category mini-bars
- Fully responsive (card full-width on mobile, stepper icons-only)

## Guard Logic

- `/onboarding` with no auth → redirect `/sign-in`
- `/onboarding` with existing projects → redirect `/dashboard`
- `/dashboard` with no projects + no onboardingComplete → redirect `/onboarding`
- Browser refresh during step 3 → check for active crawl, resume polling

## Error Handling

- Account update failure → inline error on step 2
- Project creation failure (duplicate domain, plan limit) → inline error on step 2
- Crawl dispatch failure → error on step 3 with "Try Again"
- Network errors → generic retry message

## Edge Cases

- User closes tab during crawl → crawl continues server-side, dashboard shows result on next visit
- No skip button — flow is lightweight enough
- Form state lost on hard refresh (steps 1-2) — acceptable, user re-enters
