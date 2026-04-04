# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**LLM Rank** (AI-Readiness SEO Platform) — a SaaS that crawls websites, scores pages for AI-readiness across 37 factors, and provides actionable recommendations to increase visibility in AI-generated responses (ChatGPT, Codex, Perplexity, Gemini).

## Tech Stack

- **Frontend:** Next.js on Cloudflare Pages (App Router)
- **API:** Cloudflare Workers with Hono framework
- **Database:** Cloudflare D1 (app + admin) + Supabase PostgreSQL (agency analytics) with Drizzle ORM
- **Object Storage:** Cloudflare R2
- **Cache:** Cloudflare KV
- **Crawler:** Rust (Axum + Tokio) on Fly.io, with Lighthouse (Node.js + Chromium)
- **Auth:** Clerk (primary) or Lucia (fallback)
- **Billing:** Stripe (4 tiers: Free, Starter $79, Pro $149, Agency $299)
- **LLM:** Anthropic (content scoring) + OpenAI (visibility checks)
- **Monorepo:** Turborepo

## Architecture

```
Cloudflare Edge                         Fly.io (iad)
┌─────────────────────────┐             ┌──────────────────────┐
│ Next.js (Pages)         │             │ Axum HTTP Server     │
│ Hono Workers (API)      │◄──HMAC──►  │ Rust Crawler (Tokio) │
│ D1 / Supabase / R2 / KV│             │ Lighthouse (Chromium)│
└─────────────────────────┘
```

- Workers API receives crawl requests, stores metadata in D1 (app/admin) and Supabase (agency analytics), dispatches jobs to Fly.io
- Rust crawler posts results back via HMAC-authenticated callbacks
- Scoring engine (packages/scoring) runs in Workers after crawl data ingestion
- LLM content scoring caches by content SHA256 hash

## API-First Principle

- The Hono Worker in `apps/api` owns all business capabilities; every UI (Next.js), CLI, or automation must call it via HTTP (or a generated SDK) rather than importing repositories directly.
- ESLint enforces this contract: only `apps/api`, `packages/billing` (Stripe webhooks), and `packages/db` (schema/migrations) may import `@llm-boost/db`. All other workspaces must rely on `apps/web/src/lib/api.ts` or another HTTP client.
- When shipping features, first expose/update the API route + domain service, then adapt the frontend to that endpoint. This keeps auth, validation, and plan enforcement centralized.

## Repository Structure

```
apps/
  web/           → Next.js frontend (Cloudflare Pages, App Router)
  crawler/       → Rust crawler service (Axum, Fly.io)
packages/
  api/           → Cloudflare Workers (Hono) REST API
  shared/        → TypeScript interfaces, Zod schemas, error codes
  db/            → D1 + Supabase schemas, Drizzle ORM, migrations, query helpers
  scoring/       → 37-factor scoring engine (Technical 25%, Content 30%, AI Readiness 30%, Performance 15%)
  llm/           → LLM prompt templates, batching, caching, cost tracking
infra/
  docker/        → docker-compose for local crawler development
  migrations/    → PostgreSQL migrations (also in packages/db/migrations/)
  scripts/       → Deploy, seed, utility scripts
```

## Common Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Typecheck all packages
pnpm typecheck

# D1 migrations
cd packages/db && npx drizzle-kit generate --config=drizzle-d1.config.ts

# Supabase schema push (requires SUPABASE_DATABASE_URL env var)
export SUPABASE_DATABASE_URL="..." && cd packages/db && npx drizzle-kit push --config=drizzle-supabase.config.ts

# Rust crawler (from apps/crawler/)
cargo build --release
cargo test
```

## Deployment

### CI Auto-Deploy

CI auto-deploys on push to `main` when relevant paths change.

| Workflow                | Services                            | Trigger Paths                                                      |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `deploy-cloudflare.yml` | DB migrations → API + MCP GW → Web  | `packages/**`, `apps/web/**`, `apps/api/**`, `apps/mcp-gateway/**` |
| `deploy-fly.yml`        | Crawler, Report Service             | `apps/crawler/**`, `apps/report-service/**`                        |
| `ci.yml`                | Typecheck, tests, coverage (on PRs) | All files (pull_request to main)                                   |

**CI Pipeline (`ci.yml`) — runs on PRs to `main`:**

1. Typecheck all packages (`pnpm typecheck`)
2. Run all tests (`pnpm test`)
3. Verify settings disclosure guardrails (specific component tests)
4. Verify journey spec discovery (Playwright `--list`)
5. Check coverage thresholds per package (api, db, scoring, llm, shared, integrations, billing)
6. Rust crawler: `cargo check` + `cargo test`

**Cloudflare Deploy (`deploy-cloudflare.yml`) — dependency order:**

1. `migrations` — D1 migrations via `drizzle-kit generate` + Supabase schema push (needs `SUPABASE_DATABASE_URL` secret)
2. `deploy-api` — Wrangler deploy `apps/api` (after migrations)
3. `deploy-mcp-gateway` — Build MCP package, then Wrangler deploy `apps/mcp-gateway` (after migrations)
4. `deploy-web` — OpenNext build + Wrangler deploy `apps/web` (after API)

**Fly.io Deploy (`deploy-fly.yml`) — parallel jobs:**

- `deploy-crawler` — `flyctl deploy -a llmrank-crawler` from `apps/crawler/`
- `deploy-report-service` — `flyctl deploy -a llm-boost-reports` from **repo root** with `--dockerfile apps/report-service/Dockerfile --config apps/report-service/fly.toml` (monorepo context required for workspace deps)

### Manual Deploy

```bash
# Deploy all services (when CI is broken)
bash infra/scripts/deploy-all.sh

# D1 migrations (generate SQL, apply via wrangler)
cd packages/db && npx drizzle-kit generate --config=drizzle-d1.config.ts

# Supabase schema push (must export SUPABASE_DATABASE_URL first)
export $(grep -v '^#' .env | xargs) && cd packages/db && npx drizzle-kit push --config=drizzle-supabase.config.ts

# Individual Cloudflare services
cd apps/api && npx wrangler deploy
cd apps/web && npx opennextjs-cloudflare build && npx wrangler deploy --config wrangler.jsonc

# Individual Fly.io services
cd apps/crawler && flyctl deploy -a llmrank-crawler
# Report service MUST deploy from repo root (needs monorepo context for workspace deps)
flyctl deploy -a llm-boost-reports --dockerfile apps/report-service/Dockerfile --config apps/report-service/fly.toml
```

### Production URLs

| Service        | URL                               |
| -------------- | --------------------------------- |
| Web            | https://llmrank.app               |
| API            | https://api.llmrank.app           |
| Crawler        | https://llmrank-crawler.fly.dev   |
| Report Service | https://llm-boost-reports.fly.dev |

### Required GitHub Secrets

`CF_API_TOKEN`, `CF_ACCOUNT_ID`, `SUPABASE_DATABASE_URL`, `FLY_API_TOKEN`

## Key Design Decisions

- **Hono over itty-router:** Chosen for Express-like DX, minimal bundle size, Workers-native
- **Drizzle ORM:** Type-safe, lightweight, supports both D1 (via `drizzle-orm/d1`) and Supabase (via `drizzle-orm/postgres-js`) with excellent migration support
- **Rust crawler (not Node.js):** Memory safety and async performance for long-running crawl processes
- **Tokio mpsc for job queue (MVP):** Simplest deployment; migration path to Redis then NATS JetStream at scale
- **Content-hash caching for LLM scores:** Avoids re-scoring unchanged content (50-70% cost savings)
- **Tiered LLM models:** Haiku for free tier screening, Sonnet for paid detailed analysis

## Scoring Engine

Score = Technical(25%) + Content(30%) + AI Readiness(30%) + Performance(15%). Each category starts at 100 and applies deductions per factor. Letter grades: A(90+), B(80-89), C(70-79), D(60-69), F(<60). Critical issues include: MISSING_LLMS_TXT, AI_CRAWLER_BLOCKED, NOINDEX_SET, MISSING_TITLE, HTTP_STATUS errors.

## Communication Between Services

Cloudflare Workers ↔ Fly.io Crawler uses HMAC-SHA256 signed payloads:

- `X-Signature: hmac-sha256=<hex(HMAC(secret, timestamp + body))>`
- `X-Timestamp: <unix_epoch_seconds>`
- Replay protection: reject timestamps > 5 minutes old

## API Error Codes

Standard error envelope: `{ "error": { "code", "message", "details" } }`. Key codes: UNAUTHORIZED (401), PLAN_LIMIT_REACHED (403), CRAWL_LIMIT_REACHED (429), CRAWL_IN_PROGRESS (409), INVALID_DOMAIN (422), HMAC_INVALID (401).

## Database

Three database targets with separate Drizzle configs:

- **D1_APP** — Cloudflare D1 (SQLite-compatible): core tables for identity, projects, crawling, billing, and feature flags (`users`, `projects`, `crawl_jobs`, `pages`, `page_scores`, `issues`). Accessed via D1 binding in Workers.
- **D1_ADMIN** — Cloudflare D1: admin-only tables for blocked domains, settings, prompts, and audit logs. Accessed via D1 binding in Workers.
- **SUPABASE** — Supabase PostgreSQL: agency-tier analytics tables (`visibility_checks`, `competitors`, `analytics`, `brand_sentiment`, `narratives`, `batch_jobs`). Accessed via Hyperdrive connection pooler with `drizzle-orm/postgres-js`.

D1 uses integer primary keys with `autoincrement()` and `integer("created_at", { mode: "timestamp" })`. Supabase uses `uuid().defaultRandom()` and `timestamp().defaultNow()` with `pgEnum` for type safety. Connection to Supabase is via `SUPABASE_DATABASE_URL` (Hyperdrive binding in production).

## Plan Limits

| Resource     | Free | Starter | Pro | Agency    |
| ------------ | ---- | ------- | --- | --------- |
| Pages/crawl  | 10   | 100     | 500 | 2,000     |
| Crawls/month | 2    | 10      | 30  | Unlimited |
| Projects     | 1    | 5       | 20  | 50        |

## Testing

- **packages/scoring:** 90%+ coverage, 50+ deterministic test cases for scoring factors
- **packages/shared:** Zod schema validation/rejection tests
- **Integration:** HMAC auth verification, crawl submission/ingestion pipeline, Stripe webhook handling
- **Performance:** Dashboard TTI < 2s, API p95 < 200ms
