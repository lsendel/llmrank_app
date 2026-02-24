# URL Normalization, HTTPS Enforcement & Admin Controls — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Normalize all domain inputs (strip protocol, www, trailing slash), enforce HTTPS-first crawling with per-project HTTP fallback for paid plans, and add an admin-managed domain blocklist.

**Architecture:** A shared `normalizeDomain()` utility applied at frontend blur, Zod schema transform, and API validation layers. Two new DB tables (`blocked_domains`, `admin_settings`) with Drizzle ORM. Admin CRUD endpoints in Hono. Crawler dispatch prepends `https://` and conditionally allows HTTP fallback. Frontend inputs show clean domains everywhere.

**Tech Stack:** TypeScript, Zod, Drizzle ORM (Neon PG), Hono (Cloudflare Workers), Next.js (App Router), Vitest

**Design doc:** `docs/plans/2026-02-24-url-normalization-https-enforcement-design.md`

---

### Task 1: normalizeDomain Utility + Tests

**Files:**

- Create: `packages/shared/src/utils/normalize-domain.ts`
- Create: `packages/shared/src/__tests__/normalize-domain.test.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing tests**

```typescript
// packages/shared/src/__tests__/normalize-domain.test.ts
import { describe, it, expect } from "vitest";
import { normalizeDomain } from "../utils/normalize-domain";

describe("normalizeDomain", () => {
  it("strips https:// prefix", () => {
    expect(normalizeDomain("https://example.com")).toBe("example.com");
  });

  it("strips http:// prefix", () => {
    expect(normalizeDomain("http://example.com")).toBe("example.com");
  });

  it("strips www. prefix", () => {
    expect(normalizeDomain("www.example.com")).toBe("example.com");
  });

  it("strips both protocol and www", () => {
    expect(normalizeDomain("https://www.example.com")).toBe("example.com");
  });

  it("strips trailing slash", () => {
    expect(normalizeDomain("https://example.com/")).toBe("example.com");
  });

  it("strips path after domain", () => {
    expect(normalizeDomain("https://example.com/about/team")).toBe(
      "example.com",
    );
  });

  it("preserves subdomains other than www", () => {
    expect(normalizeDomain("https://blog.example.com")).toBe(
      "blog.example.com",
    );
    expect(normalizeDomain("shop.example.com")).toBe("shop.example.com");
    expect(normalizeDomain("https://app.staging.example.com")).toBe(
      "app.staging.example.com",
    );
  });

  it("strips www from subdomain chains", () => {
    expect(normalizeDomain("https://www.blog.example.com")).toBe(
      "blog.example.com",
    );
  });

  it("lowercases the domain", () => {
    expect(normalizeDomain("HTTPS://WWW.Example.COM")).toBe("example.com");
    expect(normalizeDomain("Blog.EXAMPLE.com")).toBe("blog.example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeDomain("  example.com  ")).toBe("example.com");
    expect(normalizeDomain("  https://www.example.com/  ")).toBe("example.com");
  });

  it("handles already-clean domains", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
    expect(normalizeDomain("blog.example.com")).toBe("blog.example.com");
  });

  it("handles protocol with trailing slashes", () => {
    expect(normalizeDomain("https://example.com///")).toBe("example.com");
  });

  it("strips query strings and fragments", () => {
    expect(normalizeDomain("https://example.com?ref=google")).toBe(
      "example.com",
    );
    expect(normalizeDomain("https://example.com#section")).toBe("example.com");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeDomain("")).toBe("");
    expect(normalizeDomain("   ")).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @llm-boost/shared vitest run src/__tests__/normalize-domain.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// packages/shared/src/utils/normalize-domain.ts

/**
 * Normalize a domain input: strip protocol, www., trailing slash, path, query, fragment.
 * Preserves subdomains other than www. Returns lowercase.
 */
export function normalizeDomain(input: string): string {
  let d = input.trim();
  if (!d) return "";

  // Strip protocol
  d = d.replace(/^https?:\/\//i, "");

  // Strip www. prefix (but not other subdomains)
  d = d.replace(/^www\./i, "");

  // Extract just the hostname (strip path, query, fragment)
  // Use the first segment before /, ?, or #
  const hostEnd = d.search(/[/?#]/);
  if (hostEnd !== -1) {
    d = d.slice(0, hostEnd);
  }

  // Strip any trailing dots or slashes
  d = d.replace(/[./]+$/, "");

  return d.toLowerCase();
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @llm-boost/shared vitest run src/__tests__/normalize-domain.test.ts`
Expected: All 15 tests PASS

**Step 5: Export from shared index**

Add to `packages/shared/src/index.ts`:

```typescript
export { normalizeDomain } from "./utils/normalize-domain";
```

**Step 6: Commit**

```bash
git add packages/shared/src/utils/normalize-domain.ts packages/shared/src/__tests__/normalize-domain.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add normalizeDomain utility with tests"
```

---

### Task 2: Update CreateProjectSchema to Use normalizeDomain

**Files:**

- Modify: `packages/shared/src/schemas/project.ts`
- Modify: `packages/shared/src/__tests__/schemas.test.ts`

**Step 1: Update the existing schema tests**

In `packages/shared/src/__tests__/schemas.test.ts`, update the CreateProjectSchema tests:

```typescript
// Replace the existing CreateProjectSchema describe block:
describe("CreateProjectSchema", () => {
  it("normalizes domain by stripping protocol and www", () => {
    const result = CreateProjectSchema.parse({
      name: "My Site",
      domain: "https://www.example.com/",
    });
    expect(result.domain).toBe("example.com");
  });

  it("normalizes bare domain input", () => {
    const result = CreateProjectSchema.parse({
      name: "My Site",
      domain: "example.com",
    });
    expect(result.domain).toBe("example.com");
  });

  it("preserves subdomains", () => {
    const result = CreateProjectSchema.parse({
      name: "My Blog",
      domain: "https://blog.example.com",
    });
    expect(result.domain).toBe("blog.example.com");
  });

  it("lowercases domain", () => {
    const result = CreateProjectSchema.parse({
      name: "My Site",
      domain: "WWW.Example.COM",
    });
    expect(result.domain).toBe("example.com");
  });

  it("rejects empty name", () => {
    expect(() =>
      CreateProjectSchema.parse({ name: "", domain: "example.com" }),
    ).toThrow();
  });

  it("rejects empty domain", () => {
    expect(() =>
      CreateProjectSchema.parse({ name: "Test", domain: "" }),
    ).toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @llm-boost/shared vitest run src/__tests__/schemas.test.ts`
Expected: FAIL — "normalizes domain" tests fail because schema still prepends `https://`

**Step 3: Update the schema**

In `packages/shared/src/schemas/project.ts`:

```typescript
import { z } from "zod";
import { normalizeDomain } from "../utils/normalize-domain";

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z
    .string()
    .min(1)
    .transform((d) => normalizeDomain(d))
    .pipe(z.string().min(1, "Please enter a valid domain")),
});
```

Note: We no longer validate with `.url()` since we store clean domains without protocol. Instead we validate it's non-empty after normalization.

Also add `allowHttpFallback` to `UpdateProjectSchema.settings`:

```typescript
export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z
    .object({
      maxPages: z.number().int().min(1).optional(),
      maxDepth: z.number().int().min(1).max(10).optional(),
      schedule: z.enum(["manual", "daily", "weekly", "monthly"]).optional(),
      ignoreRobots: z.boolean().optional(),
      allowHttpFallback: z.boolean().optional(),
    })
    .optional(),
  branding: z
    .object({
      logoUrl: z.string().url().optional().or(z.literal("")),
      companyName: z.string().optional(),
      primaryColor: z
        .string()
        .regex(/^#([0-9a-f]{3}){1,2}$/i)
        .optional(),
    })
    .optional(),
});
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @llm-boost/shared vitest run src/__tests__/schemas.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add packages/shared/src/schemas/project.ts packages/shared/src/__tests__/schemas.test.ts
git commit -m "feat(shared): use normalizeDomain in CreateProjectSchema, add allowHttpFallback setting"
```

---

### Task 3: Database Schema — blocked_domains and admin_settings Tables

**Files:**

- Create: `packages/db/src/schema/admin.ts`
- Modify: `packages/db/src/schema/index.ts` (or wherever schemas are re-exported)

**Step 1: Create the admin schema file**

```typescript
// packages/db/src/schema/admin.ts
import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./identity";

export const blockedDomains = pgTable("blocked_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: text("domain").notNull().unique(),
  reason: text("reason"),
  blockedBy: text("blocked_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminSettings = pgTable("admin_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedBy: text("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Step 2: Export from schema index**

Check `packages/db/src/schema/index.ts` and add:

```typescript
export * from "./admin";
```

**Step 3: Push schema to dev database**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Tables `blocked_domains` and `admin_settings` created

**Step 4: Commit**

```bash
git add packages/db/src/schema/admin.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add blocked_domains and admin_settings tables"
```

---

### Task 4: Database Query Helpers for Admin Tables

**Files:**

- Create: `packages/db/src/queries/admin.ts`
- Modify: `packages/db/src/queries/index.ts` (export the new queries)

**Step 1: Write query helpers**

```typescript
// packages/db/src/queries/admin.ts
import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { blockedDomains, adminSettings } from "../schema/admin";

export function adminQueries(db: NeonHttpDatabase) {
  return {
    // --- Blocked Domains ---

    async listBlockedDomains() {
      return db.select().from(blockedDomains).orderBy(blockedDomains.createdAt);
    },

    async isBlocked(domain: string): Promise<boolean> {
      const rows = await db
        .select({ id: blockedDomains.id })
        .from(blockedDomains)
        .where(eq(blockedDomains.domain, domain.toLowerCase()))
        .limit(1);
      return rows.length > 0;
    },

    async addBlockedDomain(
      domain: string,
      reason: string | null,
      blockedBy: string,
    ) {
      const [row] = await db
        .insert(blockedDomains)
        .values({ domain: domain.toLowerCase(), reason, blockedBy })
        .returning();
      return row;
    },

    async removeBlockedDomain(id: string) {
      const [row] = await db
        .delete(blockedDomains)
        .where(eq(blockedDomains.id, id))
        .returning();
      return row;
    },

    // --- Admin Settings ---

    async getSetting(key: string) {
      const rows = await db
        .select()
        .from(adminSettings)
        .where(eq(adminSettings.key, key))
        .limit(1);
      return rows[0] ?? null;
    },

    async setSetting(key: string, value: unknown, updatedBy: string) {
      const [row] = await db
        .insert(adminSettings)
        .values({ key, value, updatedBy, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: adminSettings.key,
          set: { value, updatedBy, updatedAt: new Date() },
        })
        .returning();
      return row;
    },

    async isHttpFallbackEnabled(): Promise<boolean> {
      const setting = await this.getSetting("http_fallback_enabled");
      return setting?.value === true;
    },
  };
}
```

**Step 2: Export from queries index**

Check `packages/db/src/queries/index.ts` and add:

```typescript
export { adminQueries } from "./admin";
```

**Step 3: Commit**

```bash
git add packages/db/src/queries/admin.ts packages/db/src/queries/index.ts
git commit -m "feat(db): add query helpers for blocked_domains and admin_settings"
```

---

### Task 5: API — Admin Endpoints for Blocklist and Settings

**Files:**

- Modify: `apps/api/src/routes/admin.ts`

**Step 1: Add the new admin routes**

Add these routes inside the existing admin router (after existing endpoints). The router already has `adminMiddleware` applied.

```typescript
// --- Blocked Domains ---

.get("/admin/blocked-domains", async (c) => {
  const db = c.get("db");
  const queries = adminQueries(db);
  const domains = await queries.listBlockedDomains();
  return c.json({ data: domains });
})

.post("/admin/blocked-domains", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const body = await c.req.json();

  const domain = normalizeDomain(body.domain ?? "");
  if (!domain) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Domain is required" } },
      422,
    );
  }

  const queries = adminQueries(db);
  const existing = await queries.isBlocked(domain);
  if (existing) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "Domain is already blocked" } },
      409,
    );
  }

  const row = await queries.addBlockedDomain(domain, body.reason ?? null, user.id);
  return c.json({ data: row }, 201);
})

.delete("/admin/blocked-domains/:id", async (c) => {
  const db = c.get("db");
  const queries = adminQueries(db);
  const row = await queries.removeBlockedDomain(c.req.param("id"));
  if (!row) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Blocked domain not found" } },
      404,
    );
  }
  return c.json({ data: row });
})

// --- Admin Settings ---

.get("/admin/settings", async (c) => {
  const db = c.get("db");
  const queries = adminQueries(db);
  const httpFallback = await queries.getSetting("http_fallback_enabled");
  return c.json({
    data: {
      http_fallback_enabled: httpFallback?.value === true,
    },
  });
})

.put("/admin/settings/:key", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const key = c.req.param("key");
  const body = await c.req.json();

  const allowedKeys = ["http_fallback_enabled"];
  if (!allowedKeys.includes(key)) {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: `Unknown setting: ${key}` } },
      422,
    );
  }

  const row = await queries.setSetting(key, body.value, user.id);
  return c.json({ data: row });
})
```

Import `normalizeDomain` from `@llm-boost/shared` and `adminQueries` from `@llm-boost/db` at the top of the file.

**Step 2: Commit**

```bash
git add apps/api/src/routes/admin.ts
git commit -m "feat(api): add admin endpoints for blocked domains and settings"
```

---

### Task 6: API — Blocklist Enforcement in Public Scan, Project Creation, Crawl Start

**Files:**

- Modify: `apps/api/src/routes/public.ts`
- Modify: `apps/api/src/routes/projects.ts` (or wherever project creation lives)
- Modify: `apps/api/src/routes/crawls.ts`

**Step 1: Create a shared blocklist check helper**

Add to the top of each route file or create a small shared middleware:

```typescript
// In each route, after normalizing the domain:
const queries = adminQueries(db);
const blocked = await queries.isBlocked(domain);
if (blocked) {
  return c.json(
    {
      error: {
        code: "DOMAIN_BLOCKED",
        message: "This domain cannot be crawled",
      },
    },
    403,
  );
}
```

**Step 2: Modify public scan route (`apps/api/src/routes/public.ts`)**

Find the URL normalization section (around line 50-60). Replace:

```typescript
// BEFORE: let targetUrl: URL; try { const raw = body.url.startsWith("http") ? body.url : `https://${body.url}`; ...
// AFTER:
const domain = normalizeDomain(body.url);
if (!domain) {
  return c.json(
    {
      error: {
        code: "INVALID_DOMAIN",
        message: "Please enter a valid domain (e.g. example.com)",
      },
    },
    422,
  );
}

// Blocklist check
const adminQ = adminQueries(db);
const blocked = await adminQ.isBlocked(domain);
if (blocked) {
  return c.json(
    {
      error: {
        code: "DOMAIN_BLOCKED",
        message: "This domain cannot be crawled",
      },
    },
    403,
  );
}

// Build the full URL for crawling (always HTTPS)
const pageUrl = `https://${domain}`;
let targetUrl: URL;
try {
  targetUrl = new URL(pageUrl);
} catch {
  return c.json(
    { error: { code: "INVALID_DOMAIN", message: "Invalid domain" } },
    422,
  );
}
```

**Step 3: Modify project creation route**

Find the project creation handler. After schema validation, add:

```typescript
const parsed = CreateProjectSchema.parse(body);
// parsed.domain is now normalized (no protocol, no www)

const adminQ = adminQueries(db);
const blocked = await adminQ.isBlocked(parsed.domain);
if (blocked) {
  return c.json(
    {
      error: {
        code: "DOMAIN_BLOCKED",
        message: "This domain cannot be crawled",
      },
    },
    403,
  );
}
```

**Step 4: Modify crawl start route (`apps/api/src/routes/crawls.ts`)**

In the POST /crawls handler, after loading the project, add:

```typescript
const project = /* loaded from DB */;

const adminQ = adminQueries(db);
const blocked = await adminQ.isBlocked(normalizeDomain(project.domain));
if (blocked) {
  return c.json(
    { error: { code: "DOMAIN_BLOCKED", message: "This domain cannot be crawled" } },
    403,
  );
}
```

**Step 5: Commit**

```bash
git add apps/api/src/routes/public.ts apps/api/src/routes/projects.ts apps/api/src/routes/crawls.ts
git commit -m "feat(api): enforce domain blocklist on scan, project creation, and crawl start"
```

---

### Task 7: API — HTTP Fallback Config in Crawl Dispatch

**Files:**

- Modify: `apps/api/src/routes/crawls.ts` (or the service that calls `buildCrawlConfig`)

**Step 1: Update buildCrawlConfig**

Find `buildCrawlConfig()` and update it:

```typescript
export function buildCrawlConfig(
  project: { domain: string; settings: unknown },
  plan: keyof typeof PLAN_LIMITS,
  httpFallbackGlobalEnabled: boolean,
) {
  const limits = PLAN_LIMITS[plan];
  const settings = (project.settings ?? {}) as Record<string, unknown>;

  // Always use HTTPS as seed URL
  const domain = normalizeDomain(project.domain);
  const seedUrl = `https://${domain}`;

  // HTTP fallback: only if global toggle is on AND project opted in AND not free plan
  const allowHttpFallback =
    httpFallbackGlobalEnabled &&
    plan !== "free" &&
    settings.allowHttpFallback === true;

  return {
    seed_urls: [seedUrl],
    max_pages: Math.min(
      (settings.maxPages as number) || limits.pagesPerCrawl,
      limits.pagesPerCrawl,
    ),
    max_depth: Math.min(
      (settings.maxDepth as number) || limits.maxCrawlDepth,
      limits.maxCrawlDepth,
    ),
    respect_robots: !settings.ignoreRobots,
    run_lighthouse: true,
    extract_schema: true,
    extract_links: true,
    check_llms_txt: true,
    user_agent: "AISEOBot/1.0",
    rate_limit_ms: 1000,
    timeout_s: 30,
    allow_http_fallback: allowHttpFallback,
  };
}
```

**Step 2: Update the caller to pass the global setting**

In the crawl start handler, before calling buildCrawlConfig:

```typescript
const adminQ = adminQueries(db);
const httpFallbackEnabled = await adminQ.isHttpFallbackEnabled();

const config = buildCrawlConfig(project, user.plan, httpFallbackEnabled);
```

**Step 3: Commit**

```bash
git add apps/api/src/routes/crawls.ts
git commit -m "feat(api): add HTTPS-first crawling with conditional HTTP fallback"
```

---

### Task 8: Frontend — Scan Page Input Normalization

**Files:**

- Modify: `apps/web/src/app/scan/client.tsx`

**Step 1: Add normalizeDomain to the frontend**

Since `packages/shared` is a workspace dependency, import directly:

```typescript
import { normalizeDomain } from "@llm-boost/shared";
```

**Step 2: Update the input field**

- Change placeholder to `example.com`
- Add `onBlur` handler to normalize the input value
- Normalize before submission

Find the URL input element and update:

```tsx
<input
  type="text"
  value={url}
  onChange={(e) => setUrl(e.target.value)}
  onBlur={() => setUrl(normalizeDomain(url))}
  placeholder="example.com"
  // ... existing props
/>
```

Update the submit handler:

```typescript
const handleScan = async () => {
  const domain = normalizeDomain(url);
  if (!domain) {
    setError("Please enter a valid domain");
    return;
  }
  setUrl(domain); // Show cleaned value
  // ... rest of existing scan logic, pass domain instead of url
  const result = await api.public.scan(domain);
  // ...
};
```

**Step 3: Commit**

```bash
git add apps/web/src/app/scan/client.tsx
git commit -m "feat(web): normalize domain input on scan page"
```

---

### Task 9: Frontend — New Project Page Input Normalization

**Files:**

- Modify: `apps/web/src/app/dashboard/projects/new/page.tsx`

**Step 1: Update domain input**

Import `normalizeDomain` and apply the same pattern:

```typescript
import { normalizeDomain } from "@llm-boost/shared";
```

Update the domain input field:

- Placeholder: `example.com`
- `onBlur`: normalize
- Remove the old `https://` auto-prepend logic from client-side validation (the schema handles it now)

```tsx
<input
  type="text"
  value={domain}
  onChange={(e) => setDomain(e.target.value)}
  onBlur={() => setDomain(normalizeDomain(domain))}
  placeholder="example.com"
  // ... existing props
/>
```

Update client-side validation to match the new schema (no protocol check needed):

```typescript
if (!domain.trim()) {
  setDomainError("Domain is required.");
} else {
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    setDomainError("Please enter a valid domain (e.g. example.com).");
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/projects/new/page.tsx
git commit -m "feat(web): normalize domain input on new project page"
```

---

### Task 10: Frontend — Clean Domain Display Across Dashboard

**Files:**

- Modify: Any components that display `project.domain` with protocol

**Step 1: Search for protocol display patterns**

Run: `grep -r "project\.domain\|project.domain" apps/web/src/ --include="*.tsx" --include="*.ts"`

For each instance that renders the domain in UI, wrap with `normalizeDomain()` or just display as-is (since new projects will already be normalized). For legacy projects, apply normalization at display time:

```tsx
import { normalizeDomain } from "@llm-boost/shared";

// Wherever domain is displayed:
{
  normalizeDomain(project.domain);
}
```

This is a safety net — after the migration (Task 12), all stored domains will be clean. But this handles the transition period.

**Step 2: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): display clean domains without protocol across dashboard"
```

---

### Task 11: Frontend — Admin Blocklist UI and Settings Toggle

**Files:**

- Modify: `apps/web/src/app/dashboard/admin/page.tsx`
- Modify: `apps/web/src/lib/api.ts` (add admin API methods)

**Step 1: Add API client methods**

In `apps/web/src/lib/api.ts`, add to the `api.admin` object:

```typescript
admin: {
  // ... existing methods ...

  async getBlockedDomains() {
    return httpClient.get<{ data: BlockedDomain[] }>("/admin/blocked-domains");
  },
  async addBlockedDomain(domain: string, reason?: string) {
    return httpClient.post<{ data: BlockedDomain }>("/admin/blocked-domains", { domain, reason });
  },
  async removeBlockedDomain(id: string) {
    return httpClient.delete<{ data: BlockedDomain }>(`/admin/blocked-domains/${id}`);
  },
  async getSettings() {
    return httpClient.get<{ data: { http_fallback_enabled: boolean } }>("/admin/settings");
  },
  async updateSetting(key: string, value: unknown) {
    return httpClient.put<{ data: unknown }>(`/admin/settings/${key}`, { value });
  },
},
```

Add the type:

```typescript
export interface BlockedDomain {
  id: string;
  domain: string;
  reason: string | null;
  blockedBy: string;
  createdAt: string;
}
```

**Step 2: Add Blocked Domains section to admin page**

Add a new tab or section in the admin dashboard (`apps/web/src/app/dashboard/admin/page.tsx`):

```tsx
// New state
const [blockedDomains, setBlockedDomains] = useState<BlockedDomain[]>([]);
const [newBlockDomain, setNewBlockDomain] = useState("");
const [newBlockReason, setNewBlockReason] = useState("");
const [httpFallbackEnabled, setHttpFallbackEnabled] = useState(false);

// Fetch on mount
useEffect(() => {
  api.admin.getBlockedDomains().then((r) => setBlockedDomains(r.data));
  api.admin
    .getSettings()
    .then((r) => setHttpFallbackEnabled(r.data.http_fallback_enabled));
}, []);

// Handlers
const handleAddBlocked = async () => {
  const domain = normalizeDomain(newBlockDomain);
  if (!domain) return;
  const result = await api.admin.addBlockedDomain(
    domain,
    newBlockReason || undefined,
  );
  setBlockedDomains((prev) => [...prev, result.data]);
  setNewBlockDomain("");
  setNewBlockReason("");
};

const handleRemoveBlocked = async (id: string) => {
  await api.admin.removeBlockedDomain(id);
  setBlockedDomains((prev) => prev.filter((d) => d.id !== id));
};

const handleToggleHttpFallback = async () => {
  const newValue = !httpFallbackEnabled;
  await api.admin.updateSetting("http_fallback_enabled", newValue);
  setHttpFallbackEnabled(newValue);
};
```

Add the UI sections (follow existing admin page card/table patterns):

- **Settings card** with "Allow HTTP Fallback" toggle switch
- **Blocked Domains card** with table (domain, reason, date, remove button) and add form

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/app/dashboard/admin/page.tsx
git commit -m "feat(web): add admin blocklist management and HTTP fallback toggle"
```

---

### Task 12: Frontend — HTTP Fallback Checkbox in Project Settings

**Files:**

- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx`

**Step 1: Add the checkbox**

In the crawl settings section (where `ignoreRobots`, `maxPages`, `maxDepth` are), add a new checkbox. Only show it for paid plans and when admin has enabled it globally.

```tsx
// Fetch admin setting to know if checkbox should be visible
const [httpFallbackGlobal, setHttpFallbackGlobal] = useState(false);

useEffect(() => {
  // Only check if user is on a paid plan
  if (user.plan !== "free") {
    api.admin
      .getSettings()
      .then((r) => setHttpFallbackGlobal(r.data.http_fallback_enabled))
      .catch(() => {}); // Silently fail for non-admins — need a public endpoint
  }
}, [user.plan]);
```

Note: The admin settings endpoint requires admin auth. We need a lightweight public endpoint to check if HTTP fallback is globally enabled. Add to the API:

```typescript
// In a public or auth-only route:
.get("/settings/http-fallback", async (c) => {
  const db = c.get("db");
  const queries = adminQueries(db);
  const enabled = await queries.isHttpFallbackEnabled();
  return c.json({ enabled });
})
```

Then in project settings UI:

```tsx
{
  httpFallbackGlobal && user.plan !== "free" && (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={settings.allowHttpFallback ?? false}
        onChange={(e) =>
          updateSettings({ ...settings, allowHttpFallback: e.target.checked })
        }
      />
      <span>Allow HTTP fallback</span>
      <span className="text-xs text-gray-500">
        Try HTTP if HTTPS connection fails
      </span>
    </label>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/projects/[id]/page.tsx apps/api/src/routes/
git commit -m "feat(web): add HTTP fallback checkbox in project crawl settings"
```

---

### Task 13: Migration — Normalize Existing Project Domains

**Files:**

- Create: migration script or use drizzle-kit

**Step 1: Write a migration script**

Create a one-time migration that normalizes all existing project domains:

```typescript
// scripts/migrate-normalize-domains.ts
import { createDb } from "@llm-boost/db";
import { projects } from "@llm-boost/db/schema";
import { normalizeDomain } from "@llm-boost/shared";
import { ne, sql } from "drizzle-orm";

async function main() {
  const db = createDb(process.env.DATABASE_URL!);

  const allProjects = await db
    .select({ id: projects.id, domain: projects.domain })
    .from(projects);

  let updated = 0;
  for (const p of allProjects) {
    const normalized = normalizeDomain(p.domain);
    if (normalized !== p.domain) {
      await db
        .update(projects)
        .set({ domain: normalized, updatedAt: new Date() })
        .where(sql`${projects.id} = ${p.id}`);
      console.log(`  ${p.domain} → ${normalized}`);
      updated++;
    }
  }

  console.log(`Done. Updated ${updated} of ${allProjects.length} projects.`);
}

main().catch(console.error);
```

**Step 2: Run locally to verify**

Run: `npx tsx scripts/migrate-normalize-domains.ts`
Expected: Lists any domains that changed (e.g. `https://example.com` → `example.com`)

**Step 3: Run against production**

Run: `DATABASE_URL=<prod-url> npx tsx scripts/migrate-normalize-domains.ts`

**Step 4: Commit**

```bash
git add scripts/migrate-normalize-domains.ts
git commit -m "feat(db): add migration script to normalize existing project domains"
```

---

### Task 14: API Client — Update public.scan to Send Clean Domain

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Update the scan method**

The `api.public.scan()` method should normalize before sending:

```typescript
public: {
  async scan(url: string) {
    const domain = normalizeDomain(url);
    return httpClient.post<{ data: ScanResult }>("/public/scan", { url: domain });
  },
  // ... rest
},
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): normalize domain in API client before scan request"
```

---

### Task 15: Final Verification

**Step 1: Run all tests**

```bash
pnpm test
```

Expected: All pass, especially:

- `packages/shared` — normalizeDomain tests + updated schema tests
- `packages/integrations` — no regression
- `packages/llm` — no regression

**Step 2: Manual verification checklist**

- [ ] Public scan: paste `https://www.example.com/` → input shows `example.com` on blur
- [ ] New project: paste `http://WWW.BLOG.EXAMPLE.COM/path` → domain field shows `blog.example.com`
- [ ] Dashboard: all project cards show clean domains (no protocol)
- [ ] Admin: can add/remove blocked domains
- [ ] Admin: HTTP fallback toggle works
- [ ] Blocked domain: try to scan a blocked domain → get 403 error
- [ ] Project settings (paid): HTTP fallback checkbox visible when global toggle is on
- [ ] Project settings (free): HTTP fallback checkbox hidden
- [ ] Crawl dispatch: seed URL has `https://` prefix
- [ ] Crawl dispatch: `allow_http_fallback` is true only when all conditions met

**Step 3: Commit and push**

```bash
git push origin main
```
