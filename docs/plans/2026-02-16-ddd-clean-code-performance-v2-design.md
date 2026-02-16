# DDD, Clean Code & Performance — V2 Design Document

**Date:** 2026-02-16
**Approach:** Outside-In (Frontend → API → Domain), incremental refactoring
**Constraint:** Every PR is independently shippable. No big-bang rewrites.

## Problem Statement

Codebase analysis across all packages revealed three categories of technical debt:

1. **Frontend:** Duplicated scoring/formatting logic in 3+ components, manual SWR cache invalidation, 11+ state variables in onboarding, business logic (error mapping, polling, persona generation) embedded in UI components, tabs re-fetching data the parent already loaded.

2. **API:** Service instantiation repeated per-handler across 30 route files, inconsistent ownership checks (middleware vs. helpers), ingest-service (300+ lines) doing 7+ responsibilities, no request/response DTOs (DB schema changes break API consumers).

3. **Domain:** Anemic models (plain interfaces, no methods), `Plan` is a raw string not a value object, `CrawlStatus` transitions unchecked, issue codes are untyped strings with hardcoded deduction amounts, no aggregate roots to enforce invariants.

4. **Performance:** Tab components re-fetch parent data, no LLM optimizer caching, no query timing visibility, no response compression, hardcoded models across LLM package.

---

## Phase 1: Frontend Cleanup

### 1.1 — Extract Duplicated Logic into Shared Utilities

**Files to create:**

- `apps/web/src/lib/format.ts` — `formatRelativeTime()`, `formatDate()`, `formatNumber()`
- `apps/web/src/lib/status.ts` — `getStatusBadgeVariant()`, `getStatusLabel()`, `getCrawlStatusColor()`
- `apps/web/src/lib/error-messages.ts` — `ERROR_MESSAGES: Record<string, string>` map for all API error codes

**Files to clean up:**

- `components/score-circle.tsx` — remove local `getLetterGrade()`, import from `@llm-boost/shared`
- `app/dashboard/page.tsx` — remove inline `formatRelativeTime()` and `getStatusBadgeVariant()`
- `app/dashboard/projects/[id]/page.tsx` — remove inline error code → message mapping

### 1.2 — Centralize Data Fetching with Domain Hooks

**Files to create in `apps/web/src/hooks/`:**

- `use-project.ts` — `useProject(id)`, `useProjects()`, `useCreateProject()`, `useUpdateProject()`
- `use-crawl.ts` — `useCrawl(id)`, `useCrawlHistory(projectId)`, `useCrawlPolling(id)` with exponential backoff
- `use-dashboard.ts` — `useDashboardStats()`, `useRecentActivity()`
- `use-strategy.ts` — `useCompetitors(projectId)`, `useAddCompetitor()`, `usePersonas(projectId)`

Each hook:

- Owns its SWR key (no manual key generation in components)
- Handles mutation + automatic cache invalidation
- Exposes `isLoading`, `error`, `data` consistently

### 1.3 — Move Business Logic Out of Components

- **Onboarding:** Extract `useOnboardingWizard()` reducer hook — manages step state, polling, form validation. Page becomes presentational.
- **Strategy tab:** Use `use-strategy.ts` hooks. Remove manual `mutateComps()` calls.
- **Error mapping:** Use centralized `error-messages.ts` via a `useApiError()` hook or utility.

### 1.4 — Performance Quick Wins (Frontend)

- Remove duplicate data fetches in tab components (overview-tab re-fetching insights)
- Add `React.memo` to chart components (`score-radar-chart`, `issue-distribution-chart`, etc.)
- Add global `ErrorBoundary` wrapping dashboard layout
- Verify all heavy tabs use `dynamic()` imports with loading skeletons

---

## Phase 2: API Service Refactoring

### 2.1 — Request-Scoped Dependency Container

**File to create:** `apps/api/src/container.ts`

```
createContainer(db: Database) → {
  projects: ProjectRepository,
  users: UserRepository,
  crawls: CrawlRepository,
  ...
  projectService: ProjectService,
  crawlService: CrawlService,
  ...
}
```

Middleware creates once per request, sets on Hono context. Routes destructure from `c.get("services")`.

### 2.2 — Standardize Ownership via Middleware

**File to create:** `apps/api/src/middleware/ownership.ts`

Factory middleware: `withOwnership("project")` extracts `params.id`, verifies `project.userId === ctx.userId`, attaches resource to context. Applied at route level. Remove all `assertProjectOwnership()` calls from services.

### 2.3 — Break Apart Ingest Service

Split `ingest-service.ts` (300+ lines, 7+ responsibilities) into:

- `ingest-service.ts` — batch parsing, page insertion, orchestration
- `scoring-service.ts` — internal scoring + LLM scoring coordination
- `enrichment-service.ts` — integration-driven page enrichments
- `recommendation-service.ts` — recommendations, regression detection, summary generation

### 2.4 — Add Request/Response DTOs

**Directory:** `apps/api/src/dto/`

Per-domain mapper files:

- `project.dto.ts` — `toProjectResponse(entity)`, `toProjectListResponse(entities)`
- `crawl.dto.ts` — `toCrawlResponse(entity)`, `toCrawlProgressResponse(entity)`
- `page.dto.ts` — `toPageResponse(entity)`, `toPageDetailResponse(entity)`

Routes call DTO mappers before `c.json()`. DB schema changes no longer break API consumers.

### 2.5 — Performance Quick Wins (API)

- Add `compress()` middleware from `hono/compress`
- Add query timing wrapper in repository layer (log queries >100ms)
- Audit N+1 patterns in crawl history / page listing
- Verify KV caching on dashboard stats endpoint

---

## Phase 3: Domain Layer Extraction

### 3.1 — Value Objects in `packages/shared/src/domain/`

- `plan.ts` — `Plan` class: `getMaxProjects()`, `getMaxPages()`, `canAccess(feature)`, `meetsMinimumTier(required)`. Replaces scattered `getLimits()` + conditionals.
- `crawl-status.ts` — `CrawlStatus` class: `canTransitionTo(next)`, `isTerminal()`, `isActive()`. Prevents invalid state transitions.
- `score.ts` — `Score` value object: `letterGrade()`, `color()`, `isPassingGrade()`. Single implementation.
- `branded-ids.ts` — `ProjectId`, `UserId`, `CrawlId` branded types. Prevents accidental ID swaps.

### 3.2 — Aggregate Roots in `packages/shared/src/domain/`

- `project-aggregate.ts` — `Project.canStartCrawl(plan)`, `Project.canAddPage(count, plan)`, `Project.isOwnedBy(userId)`
- `crawl-aggregate.ts` — `CrawlJob.transition(newStatus)`, `CrawlJob.isExpired()`, `CrawlJob.canIngest()`

Plain TypeScript classes, no ORM dependency. Services construct from DB entities, call domain methods, persist.

### 3.3 — Incremental Service Migration

One service per PR:

1. `project-service.ts` → uses `Project` aggregate + `Plan` value object
2. `crawl-service.ts` → uses `CrawlJob` aggregate with `transition()`
3. `ingest-service.ts` → validates crawl state via aggregate before processing

### 3.4 — Type-Safe Issue Codes

- `IssueCode` branded type derived from `ISSUE_DEFINITIONS` keys
- Update `deduct()` signature: `deduct(state, IssueCode.MISSING_TITLE, { data })` — deduction amount derived from definition, not passed in
- Compile-time safety: typos in issue codes become type errors

### 3.5 — Performance Quick Wins (Infra)

- Add caching to `StrategyOptimizer` methods (project+hash key, KV backed)
- Centralize model selection in `packages/llm/src/llm-config.ts`
- Extract duplicated `stripFences()` into `packages/llm/src/utils.ts`
- Add Drizzle query logging for slow queries (>100ms)
- Remove unused `@llm-boost/shared` dep from `packages/db/package.json`

---

## Migration Order (Incremental PRs)

Each numbered item is one shippable PR:

**Phase 1 (Frontend):**

1. Extract `format.ts`, `status.ts`, `error-messages.ts` + clean up importers
2. Create `hooks/use-project.ts` + `hooks/use-crawl.ts`, migrate dashboard + project pages
3. Create `hooks/use-dashboard.ts` + `hooks/use-strategy.ts`, migrate remaining pages
4. Extract `useOnboardingWizard` reducer, simplify onboarding page
5. Frontend perf: remove duplicate fetches, add React.memo, global ErrorBoundary

**Phase 2 (API):** 6. Create `container.ts`, add middleware, migrate 5 busiest route files 7. Create ownership middleware, remove `assertProjectOwnership` from services 8. Split ingest-service into 4 focused services 9. Add DTO layer for project, crawl, page endpoints 10. API perf: compress middleware, query timing, N+1 audit

**Phase 3 (Domain):** 11. Create `Plan` + `Score` value objects, migrate `plan-enforcer.ts` 12. Create `CrawlStatus` value object + branded IDs 13. Create `Project` + `CrawlJob` aggregates 14. Migrate services to use aggregates (project-service, crawl-service, ingest-service) 15. Type-safe issue codes + update `deduct()` signature 16. LLM perf: optimizer caching, centralized model config, `stripFences` extraction
