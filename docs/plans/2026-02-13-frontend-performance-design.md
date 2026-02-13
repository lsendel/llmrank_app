# Frontend Performance Improvements — Design

## Goal

Dramatically improve perceived and actual performance of the Next.js dashboard without a full server component rewrite. Target: sub-1s navigation, cached data, lazy-loaded heavy dependencies.

## Approach

Client-side quick wins (Approach A) — SWR caching, dynamic imports, loading skeletons, component splitting, polling backoff, and bundle optimization.

## Changes

### 1. SWR for Data Fetching + Caching

- Add `swr` dependency
- Create `useApiSWR(key, fetcher)` hook wrapping Clerk token injection
- Replace `useEffect` → `fetch` → `useState` pattern in all dashboard pages
- Gains: request dedup, stale-while-revalidate, automatic cache on back-nav

### 2. Dynamic Imports for Recharts

- `next/dynamic` for ShareOfVoiceChart, PlatformReadinessMatrix, scan results charts
- Saves ~200KB from initial bundle on most pages

### 3. Loading Skeletons

- Add `loading.tsx` to every dashboard route (dashboard, projects, project detail, crawl detail, settings)
- Skeleton cards/tables matching page layout for instant perceived load

### 4. Split Project Page (937 lines → 5 tab components)

- Extract each tab into its own component file
- Dynamically import tabs, fetch data only when tab is active
- Reduces initial JS and API calls

### 5. Crawl Polling with Backoff

- Replace fixed 3s setInterval with SWR `refreshInterval` + exponential backoff
- Sequence: 3s → 5s → 10s → 15s → 30s cap

### 6. Dashboard Layout Caching

- Remove `cache: "no-store"` from onboarding check
- Cache onboarding status for session duration

### 7. Bundle Analysis

- Add `@next/bundle-analyzer`
- Verify Lucide tree-shaking (named imports only)

## Success Criteria

- Dashboard TTI < 1s on repeat visits (SWR cache hit)
- Project page initial JS < 300KB (down from ~500KB+)
- No "Loading..." flash on back navigation
- Crawl page network usage drops ~80% during long polls
