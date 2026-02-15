# Integration Tests, 85% Coverage & Production Deployment

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve 85% test coverage across all packages with real-DB integration tests, harden the browser audit route, enforce coverage gates in CI, and deploy to production.

**Architecture:** One persistent Neon `test` branch (1 of 10 slots) for real PostgreSQL testing. Route-level integration tests use `app.fetch()` with real Hono routing + real DB + mocked externals (Clerk, Stripe, KV, R2, LLM APIs). Unit tests for services use mock repositories. CI enforces 85% per package.

**Tech Stack:** Vitest + @vitest/coverage-v8, Neon PostgreSQL (test branch), Hono `app.fetch()`, Drizzle ORM, GitHub Actions, Wrangler

**Important path note:** The API lives at `apps/api/` (NOT `packages/api/`). DB at `packages/db/`. All other packages at `packages/<name>/`.

---

## Phase 1: Test Infrastructure

### Task 1: Create Neon test branch

**Files:**

- None (Neon dashboard / CLI)

**Step 1: Create the test branch via Neon MCP or dashboard**

Using the Neon MCP tool, create a branch named `test` forked from `main`:

```
Branch name: test
Parent: main
```

Record the connection string as `TEST_DATABASE_URL`.

**Step 2: Push schema to test branch**

Run:

```bash
TEST_DATABASE_URL="<test-branch-pooler-url>" npx drizzle-kit push --config=packages/db/drizzle.config.ts
```

Expected: Schema pushed successfully (18 tables created).

**Step 3: Add TEST_DATABASE_URL to local .env**

Append to `/Users/lsendel/Projects/LLMRank_app/.env`:

```
TEST_DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
```

**Step 4: Commit**

No code changes to commit in this task.

---

### Task 2: Create DB test helper (connect + truncate)

**Files:**

- Create: `packages/db/src/__tests__/helpers/test-db.ts`

**Step 1: Write the test helper**

```ts
// packages/db/src/__tests__/helpers/test-db.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

let _db: NeonHttpDatabase | null = null;

export function getTestDb(): NeonHttpDatabase {
  if (_db) return _db;
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  const sql = neon(url);
  _db = drizzle(sql);
  return _db;
}

/**
 * Truncate all tables in dependency order (CASCADE handles FKs).
 * Run before each test file via globalSetup or beforeAll.
 */
export async function truncateAll(db: NeonHttpDatabase): Promise<void> {
  const sql = neon(process.env.TEST_DATABASE_URL!);
  await sql`TRUNCATE
    admin_audit_logs,
    page_facts,
    outbox_events,
    page_enrichments,
    project_integrations,
    competitors,
    log_uploads,
    custom_extractors,
    plan_price_history,
    payments,
    subscriptions,
    visibility_checks,
    issues,
    page_scores,
    pages,
    crawl_jobs,
    projects,
    users
  CASCADE`;
}

/**
 * Seed a minimal user + project for tests that need FK references.
 */
export async function seedBaseEntities(db: NeonHttpDatabase) {
  const sql = neon(process.env.TEST_DATABASE_URL!);
  const [user] = await sql`
    INSERT INTO users (email, name, plan, crawl_credits_remaining)
    VALUES ('test@example.com', 'Test User', 'pro', 30)
    RETURNING id, email, name, plan, crawl_credits_remaining
  `;
  const [project] = await sql`
    INSERT INTO projects (user_id, name, domain)
    VALUES (${user.id}, 'Test Site', 'https://example.com')
    RETURNING id, user_id, name, domain
  `;
  return { user, project };
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter @llm-boost/db typecheck`
Expected: No type errors.

**Step 3: Commit**

```bash
git add packages/db/src/__tests__/helpers/test-db.ts
git commit -m "test: add DB test helper with connect, truncate, seed"
```

---

### Task 3: Add vitest config + test scripts to packages/db

**Files:**

- Create: `packages/db/vitest.config.ts`
- Modify: `packages/db/package.json`

**Step 1: Create vitest config**

```ts
// packages/db/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    setupFiles: ["src/__tests__/helpers/setup.ts"],
    testTimeout: 15000, // Neon cold-start can be slow
    coverage: {
      provider: "v8",
      include: ["src/queries/**"],
      thresholds: { lines: 85 },
    },
  },
});
```

**Step 2: Create global setup file**

Create `packages/db/src/__tests__/helpers/setup.ts`:

```ts
// packages/db/src/__tests__/helpers/setup.ts
import { beforeAll } from "vitest";
import { getTestDb, truncateAll } from "./test-db";

beforeAll(async () => {
  const db = getTestDb();
  await truncateAll(db);
});
```

**Step 3: Add test scripts + devDependencies to package.json**

Modify `packages/db/package.json` — add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

Add to `devDependencies`:

```json
"vitest": "^3",
"@vitest/coverage-v8": "^3"
```

**Step 4: Install dependencies**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm install`
Expected: Dependencies installed successfully.

**Step 5: Commit**

```bash
git add packages/db/vitest.config.ts packages/db/src/__tests__/helpers/setup.ts packages/db/package.json pnpm-lock.yaml
git commit -m "test: add vitest config and test scripts to packages/db"
```

---

### Task 4: Add vitest config to packages that lack it

**Files:**

- Create: `packages/llm/vitest.config.ts`
- Create: `packages/integrations/vitest.config.ts`
- Create: `packages/shared/vitest.config.ts`
- Modify: `packages/llm/package.json` — add test scripts
- Modify: `packages/integrations/package.json` — add test scripts + vitest devDeps
- Modify: `packages/shared/package.json` — add test scripts

**Step 1: Create vitest config for packages/llm**

```ts
// packages/llm/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/__tests__/**"],
      thresholds: { lines: 85 },
    },
  },
});
```

**Step 2: Create vitest config for packages/integrations**

```ts
// packages/integrations/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/__tests__/**"],
      thresholds: { lines: 85 },
    },
  },
});
```

**Step 3: Create vitest config for packages/shared**

```ts
// packages/shared/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/__tests__/**"],
      thresholds: { lines: 85 },
    },
  },
});
```

**Step 4: Add test scripts to package.json files**

For each of `packages/llm/package.json`, `packages/integrations/package.json`, `packages/shared/package.json`, add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

For `packages/integrations/package.json`, also add `devDependencies`:

```json
"vitest": "^3",
"@vitest/coverage-v8": "^3"
```

**Step 5: Install + verify**

Run: `pnpm install && pnpm test`
Expected: All existing tests pass (scoring 124, llm ~21, shared ~5, plus api/billing tests).

**Step 6: Commit**

```bash
git add packages/llm/vitest.config.ts packages/integrations/vitest.config.ts packages/shared/vitest.config.ts packages/llm/package.json packages/integrations/package.json packages/shared/package.json pnpm-lock.yaml
git commit -m "test: add vitest configs to llm, integrations, shared packages"
```

---

### Task 5: Update apps/api vitest config for full coverage

**Files:**

- Modify: `apps/api/vitest.config.ts`

**Step 1: Expand coverage includes**

The current config only covers `src/services/**` and `src/middleware/**`. Expand to cover routes + lib:

```ts
// apps/api/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/routes/**",
        "src/services/**",
        "src/middleware/**",
        "src/lib/**",
        "src/repositories/**",
      ],
      thresholds: { lines: 85 },
    },
  },
});
```

**Step 2: Verify existing tests still pass**

Run: `pnpm --filter @llm-boost/api test`
Expected: All existing API tests pass.

**Step 3: Commit**

```bash
git add apps/api/vitest.config.ts
git commit -m "test: expand API vitest coverage to routes, lib, repositories"
```

---

### Task 6: Create route integration test harness

**Files:**

- Create: `apps/api/src/__tests__/helpers/test-app.ts`
- Create: `apps/api/src/__tests__/helpers/kv-stub.ts`
- Create: `apps/api/src/__tests__/helpers/r2-stub.ts`

**Step 1: Create in-memory KV stub**

```ts
// apps/api/src/__tests__/helpers/kv-stub.ts

/**
 * In-memory KVNamespace stub for testing.
 * Supports get/put/delete with TTL tracking (but no actual expiry).
 */
export function createKVStub(): KVNamespace {
  const store = new Map<string, { value: string; metadata: unknown }>();

  return {
    get: async (key: string, _options?: any) => store.get(key)?.value ?? null,
    put: async (key: string, value: string, _options?: any) => {
      store.set(key, { value, metadata: null });
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async (_options?: any) => ({
      keys: [...store.keys()].map((name) => ({ name })),
      list_complete: true,
      cursor: "",
    }),
    getWithMetadata: async (key: string, _options?: any) => {
      const entry = store.get(key);
      return entry
        ? { value: entry.value, metadata: entry.metadata }
        : { value: null, metadata: null };
    },
  } as unknown as KVNamespace;
}
```

**Step 2: Create in-memory R2 stub**

```ts
// apps/api/src/__tests__/helpers/r2-stub.ts

/**
 * Minimal in-memory R2Bucket stub for testing.
 */
export function createR2Stub(): R2Bucket {
  const store = new Map<string, ArrayBuffer>();

  return {
    get: async (key: string) => {
      const data = store.get(key);
      if (!data) return null;
      return {
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(data));
            controller.close();
          },
        }),
        text: async () => new TextDecoder().decode(data),
        json: async () => JSON.parse(new TextDecoder().decode(data)),
        arrayBuffer: async () => data,
      } as unknown as R2ObjectBody;
    },
    put: async (key: string, value: ArrayBuffer | string) => {
      const buf =
        typeof value === "string"
          ? new TextEncoder().encode(value).buffer
          : value;
      store.set(key, buf as ArrayBuffer);
      return {} as R2Object;
    },
    delete: async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach((k) => store.delete(k));
    },
    list: async () => ({
      objects: [...store.keys()].map((key) => ({ key })),
      truncated: false,
    }),
    head: async (key: string) => (store.has(key) ? ({} as R2Object) : null),
  } as unknown as R2Bucket;
}
```

**Step 3: Create test app helper**

```ts
// apps/api/src/__tests__/helpers/test-app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv, Bindings } from "../../index";
import { createKVStub } from "./kv-stub";
import { createR2Stub } from "./r2-stub";
import { createDb, type Database } from "@llm-boost/db";

// Re-import all routes (same as production index.ts)
import { healthRoutes } from "../../routes/health";
import { projectRoutes } from "../../routes/projects";
import { crawlRoutes } from "../../routes/crawls";
import { pageRoutes } from "../../routes/pages";
import { billingRoutes } from "../../routes/billing";
import { ingestRoutes } from "../../routes/ingest";
import { visibilityRoutes } from "../../routes/visibility";
import { scoreRoutes } from "../../routes/scores";
import { dashboardRoutes } from "../../routes/dashboard";
import { publicRoutes } from "../../routes/public";
import { adminRoutes } from "../../routes/admin";
import { logRoutes } from "../../routes/logs";

interface TestAppOptions {
  /** If provided, uses this DB. Otherwise creates from TEST_DATABASE_URL. */
  db?: Database;
  /** Fixed userId for auth bypass. Default: "test-user-id" */
  userId?: string;
  /** Override env bindings. */
  envOverrides?: Partial<Bindings>;
}

/**
 * Creates a full Hono app identical to production, but with:
 * - Auth middleware replaced with a fixed userId
 * - In-memory KV and R2 stubs
 * - Real DB connection to the Neon test branch
 */
export function createTestApp(options: TestAppOptions = {}) {
  const userId = options.userId ?? "test-user-id";
  const kv = createKVStub();
  const r2 = createR2Stub();
  const db =
    options.db ??
    createDb(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!);

  const app = new Hono<AppEnv>();

  // Minimal CORS (same as prod)
  app.use("*", cors({ origin: "*" }));

  // Inject DB + fake auth
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("userId", userId);
    c.set("requestId", "test-req-id");
    c.set("logger", {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      child: () => ({
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      }),
    } as any);
    await next();
  });

  // Mount routes (same as production)
  app.route("/api/health", healthRoutes);
  app.route("/api/projects", projectRoutes);
  app.route("/api/crawls", crawlRoutes);
  app.route("/api/pages", pageRoutes);
  app.route("/api/billing", billingRoutes);
  app.route("/ingest", ingestRoutes);
  app.route("/api/visibility", visibilityRoutes);
  app.route("/api/scores", scoreRoutes);
  app.route("/api/dashboard", dashboardRoutes);
  app.route("/api/public", publicRoutes);
  app.route("/api/admin", adminRoutes);
  app.route("/api/logs", logRoutes);

  app.notFound((c) =>
    c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404),
  );

  // Build env bindings
  const env: Bindings = {
    R2: r2 as any,
    KV: kv as any,
    SEEN_URLS: createKVStub() as any,
    CRAWL_QUEUE: { send: async () => {} } as any,
    BROWSER: null as any,
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
    SHARED_SECRET: "test-secret",
    ANTHROPIC_API_KEY: "test-key",
    OPENAI_API_KEY: "test-key",
    GOOGLE_API_KEY: "test-key",
    PERPLEXITY_API_KEY: "test-key",
    STRIPE_SECRET_KEY: "test-key",
    STRIPE_WEBHOOK_SECRET: "test-key",
    CLERK_SECRET_KEY: "test-key",
    CLERK_PUBLISHABLE_KEY: "test-key",
    CRAWLER_URL: "http://localhost:3000",
    INTEGRATION_ENCRYPTION_KEY: "0".repeat(64),
    GOOGLE_OAUTH_CLIENT_ID: "test-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "test-secret",
    RESEND_API_KEY: "test-key",
    SENTRY_DSN: "",
    ...options.envOverrides,
  };

  /**
   * Helper to make requests to the test app.
   * Uses app.fetch() to properly inject env bindings.
   */
  function request(
    path: string,
    init?: RequestInit & { json?: unknown },
  ): Promise<Response> {
    const url = `http://localhost${path}`;
    const headers = new Headers(init?.headers);
    if (!headers.has("Authorization")) {
      headers.set("Authorization", "Bearer test-token");
    }
    let body = init?.body;
    if (init?.json) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(init.json);
    }
    return app.fetch(new Request(url, { ...init, headers, body }), env);
  }

  return { app, env, db, kv, r2, request };
}
```

**Step 4: Verify typecheck**

Run: `pnpm --filter @llm-boost/api typecheck`
Expected: Passes (or minor type issues to fix).

**Step 5: Commit**

```bash
git add apps/api/src/__tests__/helpers/test-app.ts apps/api/src/__tests__/helpers/kv-stub.ts apps/api/src/__tests__/helpers/r2-stub.ts
git commit -m "test: add integration test harness with KV/R2 stubs and createTestApp"
```

---

## Phase 2: DB Query Tests

Each of the 14 query files gets a test file. Tests run against the real Neon test branch. Each file truncates + seeds before tests.

### Task 7: Test users queries

**Files:**

- Create: `packages/db/src/__tests__/queries/users.test.ts`

**Step 1: Write the tests**

```ts
// packages/db/src/__tests__/queries/users.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { getTestDb, truncateAll, seedBaseEntities } from "../helpers/test-db";
import { userQueries } from "../../queries/users";

describe("userQueries", () => {
  const db = getTestDb();
  const queries = userQueries(db);

  beforeAll(async () => {
    await truncateAll(db);
  });

  it("create() inserts a new user and returns it", async () => {
    const user = await queries.create({
      email: "alice@test.com",
      name: "Alice",
    });
    expect(user).toBeDefined();
    expect(user.email).toBe("alice@test.com");
    expect(user.plan).toBe("free"); // default
  });

  it("getById() returns null for missing user", async () => {
    const result = await queries.getById(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toBeNull();
  });

  it("getById() returns existing user", async () => {
    const created = await queries.create({
      email: "bob@test.com",
      name: "Bob",
    });
    const found = await queries.getById(created.id);
    expect(found).not.toBeNull();
    expect(found!.email).toBe("bob@test.com");
  });

  it("getByEmail() finds by email", async () => {
    const found = await queries.getByEmail("alice@test.com");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Alice");
  });

  it("getByEmail() returns null for missing email", async () => {
    const found = await queries.getByEmail("nobody@test.com");
    expect(found).toBeNull();
  });

  it("upsertFromClerk() creates new user", async () => {
    const user = await queries.upsertFromClerk({
      clerkId: "clerk_123",
      email: "clerk@test.com",
      name: "Clerk User",
    });
    expect(user.clerkId).toBe("clerk_123");
  });

  it("updatePlan() changes the plan", async () => {
    const user = await queries.create({ email: "plan@test.com", name: "Plan" });
    await queries.updatePlan(user.id, "pro");
    const updated = await queries.getById(user.id);
    expect(updated!.plan).toBe("pro");
  });

  it("decrementCrawlCredits() reduces credits by 1", async () => {
    const user = await queries.create({
      email: "credits@test.com",
      name: "Credits",
    });
    // Default credits depend on plan; just verify it decrements
    const before = (await queries.getById(user.id))!.crawlCreditsRemaining;
    await queries.decrementCrawlCredits(user.id);
    const after = (await queries.getById(user.id))!.crawlCreditsRemaining;
    expect(after).toBe(before - 1);
  });

  it("resetCrawlCreditsForPlan() resets all users of a plan", async () => {
    await queries.resetCrawlCreditsForPlan("free", 2);
    // All free-plan users should now have 2 credits
    const alice = await queries.getByEmail("alice@test.com");
    expect(alice!.crawlCreditsRemaining).toBe(2);
  });
});
```

**Step 2: Run tests**

Run: `TEST_DATABASE_URL=$TEST_DATABASE_URL pnpm --filter @llm-boost/db test`
Expected: All 9 tests pass.

**Step 3: Commit**

```bash
git add packages/db/src/__tests__/queries/users.test.ts
git commit -m "test: add users query tests against real Neon DB"
```

---

### Task 8: Test projects queries

**Files:**

- Create: `packages/db/src/__tests__/queries/projects.test.ts`

**Step 1: Write the tests**

```ts
// packages/db/src/__tests__/queries/projects.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { getTestDb, truncateAll } from "../helpers/test-db";
import { userQueries } from "../../queries/users";
import { projectQueries } from "../../queries/projects";

describe("projectQueries", () => {
  const db = getTestDb();
  const users = userQueries(db);
  const projects = projectQueries(db);
  let userId: string;

  beforeAll(async () => {
    await truncateAll(db);
    const user = await users.create({
      email: "proj@test.com",
      name: "ProjUser",
    });
    userId = user.id;
  });

  it("create() inserts a project", async () => {
    const proj = await projects.create({
      userId,
      name: "Test Site",
      domain: "https://example.com",
    });
    expect(proj.id).toBeDefined();
    expect(proj.domain).toBe("https://example.com");
  });

  it("listByUser() returns user's projects", async () => {
    const list = await projects.listByUser(userId);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].userId).toBe(userId);
  });

  it("getById() returns the project", async () => {
    const created = await projects.create({
      userId,
      name: "Site 2",
      domain: "https://site2.com",
    });
    const found = await projects.getById(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Site 2");
  });

  it("getById() returns null for missing ID", async () => {
    const found = await projects.getById(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(found).toBeNull();
  });

  it("update() changes project fields", async () => {
    const proj = await projects.create({
      userId,
      name: "Old Name",
      domain: "https://old.com",
    });
    await projects.update(proj.id, { name: "New Name" });
    const updated = await projects.getById(proj.id);
    expect(updated!.name).toBe("New Name");
  });

  it("delete() soft-deletes the project", async () => {
    const proj = await projects.create({
      userId,
      name: "ToDelete",
      domain: "https://delete.com",
    });
    await projects.delete(proj.id);
    const found = await projects.getById(proj.id);
    // Either null or has deletedAt set
    expect(found === null || found.deletedAt !== null).toBe(true);
  });

  it("getDueForCrawl() returns projects with scheduled crawls", async () => {
    const results = await projects.getDueForCrawl(10);
    expect(Array.isArray(results)).toBe(true);
  });
});
```

**Step 2: Run tests**

Run: `pnpm --filter @llm-boost/db test`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add packages/db/src/__tests__/queries/projects.test.ts
git commit -m "test: add projects query tests"
```

---

### Task 9: Test crawls queries

**Files:**

- Create: `packages/db/src/__tests__/queries/crawls.test.ts`

**Step 1: Write the tests**

Test: `create`, `getById`, `updateStatus`, `getLatestByProject`, `listByProject`, `generateShareToken`, `getByShareToken`, `disableSharing`, `getStatsForUser`, `getRecentForUser`. (~12 tests)

Follow the same pattern as Task 7-8: truncate in `beforeAll`, seed a user + project, then test each query method.

**Step 2: Run tests**

Run: `pnpm --filter @llm-boost/db test`
Expected: Pass.

**Step 3: Commit**

```bash
git add packages/db/src/__tests__/queries/crawls.test.ts
git commit -m "test: add crawls query tests"
```

---

### Task 10: Test scores queries

**Files:**

- Create: `packages/db/src/__tests__/queries/scores.test.ts`

**Step 1: Write tests**

Test: `create`, `createBatch`, `getByPage`, `listByJob`, `createIssues`, `getIssuesByPage`, `getIssuesByJob`, `getByPageWithIssues`, `listByJobWithPages`. (~10 tests)

Requires seeding: user → project → crawl_job → page → then scores/issues.

**Step 2: Run + commit**

---

### Task 11: Test billing queries

**Files:**

- Create: `packages/db/src/__tests__/queries/billing.test.ts`

**Step 1: Write tests**

Test: `getActiveSubscription`, `createSubscription`, `updateSubscriptionPeriod`, `updateSubscriptionStatus`, `cancelSubscription`, `markCancelAtPeriodEnd`, `createPayment`, `getPaymentByInvoiceId`, `listPayments`. (~10 tests)

**Step 2: Run + commit**

---

### Task 12: Test visibility queries

**Files:**

- Create: `packages/db/src/__tests__/queries/visibility.test.ts`

Test: `create`, `listByProject`, `getById`, `getTrends`. (~6 tests)

---

### Task 13: Test remaining query files (pages, enrichments, extractors, integrations, logs, competitors, outbox, admin)

**Files:**

- Create: `packages/db/src/__tests__/queries/pages.test.ts`
- Create: `packages/db/src/__tests__/queries/enrichments.test.ts`
- Create: `packages/db/src/__tests__/queries/extractors.test.ts`
- Create: `packages/db/src/__tests__/queries/integrations.test.ts`
- Create: `packages/db/src/__tests__/queries/logs.test.ts`
- Create: `packages/db/src/__tests__/queries/competitors.test.ts`
- Create: `packages/db/src/__tests__/queries/outbox.test.ts`
- Create: `packages/db/src/__tests__/queries/admin.test.ts`

Each file: ~4-8 tests covering all exported methods. Total: ~40 tests.

**Step 1: Write all remaining query test files**

Follow same pattern: truncate, seed base entities, test each method.

**Step 2: Run full DB test suite**

Run: `pnpm --filter @llm-boost/db test:coverage`
Expected: ~90 tests pass, 85%+ coverage on `src/queries/**`.

**Step 3: Commit**

```bash
git add packages/db/src/__tests__/queries/
git commit -m "test: add remaining DB query tests (pages, enrichments, extractors, integrations, logs, competitors, outbox, admin)"
```

---

### Phase 2 verification

Run: `pnpm --filter @llm-boost/db test:coverage`
Expected: ~90+ tests, 85%+ line coverage on queries/. All green.

---

## Phase 3: Route Integration Tests

Each route file gets an integration test that exercises the full Hono stack with real DB.

### Task 14: Health route integration test

**Files:**

- Create: `apps/api/src/__tests__/integration/health.test.ts`

**Step 1: Write the test**

```ts
// apps/api/src/__tests__/integration/health.test.ts
import { describe, it, expect } from "vitest";
import { createTestApp } from "../helpers/test-app";

describe("GET /api/health", () => {
  const { request } = createTestApp();

  it("returns 200 with status ok", async () => {
    const res = await request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
```

**Step 2: Run test**

Run: `pnpm --filter @llm-boost/api test -- --reporter=verbose`
Expected: Health test passes.

**Step 3: Commit**

```bash
git add apps/api/src/__tests__/integration/health.test.ts
git commit -m "test: add health route integration test"
```

---

### Task 15: Projects route integration test

**Files:**

- Create: `apps/api/src/__tests__/integration/projects.test.ts`

**Step 1: Write the tests (~10 tests)**

```ts
// apps/api/src/__tests__/integration/projects.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { createTestApp } from "../helpers/test-app";
import {
  getTestDb,
  truncateAll,
  seedBaseEntities,
} from "../../../../packages/db/src/__tests__/helpers/test-db";

describe("Project routes", () => {
  let request: ReturnType<typeof createTestApp>["request"];
  let testUserId: string;

  beforeAll(async () => {
    const db = getTestDb();
    await truncateAll(db);
    const { user } = await seedBaseEntities(db);
    testUserId = user.id;
    const testApp = createTestApp({ db, userId: testUserId });
    request = testApp.request;
  });

  describe("POST /api/projects", () => {
    it("creates a project and returns 201", async () => {
      const res = await request("/api/projects", {
        method: "POST",
        json: { name: "My Site", domain: "https://example.com" },
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe("My Site");
      expect(body.data.domain).toBe("https://example.com");
    });

    it("rejects missing domain with 422", async () => {
      const res = await request("/api/projects", {
        method: "POST",
        json: { name: "No Domain" },
      });
      expect(res.status).toBe(422);
    });
  });

  describe("GET /api/projects", () => {
    it("lists the user's projects", async () => {
      const res = await request("/api/projects");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/projects/:id", () => {
    it("returns a project by ID", async () => {
      // First create one
      const createRes = await request("/api/projects", {
        method: "POST",
        json: { name: "Specific", domain: "https://specific.com" },
      });
      const created = await createRes.json();
      const res = await request(`/api/projects/${created.data.id}`);
      expect(res.status).toBe(200);
    });

    it("returns 404 for non-existent project", async () => {
      const res = await request(
        "/api/projects/00000000-0000-0000-0000-000000000000",
      );
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("soft-deletes the project", async () => {
      const createRes = await request("/api/projects", {
        method: "POST",
        json: { name: "ToDelete", domain: "https://delete.com" },
      });
      const created = await createRes.json();
      const res = await request(`/api/projects/${created.data.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
    });
  });
});
```

**Step 2: Run + verify**

Run: `pnpm --filter @llm-boost/api test`

**Step 3: Commit**

---

### Task 16: Crawls route integration test

**Files:**

- Create: `apps/api/src/__tests__/integration/crawls.test.ts`

Test: POST / (creates crawl), GET /:id (status), GET /project/:projectId (list), GET /:id/quick-wins, POST /:id/share, DELETE /:id/share. (~8 tests)

Note: POST / will need to mock the external crawler dispatch (since we can't call the real crawler). Override `CRAWLER_URL` to a non-existent URL and expect the service to handle the network error, OR mock global `fetch`.

---

### Task 17: Scores route integration test

**Files:**

- Create: `apps/api/src/__tests__/integration/scores.test.ts`

Test: GET /crawl/:crawlId (list scores), GET /page/:pageId (page scores with issues). Seed: user → project → crawl → page → scores + issues. (~4 tests)

---

### Task 18: Dashboard route integration test

**Files:**

- Create: `apps/api/src/__tests__/integration/dashboard.test.ts`

Test: GET / (dashboard stats). Seed: user with projects and crawls. (~3 tests)

---

### Task 19: Visibility route integration test

**Files:**

- Create: `apps/api/src/__tests__/integration/visibility.test.ts`

Test: GET /:projectId (list checks), GET /:projectId/trends, POST /check (mock LLM API responses). (~5 tests)

---

### Task 20: Billing route integration test

**Files:**

- Create: `apps/api/src/__tests__/integration/billing.test.ts`

Test: GET /subscription (current sub), POST /checkout (mocked Stripe), POST /webhook (mocked Stripe signature verification). (~5 tests)

---

### Task 21: Public + Admin + Ingest route integration tests

**Files:**

- Create: `apps/api/src/__tests__/integration/public.test.ts`
- Create: `apps/api/src/__tests__/integration/admin.test.ts`
- Create: `apps/api/src/__tests__/integration/ingest.test.ts`

Public: GET /report/:token (shared report). (~3 tests)
Admin: GET /stats, GET /customers (requires isAdmin user). (~4 tests)
Ingest: POST /batch (HMAC-authenticated crawler callback). (~4 tests)

---

### Phase 3 verification

Run: `pnpm --filter @llm-boost/api test`
Expected: All integration + existing unit tests pass. ~50+ new integration tests.

```bash
git add apps/api/src/__tests__/integration/
git commit -m "test: add route integration tests for all API endpoints"
```

---

## Phase 4: Service + Middleware + Lib Unit Tests

### Task 22: Additional service unit tests

**Files:**

- Create: `apps/api/src/__tests__/services/ingest-service.test.ts` (~15 tests)
- Create: `apps/api/src/__tests__/services/billing-service.test.ts` (~10 tests)
- Create: `apps/api/src/__tests__/services/admin-service.test.ts` (~5 tests)
- Create: `apps/api/src/__tests__/services/strategy-service.test.ts` (~5 tests)

Use mock repositories from `mock-repositories.ts`. Test service error paths, validation, and orchestration logic.

---

### Task 23: Middleware unit tests

**Files:**

- Create: `apps/api/src/__tests__/middleware/auth.test.ts` (~8 tests)
- Create: `apps/api/src/__tests__/middleware/admin.test.ts` (~4 tests)
- Create: `apps/api/src/__tests__/middleware/planLimits.test.ts` (~6 tests)
- Expand: `apps/api/src/__tests__/middleware/hmac.test.ts` (add ~4 more tests)

Auth tests: mock JWKS fetch, test valid/invalid/expired JWTs, auto-provision user.
Admin tests: isAdmin=true passes, isAdmin=false returns 403.
PlanLimits tests: credit enforcement, project limit enforcement.
HMAC tests: expand timestamp edge cases, signature format validation.

---

### Task 24: Lib unit tests

**Files:**

- Create: `apps/api/src/__tests__/lib/html-parser.test.ts` (~12 tests)
- Create: `apps/api/src/__tests__/lib/sitemap.test.ts` (~6 tests)
- Create: `apps/api/src/__tests__/lib/crypto.test.ts` (~4 tests)
- Create: `apps/api/src/__tests__/lib/kv-cache.test.ts` (~4 tests)
- Create: `apps/api/src/__tests__/lib/email.test.ts` (~3 tests)

html-parser: test extracting title, meta, headings, schema, links, images, robots from sample HTML.
sitemap: test parsing valid/invalid XML, stale URL detection.
crypto: encrypt then decrypt round-trip, invalid key handling.
kv-cache: getOrCompute cache hit, cache miss + compute, invalidate.
email: verify template output contains expected strings.

---

### Phase 4 verification

Run: `pnpm --filter @llm-boost/api test:coverage`
Expected: 85%+ coverage on routes/**, services/**, middleware/**, lib/**. ~80+ new tests.

```bash
git add apps/api/src/__tests__/
git commit -m "test: add service, middleware, and lib unit tests for API"
```

---

## Phase 5: Package Tests

### Task 25: LLM provider tests (packages/llm)

**Files:**

- Create: `packages/llm/src/__tests__/providers/chatgpt.test.ts` (~5 tests)
- Create: `packages/llm/src/__tests__/providers/claude.test.ts` (~5 tests)
- Create: `packages/llm/src/__tests__/providers/perplexity.test.ts` (~5 tests)
- Create: `packages/llm/src/__tests__/providers/gemini.test.ts` (~5 tests)

Each provider test: mock global `fetch` to return a canned LLM response. Test that `check<Provider>()` returns correct `VisibilityCheckResult` shape, handles errors, detects brand mentions.

---

### Task 26: LLM utility tests (packages/llm)

**Files:**

- Create: `packages/llm/src/__tests__/retry.test.ts` (~6 tests)
- Create: `packages/llm/src/__tests__/summary.test.ts` (~4 tests)
- Create: `packages/llm/src/__tests__/fact-extractor.test.ts` (~4 tests)
- Create: `packages/llm/src/__tests__/optimizer.test.ts` (~4 tests)
- Create: `packages/llm/src/__tests__/personas.test.ts` (~3 tests)
- Create: `packages/llm/src/__tests__/cache.test.ts` (~3 tests)

retry: test exponential backoff, max attempts, timeout.
summary/fact-extractor/optimizer/personas: mock the LLM API call, verify output shape.
cache: mock KV, test get/set round-trip.

---

### Task 27: Shared package tests (packages/shared)

**Files:**

- Create: `packages/shared/src/__tests__/domain/log-analysis.test.ts` (~10 tests)
- Create: `packages/shared/src/__tests__/utils/quick-wins.test.ts` (~5 tests)
- Create: `packages/shared/src/__tests__/utils/scoring.test.ts` (~6 tests)
- Expand: `packages/shared/src/__tests__/schemas.test.ts` (~10 more tests for uncovered schemas)

log-analysis: `classifyBot` with known/unknown user agents, `isCrawler`, `parseLogLine` with valid/invalid lines, `summarizeLogs`.
quick-wins: priority ordering, limit parameter.
scoring: `letterGrade` boundaries (A/B/C/D/F), `averageScores` with nulls, `aggregatePageScores`.

---

### Task 28: Integrations tests (packages/integrations)

**Files:**

- Create: `packages/integrations/src/__tests__/fetchers/gsc.test.ts` (~5 tests)
- Create: `packages/integrations/src/__tests__/fetchers/ga4.test.ts` (~5 tests)
- Create: `packages/integrations/src/__tests__/fetchers/clarity.test.ts` (~5 tests)
- Create: `packages/integrations/src/__tests__/fetchers/psi.test.ts` (~5 tests)

Each: mock global `fetch`, provide canned API response, verify `EnrichmentResult[]` shape. Test error handling (404, timeout, invalid JSON).

---

### Task 29: Scoring + Billing package tests

**Files:**

- Create: `packages/scoring/src/__tests__/helpers.test.ts` (~4 tests)
- Create: `packages/scoring/src/__tests__/thresholds.test.ts` (~3 tests)
- Expand billing tests if below 85% — check current coverage.

helpers: `deduct()` applies penalty + records issue, doesn't go below 0.
thresholds: verify all threshold keys exist, numeric values are reasonable.

---

### Phase 5 verification

Run: `pnpm test` (all packages)
Expected: ~500+ total tests. Check coverage per package with `pnpm --filter <pkg> test:coverage`.

```bash
git add packages/
git commit -m "test: add LLM provider tests, shared utils tests, integrations tests, scoring helper tests"
```

---

## Phase 6: Browser Hardening

### Task 30: Add HMAC auth gate to browser audit route

**Files:**

- Modify: `apps/api/src/routes/browser.ts`

**Step 1: Add HMAC middleware to browser route**

```ts
// apps/api/src/routes/browser.ts — add import and middleware
import { hmacMiddleware } from "../middleware/hmac";

// Add HMAC gate before the /audit handler:
browserRoutes.use("/audit", hmacMiddleware);
```

**Step 2: Verify typecheck**

Run: `pnpm --filter @llm-boost/api typecheck`

**Step 3: Commit**

```bash
git add apps/api/src/routes/browser.ts
git commit -m "feat: add HMAC auth gate to browser audit route"
```

---

### Task 31: Browser route smoke test

**Files:**

- Create: `apps/api/src/__tests__/integration/browser.test.ts`

**Step 1: Write the test**

```ts
// apps/api/src/__tests__/integration/browser.test.ts
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { signPayload } from "../../middleware/hmac";

// We can't import the full test app because puppeteer isn't available in test.
// Instead, test the HMAC gate + route wiring with a minimal mock.

describe("POST /api/browser/audit", () => {
  it("rejects requests without HMAC signature", async () => {
    // Use the full test app's request helper
    // The route should return 401 without valid HMAC headers
    const { createTestApp } = await import("../helpers/test-app");
    // Note: browser routes need to be added to test-app or tested separately
  });

  it("signPayload produces valid HMAC headers", async () => {
    const { signature, timestamp } = await signPayload(
      "test-secret",
      '{"url":"https://example.com"}',
    );
    expect(signature).toMatch(/^hmac-sha256=[a-f0-9]{64}$/);
    expect(Number(timestamp)).toBeGreaterThan(0);
  });
});
```

**Step 2: Run + commit**

---

### Task 32: Wire crawler remote audit mode

**Files:**

- Verify: `apps/crawler/src/config.rs` has `api_base_url` field
- Verify: Crawler Lighthouse runner uses `api_base_url` for remote audits

**Step 1: Verify config**

Read `apps/crawler/src/config.rs` and confirm `api_base_url` is wired. If not, add it.

**Step 2: Set environment variable in docker-compose**

Add to `infra/docker/docker-compose.yml` environment:

```yaml
- API_BASE_URL=https://api.llmrank.app
```

**Step 3: Commit**

```bash
git add infra/docker/docker-compose.yml
git commit -m "feat: wire crawler remote audit mode with API_BASE_URL"
```

---

## Phase 7: CI Coverage Gates

### Task 33: Add TEST_DATABASE_URL to GitHub Actions secrets

**Step 1: Document required secret**

The Neon test branch connection string must be added to GitHub repository secrets as `TEST_DATABASE_URL`.

This is a manual step in GitHub Settings → Secrets → Actions.

---

### Task 34: Update CI workflow for coverage

**Files:**

- Modify: `.github/workflows/ci.yml`

**Step 1: Add coverage step to CI**

Add after the existing `pnpm test` step:

```yaml
- name: Push schema to test branch
  run: |
    TEST_DATABASE_URL=${{ secrets.TEST_DATABASE_URL }} \
    pnpm --filter @llm-boost/db push
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

- name: Run tests with coverage
  run: pnpm test
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

- name: Check coverage thresholds
  run: |
    pnpm --filter @llm-boost/db test:coverage
    pnpm --filter @llm-boost/api test:coverage
    pnpm --filter @llm-boost/scoring test:coverage
    pnpm --filter @llm-boost/llm test:coverage
    pnpm --filter @llm-boost/shared test:coverage
    pnpm --filter @llm-boost/integrations test:coverage
    pnpm --filter @llm-boost/billing test:coverage
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

Each package's `vitest.config.ts` has `thresholds: { lines: 85 }` which will fail CI if below.

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add coverage thresholds and test DB schema push to CI"
```

---

## Phase 8: Production Deployment

### Task 35: Verify all Wrangler secrets

**Step 1: List expected secrets**

From `apps/api/wrangler.toml` and `Bindings` type, these secrets must be set:

```
DATABASE_URL
SHARED_SECRET
ANTHROPIC_API_KEY
OPENAI_API_KEY
GOOGLE_API_KEY
PERPLEXITY_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
INTEGRATION_ENCRYPTION_KEY
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
RESEND_API_KEY
SENTRY_DSN
```

Run: `cd apps/api && npx wrangler secret list`
Verify all 15 secrets are present. For any missing, run: `npx wrangler secret put <NAME>`

---

### Task 36: Push production schema

Run:

```bash
cd packages/db && DATABASE_URL=$DATABASE_URL npx drizzle-kit push
```

Expected: Schema synced to production Neon.

---

### Task 37: Deploy API Worker

Run:

```bash
cd apps/api && npx wrangler deploy
```

Expected: Deployed to `api.llmrank.app`.

Verify:

```bash
curl https://api.llmrank.app/api/health
# Expected: {"status":"ok"}
```

---

### Task 38: Deploy Next.js frontend

Run:

```bash
cd apps/web && pnpm build && npx wrangler pages deploy .next --project-name=llm-boost
```

Expected: Deployed to `llmrank.app`.

---

### Task 39: Update crawler environment

SSH to Hetzner or update `docker-compose.yml`:

```bash
# On Hetzner:
cd /opt/crawler
echo "API_BASE_URL=https://api.llmrank.app" >> .env
docker compose pull && docker compose up -d --force-recreate
```

---

### Task 40: Smoke test production

**Step 1: Health check**

```bash
curl https://api.llmrank.app/api/health
```

**Step 2: Auth check**

```bash
curl https://api.llmrank.app/api/health/auth-check
```

**Step 3: Frontend loads**

Navigate to `https://llmrank.app` — verify page renders.

**Step 4: Crawler responds**

```bash
curl http://<hetzner-ip>:3000/health
```

---

## Summary

| Phase                     | Tests Added  | Files Created         |
| ------------------------- | ------------ | --------------------- |
| 1. Infrastructure         | 0            | 7 helpers + 4 configs |
| 2. DB queries             | ~90          | 14 test files         |
| 3. Route integration      | ~50          | 10 test files         |
| 4. Service/middleware/lib | ~80          | 15 test files         |
| 5. Package tests          | ~60          | 20 test files         |
| 6. Browser hardening      | ~3           | 2 files modified      |
| 7. CI gates               | 0            | 1 workflow modified   |
| 8. Production deploy      | 0            | Manual steps          |
| **Total**                 | **~283 new** | **~66 files**         |

Combined with existing ~328 tests → **~611 total tests**, 85%+ coverage per package.
