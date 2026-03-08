# Performance Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all identified performance bottlenecks across API, database, scoring engine, and frontend.

**Architecture:** Backend-first approach — fix DB indexes and query patterns first (immediate production impact), then API layer, then frontend. Each task is independent and can be parallelized.

**Tech Stack:** Drizzle ORM (PostgreSQL), Hono Workers API, Next.js App Router, React

---

### Task 1: Add Missing Database Indexes

**Files:**

- Modify: `packages/db/src/schema/crawling.ts:53-57` (crawlJobs indexes)
- Modify: `packages/db/src/schema/crawling.ts:119-122` (pageScores indexes)
- Modify: `packages/db/src/schema/crawling.ts:143-146` (issues indexes)
- Modify: `packages/db/src/schema/features.ts:61` (visibilityChecks indexes)

**Changes:**

1. `crawl_jobs`: Add composite index `(projectId, status, createdAt DESC)` for latest-crawl-per-project queries
2. `page_scores`: Add composite index `(jobId, overallScore)` for portfolio sort
3. `issues`: Add composite index `(jobId, code)` for issue code filtering
4. `visibility_checks`: Add index `(projectId, brandMentioned)` for source opportunities query

---

### Task 2: Fix N+1 in Visibility Service — Batch countSince

**Files:**

- Modify: `packages/db/src/queries/visibility.ts` — add `countSinceByProjects()` batch method
- Modify: `apps/api/src/services/visibility-service.ts:47-52` — use batch method

**Changes:**
Replace sequential loop with single aggregate query using `GROUP BY project_id`.

---

### Task 3: Replace listByUser with countByUser in Plan Limits

**Files:**

- Modify: `apps/api/src/middleware/planLimits.ts:48-49`

**Changes:**
Use existing `countByUser()` instead of `listByUser()` to avoid fetching all project rows.

---

### Task 4: Fix getSourceOpportunities — SQL Aggregation

**Files:**

- Modify: `packages/db/src/queries/visibility.ts:121-168`

**Changes:**
Replace in-memory aggregation with SQL query using JSONB extraction + GROUP BY.

---

### Task 5: Scoring Engine — Remove Redundant Weight Normalization

**Files:**

- Modify: `packages/scoring/src/engine.ts:51` — already pre-computed at line 14, no fix needed (it's correct!)
- Modify: `packages/scoring/src/engine-v2.ts:122` — already pre-computed at line 57, no fix needed

Note: Both engines already pre-compute WEIGHTS at module level and only re-normalize when customWeights are passed. This was a false positive from the analysis.

---

### Task 6: Increase Discovered Links Batch Size

**Files:**

- Modify: `packages/db/src/queries/discovered-links.ts:37`

**Changes:**
Increase chunk size from 100 to 500 and parallelize chunks.

---

### Task 7: Frontend — Extract Dashboard Layout Client Components

**Files:**

- Modify: `apps/web/src/app/dashboard/layout.tsx`

**Changes:**
Split into server layout + client nav component to avoid cascading "use client".

---
