# Neon PostgreSQL to D1 + Supabase Migration

**Date:** 2026-04-04
**Status:** Approved
**Motivation:** Simplicity (single platform) and cost reduction (eliminate Neon)

## Overview

Replace Neon PostgreSQL with a 3-database architecture:

- **D1_APP** (Cloudflare D1) — core app data for all tiers
- **D1_ADMIN** (Cloudflare D1) — admin/internal tables
- **SUPABASE** (Supabase PostgreSQL via Hyperdrive) — agency-tier analytics and visibility data with complex JSON queries

Fresh start — no data migration from existing Neon.

## Database Topology

| Binding    | Engine                           | Purpose                                                         | Users       |
| ---------- | -------------------------------- | --------------------------------------------------------------- | ----------- |
| `D1_APP`   | Cloudflare D1                    | Users, projects, crawls, pages, scores, issues, billing         | All tiers   |
| `D1_ADMIN` | Cloudflare D1                    | Admin settings, blocked domains, prompts, audit logs            | Internal    |
| `SUPABASE` | Supabase PostgreSQL (Hyperdrive) | Visibility, competitors, analytics, brand sentiment, narratives | Agency tier |

## Table Distribution

### D1_APP (~45 tables)

Identity: `users`, `session`, `account`, `verification`, `organizations`, `org_members`, `org_invites`, `teams`, `team_members`, `team_invitations`

Projects: `projects`, `personas`, `competitors`, `saved_keywords`, `scoring_profiles`

Crawling: `crawl_jobs`, `pages`, `page_scores`, `issues`, `crawl_insights`, `page_insights`, `discovered_links`, `custom_extractors`, `action_items`

Billing: `subscriptions`, `payments`, `promos`, `plan_price_history`

Features: `project_integrations`, `page_enrichments`, `outbox_events`, `reports`, `report_schedules`, `notification_channels`, `scheduled_visibility_queries`, `scan_results`, `api_tokens`, `content_fixes`, `alerts`, `pipeline_runs`, `log_uploads`, `ai_prompts`

### D1_ADMIN (~7 tables)

`blocked_domains`, `admin_settings`, `prompt_templates`, `prompt_metrics`, `admin_audit_logs`, `audit_logs`, `leads`

### SUPABASE (~9 tables — kept as PostgreSQL)

`visibility_checks`, `competitor_benchmarks`, `competitor_events`, `competitor_monitoring_schedules`, `narrative_reports`, `brand_sentiment_snapshots`, `llm_batch_jobs`, `analytics_events`, `analytics_daily_rollups`

**Why Supabase for these?** These tables use PostgreSQL-specific query patterns that are hard to port to SQLite:

- `jsonb_array_elements(competitor_mentions)` + `->>'domain'` in visibility queries
- `array_agg(distinct ...)` for aggregating providers/queries
- `::double precision` casts in analytics rollups
- `ON CONFLICT` upserts with complex target columns in analytics

## Schema Conversion Rules (D1 tables)

Following the proven pattern from families.care (`/Users/lsendel/Projects/families.care/packages/api/src/db/d1-schema.ts`):

| PostgreSQL (current)       | SQLite/D1 (target)                                              |
| -------------------------- | --------------------------------------------------------------- |
| `pgTable(...)`             | `sqliteTable(...)`                                              |
| `pgEnum("plan", [...])`    | `text("plan")` + TypeScript union type                          |
| `uuid().defaultRandom()`   | `text("id").primaryKey()` + `crypto.randomUUID()` at insert     |
| `jsonb("config")`          | `text("config")` (JSON.stringify/parse via Drizzle custom type) |
| `timestamp().defaultNow()` | `text("created_at").default(sql\`datetime('now')\`)`            |
| `boolean()`                | `integer("col", { mode: "boolean" })`                           |
| `text().array()`           | `text("col")` (JSON-serialized array)                           |
| `real()`                   | `real()` (same in SQLite)                                       |
| `integer()`                | `integer()` (same in SQLite)                                    |
| `varchar(n)`               | `text()` (SQLite has no varchar)                                |

### Custom Types (from families.care)

```ts
// D1 rejects Date objects — serialize to ISO string
const dateText = customType<{ data: string | Date; driverData: string }>({
  dataType() {
    return "text";
  },
  toDriver(value): string {
    if (value instanceof Date) return value.toISOString();
    return String(value ?? "");
  },
});
```

### Enum Replacement Pattern

Current:

```ts
export const planEnum = pgEnum("plan", ["free", "starter", "pro", "agency"]);
```

Target:

```ts
export const PLAN_VALUES = ["free", "starter", "pro", "agency"] as const;
export type Plan = (typeof PLAN_VALUES)[number];
// Used in schema as: text("plan")
// Type safety via TypeScript, not DB constraints
```

## Connection Setup

### D1 Client (packages/db/src/client.ts)

```ts
import { drizzle } from "drizzle-orm/d1";
import * as appSchema from "./schema/d1-app";
import * as adminSchema from "./schema/d1-admin";

export function createAppDb(d1: D1Database) {
  return drizzle(d1, { schema: appSchema });
}

export function createAdminDb(d1: D1Database) {
  return drizzle(d1, { schema: adminSchema });
}

export type AppDatabase = ReturnType<typeof createAppDb>;
export type AdminDatabase = ReturnType<typeof createAdminDb>;
```

### Supabase Client (packages/db/src/supabase-client.ts)

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as agencySchema from "./schema/supabase-agency";

export function createAgencyDb(hyperdrive: Hyperdrive) {
  const client = postgres(hyperdrive.connectionString);
  return drizzle(client, { schema: agencySchema });
}

export type AgencyDatabase = ReturnType<typeof createAgencyDb>;
```

### Drizzle Config (packages/db/drizzle.config.ts)

Need separate configs for D1 and Supabase:

```ts
// drizzle-d1.config.ts
export default defineConfig({
  schema: ["./src/schema/d1-app.ts", "./src/schema/d1-admin.ts"],
  out: "./migrations/d1",
  dialect: "sqlite",
});

// drizzle-supabase.config.ts
export default defineConfig({
  schema: "./src/schema/supabase-agency.ts",
  out: "./migrations/supabase",
  dialect: "postgresql",
  dbCredentials: { url: process.env.SUPABASE_DATABASE_URL! },
});
```

## API Bindings (apps/api)

### wrangler.toml changes

```toml
# Remove:
# DATABASE_URL = "..." (Neon connection string)

# Add:
[[d1_databases]]
binding = "D1_APP"
database_name = "llmrank-app"
database_id = "<to-be-created>"

[[d1_databases]]
binding = "D1_ADMIN"
database_name = "llmrank-admin"
database_id = "<to-be-created>"

[hyperdrive]
binding = "SUPABASE"
id = "<to-be-created>"
```

### Bindings type (apps/api/src/index.ts)

```ts
export type Bindings = {
  D1_APP: D1Database;
  D1_ADMIN: D1Database;
  SUPABASE: Hyperdrive;
  // ... rest unchanged
};
```

### Middleware DB injection

```ts
// Replace:
const db = createDb(c.env.DATABASE_URL);
c.set("db", db);

// With:
const appDb = createAppDb(c.env.D1_APP);
const adminDb = createAdminDb(c.env.D1_ADMIN);
c.set("db", appDb);
c.set("adminDb", adminDb);
// Agency DB created lazily only when needed
```

## Container / Service Layer Changes

The `createContainer()` function needs to accept the new DB types and wire them into services. Services that currently take `Database` need to be updated:

- Most services: `Database` → `AppDatabase`
- Admin services: `Database` → `AdminDatabase`
- Visibility/competitor/analytics services: keep `AgencyDatabase` (Supabase)

## Query Migration (D1 tables only)

Queries that need rewriting for SQLite compatibility:

1. **`array_agg()` in discovered-links.ts** → `json_group_array()` or `group_concat()`
2. **`ON CONFLICT` upserts in analytics.ts** → D1 supports `ON CONFLICT` but syntax may differ slightly
3. **Any `::type` casts** → `CAST(x AS type)` for SQLite
4. **`NULLIF(..., '')::double precision`** → `CAST(NULLIF(..., '') AS REAL)`

Queries in Supabase tables stay unchanged (they keep PostgreSQL).

## Dependencies

### Add

- `postgres` (for Supabase via Hyperdrive)

### Remove

- `@neondatabase/serverless`

### Keep

- `drizzle-orm` (supports both d1 and postgres-js adapters)
- `drizzle-kit` (for both SQLite and PostgreSQL migrations)

## Schema File Organization

```
packages/db/src/
  schema/
    d1-app.ts          # All D1_APP tables (sqliteTable)
    d1-admin.ts        # All D1_ADMIN tables (sqliteTable)
    supabase-agency.ts # All SUPABASE tables (pgTable) — kept from current schema
    enums.ts           # TypeScript union types (replaces pgEnum)
  client.ts            # D1 client (createAppDb, createAdminDb)
  supabase-client.ts   # Supabase client (createAgencyDb)
  migrations/
    d1/                # SQLite migrations for D1
    supabase/          # PostgreSQL migrations for Supabase
```

## CI/CD Changes

### deploy-cloudflare.yml

1. **Migrations step**: Run both D1 migrations (`wrangler d1 migrations apply`) and Supabase migrations (`drizzle-kit push`)
2. **New secrets**: `SUPABASE_DATABASE_URL`
3. **Remove**: `DATABASE_URL` (Neon)

### GitHub Secrets

- Remove: `DATABASE_URL` (Neon)
- Add: `SUPABASE_DATABASE_URL`
- Keep: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `FLY_API_TOKEN`

## Cloudflare Resource Creation

```bash
# Create D1 databases
wrangler d1 create llmrank-app
wrangler d1 create llmrank-admin

# Create Hyperdrive for Supabase
wrangler hyperdrive create llmrank-supabase \
  --origin-host=db.<project-id>.supabase.co \
  --origin-port=5432 \
  --origin-user=postgres \
  --origin-password=<password> \
  --database=postgres
```

## Testing Strategy

- Unit tests: Use in-memory SQLite (via `better-sqlite3`) for D1 schema tests
- Supabase tables: Keep existing test patterns (or use test Supabase project)
- No mocks (per project policy)

## Crawler Impact

None. The Rust crawler on Fly.io communicates with the API via HMAC-authenticated HTTP callbacks. It never touches the database directly. The API layer handles all DB writes.

## Rollback Plan

Since this is a fresh start (no data migration), rollback = revert the code changes and re-enable Neon. Keep the Neon project alive for 30 days after cutover as a safety net.
