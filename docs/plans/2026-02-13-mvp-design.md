# LLM Rank MVP Design (Phase 1)

**Date:** 2026-02-13
**Scope:** Phase 1 MVP — Core Crawler + Technical Audit + All 37 Scoring Factors + Dashboard
**Approach:** API-First, Bottom-Up

## Decisions

| Decision        | Choice               | Rationale                                               |
| --------------- | -------------------- | ------------------------------------------------------- |
| Build sequence  | API-first, bottom-up | Tackle riskiest parts (crawler, scoring) first          |
| Auth            | Clerk from day 1     | User accounts from the start, fastest to integrate      |
| Scoring scope   | All 37 factors       | Full scoring including Lighthouse + LLM content scoring |
| UI library      | shadcn/ui + Tailwind | Best dashboard component ecosystem for Next.js          |
| Package manager | pnpm                 | Fast installs, strict dependency resolution             |
| Hetzner         | Include full setup   | VPS provisioning, Docker, SSH deploy pipeline           |

## Architecture

```
Cloudflare Edge                         Hetzner VPS (Docker)
+---------------------------+           +------------------------+
| Next.js (Pages)           |           | Axum HTTP Server       |
| Hono Workers (API)        |<--HMAC--> | Rust Crawler (Tokio)   |
| D1 (SQLite) / R2 / KV    |           | Lighthouse (Chromium)  |
| LLM orchestration         |           +------------------------+
+---------------------------+
```

**Data flow:** User submits URL -> API creates crawl_job in D1 -> POSTs to Hetzner -> Crawler fetches pages, extracts data, runs Lighthouse -> POSTs batches back to /ingest/crawl-result -> API triggers scoring engine -> Scores + issues stored in D1 -> Dashboard reads from API.

## Monorepo Structure

```
LLMRank_app/
├── apps/
│   ├── web/              # Next.js 15 (App Router, Cloudflare Pages)
│   └── crawler/          # Rust (Cargo, separate from Turborepo)
├── packages/
│   ├── api/              # Cloudflare Worker (Hono)
│   ├── shared/           # Zod schemas, TS types, error codes, constants
│   ├── db/               # Drizzle ORM schema, migrations, query helpers
│   ├── scoring/          # 37-factor scoring engine
│   └── llm/              # LLM orchestration, prompts, caching
├── turbo.json
├── package.json          # pnpm workspace root
├── wrangler.toml
└── .github/workflows/
```

## Data Layer (packages/db)

7 tables: users, projects, crawl_jobs, pages, page_scores, issues, visibility_checks.

- All IDs: `lower(hex(randomblob(16)))` text columns
- Timestamps: ISO text via `datetime('now')`
- Drizzle ORM with SQLite dialect + D1 driver
- Migrations as numbered SQL files applied via wrangler

Query helpers grouped by domain (users, projects, crawls, pages, scores).

## Shared Types (packages/shared)

Single source of truth for all data shapes:

- Zod schemas for every API payload (crawl, project, scoring, error envelope)
- Inferred TypeScript types from Zod
- Constants: all 37 issue codes with metadata, plan tier limits

Imported by both packages/api and apps/web.

## Worker API (packages/api)

Hono framework with middleware stack:

- `auth.ts` — Clerk session verification
- `hmac.ts` — HMAC-SHA256 verification for crawler callbacks
- `rateLimit.ts` — Per-user rate limiting via KV

Routes: projects CRUD, crawl start/status/results, ingest (crawler callbacks), pages detail, billing (Stripe), health check.

After ingesting crawl results, triggers scoring engine + LLM scoring.

## Rust Crawler (apps/crawler)

Axum HTTP server with:

- **Frontier:** BFS URL queue with depth tracking and dedup (HashSet)
- **Fetcher:** reqwest with governor rate limiter (1 req/sec per domain)
- **Parser:** scraper crate for HTML extraction (meta, headings, links, schema, images)
- **Robots:** robots.txt + llms.txt parsing
- **Lighthouse:** Shell out to CLI, max 2 concurrent audits
- **Storage:** R2 upload (S3-compatible), callback POST with HMAC

Job management via tokio mpsc channels, cancellation via CancellationToken.

Key crates: axum, tokio, reqwest, scraper, governor, hmac, sha2, aws-sdk-s3.

Docker container: Rust binary + Node.js + Chromium + Lighthouse CLI.

## Scoring Engine (packages/scoring)

37 factors across 4 categories (weighted):

- Technical SEO (25%): 13 factors — meta tags, headings, links, status codes, robots
- Content Quality (30%): 9 factors — word count, depth, clarity, authority (LLM), links
- AI Readiness (30%): 10 factors — schema, llms.txt, citation worthiness (LLM)
- Performance (15%): 5 factors — Lighthouse scores, page size

Algorithm: Start at 100 per category, apply deductions (never below 0), weighted average, letter grade A-F.

Input: PageData (extracted HTML + Lighthouse + LLM scores). Output: PageScore + Issue[].

## LLM Scoring (packages/llm)

- Content-hash caching in KV (SHA256 -> cached scores)
- Tiered models: Haiku (free), Sonnet (paid)
- 5 dimensions: Clarity, Authority, Comprehensiveness, Structure, Citation Worthiness
- Skip pages < 200 words (flag THIN_CONTENT)
- Batch API for cost savings

## Dashboard (apps/web)

Next.js 15 App Router with shadcn/ui + Tailwind:

Pages:

- (auth): Clerk login/signup
- (dashboard): Project list, project detail, page list, issues, crawl progress, settings
- (marketing): Landing page, pricing

Key components: Score circle gauge, issue cards with severity badges, crawl progress bar.

Crawl progress via polling. Server components where possible, client for interactivity.

## Infrastructure

**Hetzner:** CX31 (4 vCPU, 8GB RAM), Docker + Compose, GHCR image registry.

**Cloudflare:** Workers (API), Pages (frontend), D1, R2, KV. All configured in wrangler.toml.

**CI/CD:** Two GitHub Actions workflows:

1. Cloudflare deploy on packages/ or apps/web/ changes
2. Hetzner crawler deploy on apps/crawler/ changes (SSH + Docker pull)
