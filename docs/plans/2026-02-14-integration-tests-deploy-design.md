# Integration Tests, 85% Coverage & Production Deployment

Date: 2026-02-14
Status: Approved

## Problem

328 tests exist but only 10% of source files have coverage. Zero route-level integration tests. Zero DB query tests. Three packages have no tests at all (db, integrations, web). Browser audit route is unprotected. No coverage thresholds enforced in CI.

## Decisions

- **Approach A: Real DB via Neon branch.** All DB queries tested against real PostgreSQL, not mocks.
- **One persistent test branch.** Neon free plan limits to 10 branches. We use 1 slot for a permanent `test` branch, truncated between test suites.
- **Route integration tests exercise the full stack.** Real Hono routing, real services, real DB. Only external services (Clerk, Stripe, LLM APIs, KV, R2) are stubbed.

## 1. Test Database Strategy

One persistent Neon branch named `test`, forked from `main`. Uses 1 of 10 branch slots permanently.

**Reset:** Before each `packages/db` test file, a `globalSetup` script runs `TRUNCATE ... CASCADE` on all tables (~50ms on Neon).

**Schema sync:** CI runs `drizzle-kit push` against the test branch before tests. Keeps schema in sync without migrations.

**Connection:** `TEST_DATABASE_URL` env var points to the test branch pooler endpoint. Local devs reuse the same branch (data is ephemeral).

```
main branch (prod) ──fork──> test branch (persistent, truncated each run)
                              1 of 10 slots, never deleted
```

## 2. Integration Test Architecture

Route-level tests use `app.fetch()` with real Hono routing, middleware, and service wiring.

**Test harness:** `createTestApp()` helper that:
1. Builds the full Hono app (same as production)
2. Injects real DB connection (test branch) via middleware override
3. Stubs only external services

**Real vs mocked:**

| Layer | Real | Mocked |
|-------|------|--------|
| Hono routing + middleware | Yes | |
| Auth (Clerk JWT) | | Fixed userId |
| Services | Yes | |
| Repositories | Yes | |
| DB queries (Drizzle -> Neon) | Yes | |
| KV / R2 | | In-memory stubs |
| External APIs (Stripe, LLM, Crawler) | | vi.fn() |

**File structure:**
```
apps/api/src/__tests__/
  integration/
    health.test.ts
    projects.test.ts
    crawls.test.ts
    scores.test.ts
    dashboard.test.ts
    visibility.test.ts
    billing.test.ts
    public.test.ts
    admin.test.ts
    ingest.test.ts
  helpers/
    test-app.ts       createTestApp() + auth stubs
    test-db.ts        connect, truncate, seed helpers
    kv-stub.ts        In-memory KVNamespace
    r2-stub.ts        In-memory R2Bucket
```

Each test file seeds data via factory builders, runs requests, asserts responses + DB side effects. Truncation resets state between files.

## 3. Coverage Plan by Package

Target: 85% line coverage per package.

### packages/db (0% -> 85%)

New vitest config + `@vitest/coverage-v8`. Test every query file against the real test branch. Each test: insert seed data, call query, assert result shape + row counts. ~14 test files, ~120 tests.

### apps/api (5% -> 85%)

- Route integration tests (Section 2) cover routes + services + middleware in one pass
- Unit tests for remaining services: `ingest-service`, `strategy-service`, `page-service`, `billing-service`, `admin-service`, `llm-scoring`
- Unit tests for middleware: `auth`, `ownership`, `admin`, `request-id`
- Unit tests for lib: `html-parser`, `sitemap`, `kv-cache`, `crypto`
- Expand vitest coverage include to `src/routes/**`, `src/lib/**`
- ~150 new tests

### packages/llm (21% -> 85%)

Add `@vitest/coverage-v8`. Test each provider with mocked HTTP. Test `fact-extractor`, `optimizer`, `personas`, `summary`, `retry`. ~40 new tests.

### packages/shared (13% -> 85%)

Add `@vitest/coverage-v8`. Test utilities (`quick-wins`, `scoring`, `log-analysis`). Test remaining Zod schemas. Constants covered by import verification. ~25 new tests.

### packages/integrations (0% -> 85%)

New vitest config. Test each fetcher with mocked HTTP: `ga4`, `gsc`, `clarity`, `psi`. ~20 new tests.

### packages/billing (50% -> 85%)

Test `plan-map.ts`. ~5 new tests.

### packages/scoring (60% -> 85%)

Test `helpers.ts`, `thresholds.ts`. ~10 new tests.

### Totals

| Metric | Before | After |
|--------|--------|-------|
| Tests | 328 | ~698 |
| Packages with coverage config | 3 | 7 |
| Coverage threshold enforced | None | 85% per package |

## 4. Headless Browser

Browser rendering is already wired: `@cloudflare/puppeteer` + `BROWSER` binding + `/api/browser/audit`.

Three additions:

1. **Auth gate.** Add HMAC verification to browser route so only the Rust crawler can call it. Same `X-Signature` / `X-Timestamp` pattern as `/ingest`.

2. **Smoke test.** Integration test calling `POST /api/browser/audit` with mocked puppeteer. Covers route wiring, error handling, response shape.

3. **Wire crawler remote mode.** Set `API_BASE_URL=https://api.llmrank.app` in crawler environment. The Rust `LighthouseRunner` already has remote audit support.

## 5. Production Deployment

Three targets, all have existing CI:

| Target | Tool | Trigger |
|--------|------|---------|
| API Worker | `wrangler deploy` | push to main |
| Next.js Pages | `wrangler pages deploy` | push to main |
| Rust Crawler | Docker -> Hetzner | push to main |

**CI additions:**
- `TEST_DATABASE_URL` secret (test branch connection string)
- `pnpm test:coverage` step with coverage collection
- Fail CI if any package below 85%
- `drizzle-kit push` against test branch before DB tests

**One-time secrets to verify** (via `wrangler secret put`):
- All 15 secrets from the Bindings type
- `SENTRY_DSN` (new from Phase 4)
- Crawler: `API_BASE_URL=https://api.llmrank.app`

**Deployment order:**
1. `drizzle-kit push` (prod schema)
2. `wrangler deploy` (API Worker)
3. `wrangler pages deploy` (Next.js)
4. Update crawler env + `docker compose up -d`

## Implementation Phases

1. **Test infrastructure** — Neon test branch, test harness (`createTestApp`, stubs), vitest configs for all packages
2. **DB query tests** — All 14 query files against real PG
3. **Route integration tests** — All 10 route test files
4. **Service + middleware + lib unit tests** — Fill remaining gaps in apps/api
5. **Package tests** — llm providers, shared utils, integrations fetchers, billing, scoring
6. **Browser hardening** — HMAC auth gate, smoke test, crawler wiring
7. **CI coverage gates** — 85% threshold per package, deployment pipeline
8. **Production deploy** — Secrets, schema push, wrangler deploy, crawler update
