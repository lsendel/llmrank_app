# Pipeline Decoupling — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Problem

The report service (`apps/report-service`) imports pipeline step services directly from `apps/api/src/services/`. These services depend on API-internal modules (`lib/logger`, `lib/html-parser`, `lib/sitemap`, `repositories/`). The Dockerfile copies these paths piecemeal, but new imports break the build. The coupling makes the report service fragile and the API hard to refactor.

## Solution

Extract pipeline services and their dependencies into three new workspace packages, eliminating cross-app source imports.

## New Packages

### `@llm-boost/parsers`

Pure utility package for HTML and sitemap parsing.

**Files (moved from `apps/api/src/lib/`):**

- `src/html-parser.ts` — regex HTML parser (title, meta, headings, links, schema, word count)
- `src/sitemap.ts` — fetch + parse sitemap.xml
- `src/index.ts` — re-exports

**Dependencies:** None (pure utilities)

**package.json:**

```json
{
  "name": "@llm-boost/parsers",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

### `@llm-boost/repositories`

Repository interfaces and factory functions.

**Files (moved from `apps/api/src/repositories/index.ts`):**

- `src/interfaces.ts` — 16 repository interfaces (ProjectRepository, UserRepository, etc.)
- `src/factories.ts` — factory functions (createProjectRepository, createUserRepository, etc.)
- `src/index.ts` — re-exports

**Dependencies:** `@llm-boost/db`

**package.json:**

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

### `@llm-boost/pipeline`

All pipeline step services and their supporting services.

**Files (moved from `apps/api/src/services/`):**

Pipeline steps:

- `src/auto-site-description.ts`
- `src/auto-persona.ts`
- `src/auto-keyword.ts`
- `src/auto-competitor.ts`
- `src/auto-visibility.ts`
- `src/content-optimization.ts`
- `src/recommendations.ts`
- `src/health-check.ts`

Supporting services:

- `src/competitor-benchmark.ts`
- `src/visibility.ts`

Shared:

- `src/index.ts` — re-exports all pipeline step functions

**Dependencies:**

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

## Expand `@llm-boost/shared`

Move two cross-cutting concerns from `apps/api/src/` into the existing shared package:

- **Logger** (`apps/api/src/lib/logger.ts` → `packages/shared/src/logger.ts`) — Logger interface + createLogger factory (65 lines, zero deps)
- **ServiceError** (`apps/api/src/services/errors.ts` → `packages/shared/src/errors.ts`) — only the `ServiceError` class moves (zero deps). The `handleServiceError(c: Context, error)` function stays in `apps/api` (depends on Hono `Context` and `AppEnv`) — keep it in `apps/api/src/lib/error-handler.ts`.

Update `packages/shared/src/index.ts` to re-export both.

## Dependency Graph

```
@llm-boost/pipeline
  ├── @llm-boost/repositories
  │     └── @llm-boost/db
  ├── @llm-boost/parsers
  ├── @llm-boost/scoring
  ├── @llm-boost/llm
  ├── @llm-boost/shared (logger, errors, PLAN_LIMITS)
  └── @llm-boost/db

No circular dependencies.
```

## Changes to Existing Apps

### `apps/api`

**Remove files:**

- `src/services/auto-site-description-service.ts`
- `src/services/auto-persona-service.ts`
- `src/services/auto-keyword-service.ts`
- `src/services/auto-competitor-service.ts`
- `src/services/auto-visibility-service.ts`
- `src/services/content-optimization-service.ts`
- `src/services/recommendations-service.ts`
- `src/services/health-check-service.ts`
- `src/services/competitor-benchmark-service.ts`
- `src/services/visibility-service.ts`
- `src/lib/html-parser.ts`
- `src/lib/sitemap.ts`
- `src/lib/logger.ts`
- `src/repositories/index.ts`

**Transform (not delete):**

- `src/services/errors.ts` — keep `handleServiceError` (Hono-specific), move to `src/lib/error-handler.ts`. Remove `ServiceError` class (now in `@llm-boost/shared`). Update all ~30 route files importing `handleServiceError` to use new path.

**Update imports across ~40+ API files:**

Non-pipeline services and routes that currently import from deleted files must switch to package imports:

- Logger (`~10 files`: outbox-processor, digest-service, monitoring-service, llm-scoring, notification-service, middleware/auth, scheduled/index, etc.): `import { createLogger } from "@llm-boost/shared"`
- Parsers (`routes/public.ts` and any others): `import { parseHtml, analyzeSitemap } from "@llm-boost/parsers"`
- Repos (`~40 files`: all routes, remaining services, middleware): `import { createProjectRepository, ... } from "@llm-boost/repositories"`
- Pipeline steps (any route or service that calls them): `import { runAutoSiteDescription, ... } from "@llm-boost/pipeline"`
- Errors (`~30 route files`): `import { ServiceError } from "@llm-boost/shared"` + `import { handleServiceError } from "../lib/error-handler"`

**Add to `apps/api/package.json` dependencies:**

- `@llm-boost/pipeline`
- `@llm-boost/parsers`
- `@llm-boost/repositories`
- `@llm-boost/shared` (if not already listed)

### `apps/report-service`

**`src/pipeline-steps.ts`** — change imports:

```typescript
// Before
export { runAutoSiteDescription } from "../../api/src/services/auto-site-description-service";
// ...

// After
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

**`tsup.config.ts`** — add to `noExternal`:

```typescript
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
```

**`Dockerfile`** — replace API source copy with package copies:

```dockerfile
# Before
COPY apps/api/src/services/ apps/api/src/services/

# After (no apps/api/src/ needed at all)
COPY packages/parsers/ packages/parsers/
COPY packages/repositories/ packages/repositories/
COPY packages/pipeline/ packages/pipeline/
COPY packages/scoring/ packages/scoring/
```

Also add package.json COPY lines for pnpm install:

```dockerfile
COPY packages/parsers/package.json packages/parsers/
COPY packages/repositories/package.json packages/repositories/
COPY packages/pipeline/package.json packages/pipeline/
COPY packages/scoring/package.json packages/scoring/
```

## Verification

1. `pnpm install` — workspace packages resolve correctly
2. `pnpm build` — all packages build (tsup for report-service, tsc for others)
3. `pnpm typecheck` — no type errors across workspaces
4. API worker deploys and runs
5. Report service Dockerfile builds successfully
6. `fly deploy` succeeds
7. "Run Pipeline Now" button on llmrank.app works end-to-end

## Risks & Mitigations

| Risk                                            | Mitigation                                                    |
| ----------------------------------------------- | ------------------------------------------------------------- |
| Broken imports after move                       | Run `pnpm typecheck` after each extraction step               |
| Missing re-exports                              | Each new package has an `index.ts` that re-exports everything |
| Report service bundle size                      | tsup already bundles all workspace deps — no change           |
| API routes that call pipeline services directly | Update to import from `@llm-boost/pipeline`                   |
