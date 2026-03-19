# Pipeline Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract pipeline services and their dependencies from `apps/api` into three new workspace packages (`@llm-boost/parsers`, `@llm-boost/repositories`, `@llm-boost/pipeline`), plus move logger and ServiceError into `@llm-boost/shared`, eliminating all cross-app source imports.

**Architecture:** Three new packages form a dependency chain: `parsers` (zero deps) → `repositories` (depends on `db`) → `pipeline` (depends on all). The API and report-service import from packages instead of relative paths. `handleServiceError` stays in the API as `src/lib/error-handler.ts`.

**Tech Stack:** TypeScript, pnpm workspaces, Drizzle ORM, Hono, tsup

**Spec:** `docs/superpowers/specs/2026-03-19-pipeline-decoupling-design.md`

---

## File Structure

### New files to create

```
packages/parsers/
  package.json
  tsconfig.json
  src/
    html-parser.ts      ← moved from apps/api/src/lib/html-parser.ts
    sitemap.ts          ← moved from apps/api/src/lib/sitemap.ts
    index.ts            ← re-exports

packages/repositories/
  package.json
  tsconfig.json
  src/
    index.ts            ← moved from apps/api/src/repositories/index.ts (all interfaces + factories)

packages/pipeline/
  package.json
  tsconfig.json
  src/
    auto-site-description.ts
    auto-persona.ts
    auto-keyword.ts
    auto-competitor.ts
    auto-visibility.ts
    content-optimization.ts
    recommendations.ts
    health-check.ts
    competitor-benchmark.ts
    visibility.ts
    index.ts            ← re-exports all pipeline step functions

packages/shared/src/
    logger.ts           ← moved from apps/api/src/lib/logger.ts
    errors.ts           ← ServiceError class only (new file)

apps/api/src/lib/
    error-handler.ts    ← handleServiceError extracted from services/errors.ts
```

### Files to delete (after moves complete)

```
apps/api/src/lib/html-parser.ts
apps/api/src/lib/sitemap.ts
apps/api/src/lib/logger.ts
apps/api/src/repositories/index.ts
apps/api/src/services/errors.ts
apps/api/src/services/auto-site-description-service.ts
apps/api/src/services/auto-persona-service.ts
apps/api/src/services/auto-keyword-service.ts
apps/api/src/services/auto-competitor-service.ts
apps/api/src/services/auto-visibility-service.ts
apps/api/src/services/content-optimization-service.ts
apps/api/src/services/recommendations-service.ts
apps/api/src/services/health-check-service.ts
apps/api/src/services/competitor-benchmark-service.ts
apps/api/src/services/visibility-service.ts
```

### Files to modify (import rewrites)

**Logger imports (~10 non-pipeline API files):**
- `apps/api/src/index.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/scheduled.ts`
- `apps/api/src/scheduled/index.ts`
- `apps/api/src/services/auto-narrative-service.ts`
- `apps/api/src/services/auto-report-service.ts`
- `apps/api/src/services/digest-service.ts`
- `apps/api/src/services/llm-scoring.ts`
- `apps/api/src/services/monitoring-service.ts`
- `apps/api/src/services/notification-service.ts`
- `apps/api/src/services/outbox-processor.ts`

**Repository imports (~48 non-pipeline API files):**
- `apps/api/src/container.ts`
- `apps/api/src/scheduled.ts`
- `apps/api/src/scheduled/index.ts`
- All route files (~22): `admin.ts`, `billing.ts`, `brand-performance.ts`, `ingest.ts`, `insights.ts`, `logs.ts`, `narratives.ts`, `pages.ts`, `prompt-research.ts`, `report-upload.ts`, `reports.ts`, `scores.ts`, `strategy.ts`, `trends.ts`, `v1.ts`, `visibility.ts`, `visibility/keywords.ts`, `visibility/recommendations.ts`, `visibility/score.ts`, `competitors.ts`, `dashboard.ts`, `pipeline.ts`
- Non-pipeline service files (~18): `admin-service.ts`, `api-token-service.ts`, `auto-narrative-service.ts`, `auto-report-service.ts`, `billing-service.ts`, `crawl-service.ts`, `ingest-service.ts`, `insight-capture-service.ts`, `insights-service.ts`, `integration-insights-service.ts`, `intelligence-service.ts`, `log-service.ts`, `narrative-service.ts`, `page-scoring-service.ts`, `page-service.ts`, `post-processing-service.ts`, `progress-service.ts`, `project-service.ts`, `report-service.ts`, `shared/assert-ownership.ts`, `strategy-service.ts`
- Test files (~15): `__tests__/helpers/factories.ts`, `__tests__/helpers/mock-repositories.ts`, `__tests__/routes/report-upload.test.ts`, `__tests__/services/*.test.ts`

**ServiceError imports (~39 files):**
- `apps/api/src/index.ts`
- `apps/api/src/middleware/ownership.ts`
- All route files (~32): every route file
- Test files (~5): `__tests__/helpers/test-app.ts`, integration tests

**Pipeline service imports (~7 API route files + 2 scheduled files):**
- `apps/api/src/routes/competitors.ts` → `createCompetitorBenchmarkService`
- `apps/api/src/routes/dashboard.ts` → `createRecommendationsService`
- `apps/api/src/routes/pipeline.ts` → `runHealthCheck`, `createRecommendationsService`
- `apps/api/src/routes/prompt-research.ts` → `createVisibilityService`
- `apps/api/src/routes/v1.ts` → `createVisibilityService`
- `apps/api/src/routes/visibility.ts` → `createVisibilityService`
- `apps/api/src/routes/visibility/score.ts` → `createVisibilityService`
- `apps/api/src/scheduled.ts` → `createVisibilityService`
- `apps/api/src/scheduled/index.ts` → `createVisibilityService`

**Parser imports (2 non-pipeline API files):**
- `apps/api/src/routes/public.ts` → `parseHtml`, `analyzeSitemap`
- Test: `apps/api/src/__tests__/lib/html-parser.test.ts`
- Test: `apps/api/src/__tests__/lib/sitemap.test.ts`

**Report service:**
- `apps/report-service/src/pipeline-steps.ts`
- `apps/report-service/tsup.config.ts`
- `apps/report-service/Dockerfile`
- `apps/report-service/package.json`

---

## Task Execution Order

Tasks are ordered for minimal breakage — each task produces a typecheckable codebase.

---

### Task 1: Create `@llm-boost/parsers` package

**Files:**
- Create: `packages/parsers/package.json`
- Create: `packages/parsers/tsconfig.json`
- Create: `packages/parsers/src/html-parser.ts`
- Create: `packages/parsers/src/sitemap.ts`
- Create: `packages/parsers/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@llm-boost/parsers",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Note: If `tsconfig.base.json` doesn't exist at root, use a standalone config:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Copy html-parser.ts from apps/api/src/lib/html-parser.ts**

Copy the file verbatim to `packages/parsers/src/html-parser.ts`. No import changes needed — this file has zero dependencies.

- [ ] **Step 4: Copy sitemap.ts from apps/api/src/lib/sitemap.ts**

Copy the file verbatim to `packages/parsers/src/sitemap.ts`. No import changes needed — this file has zero dependencies.

- [ ] **Step 5: Create index.ts**

```typescript
export { parseHtml, type ParsedPage } from "./html-parser";
export { analyzeSitemap, parseSitemapXml, type SitemapAnalysis } from "./sitemap";
```

- [ ] **Step 6: Run pnpm install to register workspace package**

Run: `pnpm install`

- [ ] **Step 7: Verify**

Run: `cd packages/parsers && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```
git add packages/parsers/
git commit -m "feat: create @llm-boost/parsers package"
```

---

### Task 2: Move logger and ServiceError into `@llm-boost/shared`

**Files:**
- Create: `packages/shared/src/logger.ts`
- Create: `packages/shared/src/errors.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Copy logger.ts to packages/shared/src/logger.ts**

Copy `apps/api/src/lib/logger.ts` verbatim to `packages/shared/src/logger.ts`. Zero deps, no changes needed.

- [ ] **Step 2: Create packages/shared/src/errors.ts with ServiceError only**

```typescript
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
```

- [ ] **Step 3: Add re-exports to packages/shared/src/index.ts**

Append to the end of `packages/shared/src/index.ts`:

```typescript
export { createLogger, type Logger } from "./logger";
export { ServiceError } from "./errors";
```

- [ ] **Step 4: Verify**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```
git add packages/shared/src/logger.ts packages/shared/src/errors.ts packages/shared/src/index.ts
git commit -m "feat: add logger and ServiceError to @llm-boost/shared"
```

---

### Task 3: Create `@llm-boost/repositories` package

**Files:**
- Create: `packages/repositories/package.json`
- Create: `packages/repositories/tsconfig.json`
- Create: `packages/repositories/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@llm-boost/repositories",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@llm-boost/db": "workspace:*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Use the same approach as Task 1 Step 2 (extend base or standalone).

- [ ] **Step 3: Copy repositories/index.ts to packages/repositories/src/index.ts**

Copy `apps/api/src/repositories/index.ts` verbatim. Its imports are already package-relative (`@llm-boost/db`), so no changes needed.

- [ ] **Step 4: Run pnpm install**

Run: `pnpm install`

- [ ] **Step 5: Verify**

Run: `cd packages/repositories && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```
git add packages/repositories/
git commit -m "feat: create @llm-boost/repositories package"
```

---

### Task 4: Create `@llm-boost/pipeline` package

**Files:**
- Create: `packages/pipeline/package.json`
- Create: `packages/pipeline/tsconfig.json`
- Create: `packages/pipeline/src/auto-site-description.ts`
- Create: `packages/pipeline/src/auto-persona.ts`
- Create: `packages/pipeline/src/auto-keyword.ts`
- Create: `packages/pipeline/src/auto-competitor.ts`
- Create: `packages/pipeline/src/auto-visibility.ts`
- Create: `packages/pipeline/src/content-optimization.ts`
- Create: `packages/pipeline/src/recommendations.ts`
- Create: `packages/pipeline/src/health-check.ts`
- Create: `packages/pipeline/src/competitor-benchmark.ts`
- Create: `packages/pipeline/src/visibility.ts`
- Create: `packages/pipeline/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@llm-boost/pipeline",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@llm-boost/db": "workspace:*",
    "@llm-boost/shared": "workspace:*",
    "@llm-boost/scoring": "workspace:*",
    "@llm-boost/llm": "workspace:*",
    "@llm-boost/parsers": "workspace:*",
    "@llm-boost/repositories": "workspace:*",
    "@anthropic-ai/sdk": "^0.39.0",
    "openai": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Use the same approach as Task 1 Step 2.

- [ ] **Step 3: Copy and rewrite all 10 service files**

For each file, copy from `apps/api/src/services/` to `packages/pipeline/src/` (dropping the `-service` suffix). Rewrite imports:

| Old import | New import |
|---|---|
| `from "../lib/logger"` | `from "@llm-boost/shared"` (import `createLogger`) |
| `from "../lib/html-parser"` | `from "@llm-boost/parsers"` |
| `from "../lib/sitemap"` | `from "@llm-boost/parsers"` |
| `from "../repositories"` | `from "@llm-boost/repositories"` |
| `from "./errors"` | `from "@llm-boost/shared"` (import `ServiceError`) |
| `from "./competitor-benchmark-service"` | `from "./competitor-benchmark"` |
| `from "./visibility-service"` | `from "./visibility"` |

Detailed per-file import rewrites:

**auto-site-description.ts:** Change `import { createLogger } from "../lib/logger"` → `import { createLogger } from "@llm-boost/shared"`

**auto-persona.ts:** Change `import { createLogger } from "../lib/logger"` → `import { createLogger } from "@llm-boost/shared"`

**auto-keyword.ts:** Change `import { createLogger } from "../lib/logger"` → `import { createLogger } from "@llm-boost/shared"`

**auto-competitor.ts:**
- `import { createCompetitorBenchmarkService } from "./competitor-benchmark-service"` → `from "./competitor-benchmark"`
- `import { createCompetitorRepository } from "../repositories"` → `from "@llm-boost/repositories"`
- `import { createLogger } from "../lib/logger"` → `from "@llm-boost/shared"`

**auto-visibility.ts:**
- `import { createVisibilityService } from "./visibility-service"` → `from "./visibility"`
- `import { createProjectRepository, createUserRepository, createVisibilityRepository, createCompetitorRepository } from "../repositories"` → `from "@llm-boost/repositories"`
- `import { createLogger } from "../lib/logger"` → `from "@llm-boost/shared"`

**competitor-benchmark.ts:**
- `import { ServiceError } from "./errors"` → `from "@llm-boost/shared"`
- `import { parseHtml } from "../lib/html-parser"` → `from "@llm-boost/parsers"`
- `import { analyzeSitemap } from "../lib/sitemap"` → `from "@llm-boost/parsers"`

**visibility.ts:**
- `import type { ProjectRepository, UserRepository, VisibilityRepository, CompetitorRepository } from "../repositories"` → `from "@llm-boost/repositories"`
- `import { ServiceError } from "./errors"` → `from "@llm-boost/shared"`

**content-optimization.ts:** No relative import changes needed (only uses `@llm-boost/db` and `@anthropic-ai/sdk`).

**recommendations.ts:** No relative import changes needed (only uses `@llm-boost/db`).

**health-check.ts:** No relative import changes needed (only uses `@llm-boost/db`).

- [ ] **Step 4: Create index.ts**

```typescript
export {
  runAutoSiteDescription,
  type AutoSiteDescriptionInput,
} from "./auto-site-description";
export {
  runAutoPersonaGeneration,
  type AutoPersonaInput,
} from "./auto-persona";
export {
  runAutoKeywordGeneration,
  type AutoKeywordInput,
} from "./auto-keyword";
export {
  runAutoCompetitorDiscovery,
  type AutoCompetitorInput,
} from "./auto-competitor";
export {
  runAutoVisibilityChecks,
  type AutoVisibilityInput,
} from "./auto-visibility";
export {
  runContentOptimization,
  type ContentOptimizationInput,
  type ContentOptimizationResult,
} from "./content-optimization";
export {
  generateRecommendations,
  createRecommendationsService,
  type Recommendation,
  type NextAction,
  type PortfolioPriorityItem,
} from "./recommendations";
export {
  runHealthCheck,
  type HealthCheckInput,
  type HealthCheckResult,
} from "./health-check";
export { createCompetitorBenchmarkService } from "./competitor-benchmark";
export {
  createVisibilityService,
  type VisibilityServiceDeps,
} from "./visibility";
```

- [ ] **Step 5: Run pnpm install**

Run: `pnpm install`

- [ ] **Step 6: Verify**

Run: `cd packages/pipeline && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```
git add packages/pipeline/
git commit -m "feat: create @llm-boost/pipeline package"
```

---

### Task 5: Create error-handler.ts in API and rewrite errors.ts

**Files:**
- Create: `apps/api/src/lib/error-handler.ts`
- Delete: `apps/api/src/services/errors.ts`

- [ ] **Step 1: Create apps/api/src/lib/error-handler.ts**

```typescript
import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import type { AppEnv } from "../index";
import { ServiceError } from "@llm-boost/shared";

export function handleServiceError(c: Context<AppEnv>, error: unknown) {
  if (error instanceof ServiceError) {
    c.status(error.status as StatusCode);
    return c.json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  c.status(500);
  return c.json({
    error: {
      code: "INTERNAL_ERROR",
      message,
    },
  });
}
```

- [ ] **Step 2: Rewrite errors.ts as a compatibility shim**

Replace `apps/api/src/services/errors.ts` with re-exports so existing imports keep working until Task 7 rewrites them:

```typescript
// Compatibility shim — will be deleted after Task 7 rewrites all imports
export { ServiceError } from "@llm-boost/shared";
export { handleServiceError } from "../lib/error-handler";
```

- [ ] **Step 3: Commit**

```
git add apps/api/src/lib/error-handler.ts apps/api/src/services/errors.ts
git commit -m "refactor: extract handleServiceError to lib/error-handler.ts"
```

---

### Task 6: Add new packages to apps/api dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Add workspace dependencies**

Add to `apps/api/package.json` `dependencies`:

```json
"@llm-boost/parsers": "workspace:*",
"@llm-boost/pipeline": "workspace:*",
"@llm-boost/repositories": "workspace:*"
```

- [ ] **Step 2: Run pnpm install**

Run: `pnpm install`

- [ ] **Step 3: Commit**

```
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore: add pipeline/parsers/repositories deps to API"
```

---

### Task 7: Rewrite all API imports — ServiceError

This is the largest batch (~39 files). Every file that imports `ServiceError` from `../services/errors` or `../../services/errors` needs two changes:
1. `ServiceError` → import from `@llm-boost/shared`
2. `handleServiceError` → import from the new `../lib/error-handler` (relative path varies)

**Files:** ~39 files across routes, services, middleware, tests

- [ ] **Step 1: Rewrite all route files**

For each route file in `apps/api/src/routes/`:

Replace:
```typescript
import { ServiceError, handleServiceError } from "../services/errors";
```
With:
```typescript
import { ServiceError } from "@llm-boost/shared";
import { handleServiceError } from "../lib/error-handler";
```

Files that only import `ServiceError` (no `handleServiceError`):
```typescript
// Before
import { ServiceError } from "../services/errors";
// After
import { ServiceError } from "@llm-boost/shared";
```

Files that only import `handleServiceError`:
```typescript
// Before
import { handleServiceError } from "../services/errors";
// After
import { handleServiceError } from "../lib/error-handler";
```

Note: For `routes/visibility/*.ts` files, the relative path to error-handler is `../../lib/error-handler`.

- [ ] **Step 2: Rewrite middleware and core files**

`apps/api/src/index.ts`:
```typescript
// Before
import { handleServiceError } from "./services/errors";
// After
import { handleServiceError } from "./lib/error-handler";
```

`apps/api/src/middleware/ownership.ts`:
```typescript
// Before
import { ServiceError } from "../services/errors";
// After
import { ServiceError } from "@llm-boost/shared";
```

- [ ] **Step 3: Rewrite non-pipeline service files**

For services that import `ServiceError` from `./errors`:
```typescript
// Before
import { ServiceError } from "./errors";
// After
import { ServiceError } from "@llm-boost/shared";
```

Affected service files: `admin-service.ts`, `api-token-service.ts`, `auto-narrative-service.ts`, `auto-report-service.ts`, `billing-service.ts`, `crawl-service.ts`, `ingest-service.ts`, `insight-capture-service.ts`, `insights-service.ts`, `integration-insights-service.ts`, `intelligence-service.ts`, `log-service.ts`, `narrative-service.ts`, `page-scoring-service.ts`, `page-service.ts`, `post-processing-service.ts`, `progress-service.ts`, `project-service.ts`, `report-service.ts`, `shared/assert-ownership.ts`, `strategy-service.ts`

- [ ] **Step 4: Rewrite test files**

`apps/api/src/__tests__/helpers/test-app.ts`:
```typescript
// Before
import { ServiceError } from "../../services/errors";
// After
import { ServiceError } from "@llm-boost/shared";
```

Integration test files (`__tests__/integration/*.test.ts`):
```typescript
// Before
import { ServiceError } from "../../services/errors";
// After
import { ServiceError } from "@llm-boost/shared";
```

Route test files (`__tests__/routes/*.test.ts`):
```typescript
// Before
import { ServiceError } from "../../services/errors";
// After
import { ServiceError } from "@llm-boost/shared";
```

- [ ] **Step 5: Delete the compatibility shim**

Now that all imports are rewritten, delete the shim:

Run: `rm apps/api/src/services/errors.ts`

- [ ] **Step 6: Verify**

Run: `cd apps/api && npx tsc --noEmit`
Expected: errors only for files still referencing deleted logger/repos/pipeline paths (handled in next tasks)

- [ ] **Step 7: Commit**

```
git add -A apps/api/src/
git commit -m "refactor: rewrite ServiceError imports to @llm-boost/shared"
```

---

### Task 8: Rewrite all API imports — Logger

**Files:** ~10 non-pipeline service files + middleware + scheduled

- [ ] **Step 1: Rewrite all logger imports**

For each file, replace:
```typescript
import { createLogger } from "../lib/logger";
// or
import { createLogger } from "./lib/logger";
```
With:
```typescript
import { createLogger } from "@llm-boost/shared";
```

Files to update:
- `apps/api/src/index.ts` — `from "./lib/logger"` → `from "@llm-boost/shared"`
- `apps/api/src/middleware/auth.ts` — `from "../lib/logger"` → `from "@llm-boost/shared"`
- `apps/api/src/scheduled.ts` — `from "./lib/logger"` or `from "../lib/logger"` → `from "@llm-boost/shared"`
- `apps/api/src/scheduled/index.ts` — `from "../lib/logger"` → `from "@llm-boost/shared"`
- `apps/api/src/services/auto-narrative-service.ts`
- `apps/api/src/services/auto-report-service.ts`
- `apps/api/src/services/digest-service.ts`
- `apps/api/src/services/llm-scoring.ts`
- `apps/api/src/services/monitoring-service.ts`
- `apps/api/src/services/notification-service.ts`
- `apps/api/src/services/outbox-processor.ts`

- [ ] **Step 2: Delete the old logger file**

Run: `rm apps/api/src/lib/logger.ts`

- [ ] **Step 3: Commit**

```
git add -A apps/api/src/
git commit -m "refactor: rewrite logger imports to @llm-boost/shared"
```

---

### Task 9: Rewrite all API imports — Repositories

**Files:** ~48 files (routes, services, container, scheduled, tests)

- [ ] **Step 1: Rewrite all repository imports**

For each file, replace:
```typescript
import { createProjectRepository, ... } from "../repositories";
// or
import { createProjectRepository, ... } from "../../repositories";
// or
import { createProjectRepository, ... } from "./repositories";
```
With:
```typescript
import { createProjectRepository, ... } from "@llm-boost/repositories";
```

Keep the exact same named imports — only change the path.

Key files and their current import paths:
- `apps/api/src/container.ts` — `from "./repositories"`
- `apps/api/src/scheduled.ts` — check exact path
- `apps/api/src/scheduled/index.ts` — check exact path
- All route files — `from "../repositories"`
- All service files — `from "../repositories"`
- Test helpers — `from "../../repositories"`

- [ ] **Step 2: Delete the old repositories file**

Run: `rm apps/api/src/repositories/index.ts && rmdir apps/api/src/repositories`

- [ ] **Step 3: Commit**

```
git add -A apps/api/src/
git commit -m "refactor: rewrite repository imports to @llm-boost/repositories"
```

---

### Task 10: Rewrite API imports — Pipeline services + Parsers

**Files:** ~9 route/scheduled files importing pipeline services, ~2 files importing parsers

- [ ] **Step 1: Rewrite pipeline service imports**

```typescript
// routes/competitors.ts
// Before
import { createCompetitorBenchmarkService } from "../services/competitor-benchmark-service";
// After
import { createCompetitorBenchmarkService } from "@llm-boost/pipeline";

// routes/dashboard.ts
// Before
import { createRecommendationsService } from "../services/recommendations-service";
// After
import { createRecommendationsService } from "@llm-boost/pipeline";

// routes/pipeline.ts
// Before
import { runHealthCheck } from "../services/health-check-service";
import { createRecommendationsService } from "../services/recommendations-service";
// After
import { runHealthCheck, createRecommendationsService } from "@llm-boost/pipeline";

// routes/prompt-research.ts
// Before
import { createVisibilityService } from "../services/visibility-service";
// After
import { createVisibilityService } from "@llm-boost/pipeline";

// routes/v1.ts
// Before
import { createVisibilityService } from "../services/visibility-service";
// After
import { createVisibilityService } from "@llm-boost/pipeline";

// routes/visibility.ts
// Before
import { createVisibilityService } from "../services/visibility-service";
// After
import { createVisibilityService } from "@llm-boost/pipeline";

// routes/visibility/score.ts
// Before
import { createVisibilityService } from "../../services/visibility-service";
// After
import { createVisibilityService } from "@llm-boost/pipeline";

// scheduled.ts + scheduled/index.ts
// Before
import { createVisibilityService } from "./services/visibility-service";
// or
import { createVisibilityService } from "../services/visibility-service";
// After
import { createVisibilityService } from "@llm-boost/pipeline";
```

Also fix the **dynamic import** in `apps/api/src/scheduled/index.ts` (~line 269):
```typescript
// Before
const { createCompetitorBenchmarkService } =
    await import("../services/competitor-benchmark-service");
// After
const { createCompetitorBenchmarkService } =
    await import("@llm-boost/pipeline");
```

- [ ] **Step 2: Rewrite parser imports**

```typescript
// routes/public.ts
// Before
import { parseHtml } from "../lib/html-parser";
import { analyzeSitemap } from "../lib/sitemap";
// After
import { parseHtml } from "@llm-boost/parsers";
import { analyzeSitemap } from "@llm-boost/parsers";
```

- [ ] **Step 3: Rewrite test file imports for pipeline services**

Test files that import pipeline services should import from `@llm-boost/pipeline`:

```typescript
// __tests__/services/competitor-benchmark-service.test.ts
// Before
import { createCompetitorBenchmarkService } from "../../services/competitor-benchmark-service";
// After
import { createCompetitorBenchmarkService } from "@llm-boost/pipeline";
```

Same for: `content-optimization-service.test.ts`, `health-check-service.test.ts`, `recommendations-service.test.ts`, `visibility-service.test.ts`

Parser test files:
```typescript
// __tests__/lib/html-parser.test.ts
// Before
import { parseHtml } from "../../lib/html-parser";
// After
import { parseHtml } from "@llm-boost/parsers";

// __tests__/lib/sitemap.test.ts
// Before
import { analyzeSitemap, parseSitemapXml } from "../../lib/sitemap";
// After
import { analyzeSitemap, parseSitemapXml } from "@llm-boost/parsers";
```

- [ ] **Step 4: Delete old API service files**

Run:
```bash
rm apps/api/src/services/auto-site-description-service.ts
rm apps/api/src/services/auto-persona-service.ts
rm apps/api/src/services/auto-keyword-service.ts
rm apps/api/src/services/auto-competitor-service.ts
rm apps/api/src/services/auto-visibility-service.ts
rm apps/api/src/services/content-optimization-service.ts
rm apps/api/src/services/recommendations-service.ts
rm apps/api/src/services/health-check-service.ts
rm apps/api/src/services/competitor-benchmark-service.ts
rm apps/api/src/services/visibility-service.ts
rm apps/api/src/lib/html-parser.ts
rm apps/api/src/lib/sitemap.ts
```

- [ ] **Step 5: Verify full API typecheck**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS — all imports resolved

- [ ] **Step 6: Commit**

```
git add -A apps/api/src/
git commit -m "refactor: rewrite pipeline/parser imports and delete old files"
```

---

### Task 11: Update report-service

**Files:**
- Modify: `apps/report-service/src/pipeline-steps.ts`
- Modify: `apps/report-service/tsup.config.ts`
- Modify: `apps/report-service/package.json`
- Modify: `apps/report-service/Dockerfile`

- [ ] **Step 1: Rewrite pipeline-steps.ts**

Replace the entire file:

```typescript
/**
 * Re-exports pipeline step functions from the @llm-boost/pipeline package.
 * These are imported dynamically by the pipeline runner in index.ts.
 */
export {
  runAutoSiteDescription,
  runAutoPersonaGeneration,
  runAutoKeywordGeneration,
  runAutoCompetitorDiscovery,
  runAutoVisibilityChecks,
  runContentOptimization,
  createRecommendationsService,
  runHealthCheck,
} from "@llm-boost/pipeline";
```

- [ ] **Step 2: Update tsup.config.ts noExternal**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  noExternal: [
    "@llm-boost/db",
    "@llm-boost/reports",
    "@llm-boost/shared",
    "@llm-boost/llm",
    "@llm-boost/narrative",
    "@llm-boost/pipeline",
    "@llm-boost/parsers",
    "@llm-boost/repositories",
    "@llm-boost/scoring",
  ],
});
```

- [ ] **Step 3: Update package.json dependencies**

Add to `apps/report-service/package.json` `dependencies`:

```json
"@llm-boost/llm": "workspace:*",
"@llm-boost/narrative": "workspace:*",
"@llm-boost/parsers": "workspace:*",
"@llm-boost/pipeline": "workspace:*",
"@llm-boost/repositories": "workspace:*",
"@llm-boost/scoring": "workspace:*"
```

- [ ] **Step 4: Update Dockerfile**

Replace the build stage COPY lines. Key changes:
1. Add package.json COPY lines for new packages
2. Replace `COPY apps/api/src/services/` with new package COPY lines
3. Remove `apps/api/package.json` COPY (no longer needed)

Updated Dockerfile (full replacement):

```dockerfile
FROM node:20-slim AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy package.json files for all relevant workspaces
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/reports/package.json packages/reports/
COPY packages/llm/package.json packages/llm/
COPY packages/narrative/package.json packages/narrative/
COPY packages/parsers/package.json packages/parsers/
COPY packages/repositories/package.json packages/repositories/
COPY packages/pipeline/package.json packages/pipeline/
COPY packages/scoring/package.json packages/scoring/
COPY apps/report-service/package.json apps/report-service/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
COPY packages/reports/ packages/reports/
COPY packages/llm/ packages/llm/
COPY packages/narrative/ packages/narrative/
COPY packages/parsers/ packages/parsers/
COPY packages/repositories/ packages/repositories/
COPY packages/pipeline/ packages/pipeline/
COPY packages/scoring/ packages/scoring/
COPY apps/report-service/ apps/report-service/

# Build the report service (bundles workspace deps into single file)
WORKDIR /app/apps/report-service
RUN pnpm build

# Production stage
FROM node:20-slim AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy package.json files
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/reports/package.json packages/reports/
COPY packages/llm/package.json packages/llm/
COPY packages/narrative/package.json packages/narrative/
COPY packages/parsers/package.json packages/parsers/
COPY packages/repositories/package.json packages/repositories/
COPY packages/pipeline/package.json packages/pipeline/
COPY packages/scoring/package.json packages/scoring/
COPY apps/report-service/package.json apps/report-service/

# Install production deps only (ignore-scripts to skip husky prepare)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built output only (workspace deps are bundled into dist/index.js)
COPY --from=base /app/apps/report-service/dist/ apps/report-service/dist/

WORKDIR /app/apps/report-service

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

- [ ] **Step 5: Run pnpm install**

Run: `pnpm install`

- [ ] **Step 6: Verify report-service typecheck**

Run: `cd apps/report-service && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```
git add apps/report-service/
git commit -m "refactor: update report-service to use pipeline packages"
```

---

### Task 12: Full workspace verification

- [ ] **Step 1: pnpm install**

Run: `pnpm install`
Expected: all workspace packages resolve

- [ ] **Step 2: pnpm typecheck**

Run: `pnpm typecheck`
Expected: PASS across all workspaces

- [ ] **Step 3: pnpm test**

Run: `pnpm test`
Expected: all tests pass (import rewrites don't change behavior)

- [ ] **Step 4: pnpm build**

Run: `pnpm build`
Expected: all packages build (including tsup for report-service)

- [ ] **Step 5: Fix any remaining issues**

If typecheck or tests fail, fix the specific import path issues.

- [ ] **Step 6: Final commit**

```
git add -A
git commit -m "chore: pipeline decoupling complete — verify all packages"
```

---

## Verification Checklist (post-implementation)

- [ ] `pnpm install` — workspace packages resolve correctly
- [ ] `pnpm build` — all packages build
- [ ] `pnpm typecheck` — no type errors across workspaces
- [ ] `pnpm test` — all tests pass
- [ ] No files in `apps/api/src/` import from `../lib/logger`, `../lib/html-parser`, `../lib/sitemap`, `../repositories`, or `./errors`
- [ ] No files in `apps/report-service/` import from `../../api/src/`
- [ ] Dockerfile doesn't reference `apps/api/src/services/`
