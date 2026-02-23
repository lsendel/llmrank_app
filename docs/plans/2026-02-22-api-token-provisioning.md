# API Token Provisioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix API token creation (422 bug), support account-wide MCP tokens, add Bearer token auth to main API routes, enforce user status on token auth, and add admin token management.

**Architecture:** Make `projectId` nullable in `api_tokens` table, add `type` column (api/mcp). Update `authMiddleware` to accept both session auth AND Bearer API tokens so MCP npm package can call `/api/*` routes. Add user ban/suspend check to token auth flow.

**Tech Stack:** Drizzle ORM (Neon PG), Hono middleware, Next.js (React), Stripe billing integration

---

### Task 1: Database Schema — Make projectId nullable, add type column

**Files:**

- Modify: `packages/db/src/schema.ts:1034-1057`

**Step 1: Update schema**

In `packages/db/src/schema.ts`, change the `apiTokens` table definition:

```typescript
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }), // REMOVED .notNull()
    type: text("type").notNull().default("api"), // NEW: "api" | "mcp"
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    scopes: text("scopes").array().notNull(),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_api_tokens_user").on(t.userId),
    uniqueIndex("idx_api_tokens_hash").on(t.tokenHash),
  ],
);
```

**Step 2: Push schema to database**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Schema changes applied (projectId nullable, type column added)

**Step 3: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): make api_tokens.projectId nullable, add type column"
```

---

### Task 2: Update token queries for nullable projectId

**Files:**

- Modify: `packages/db/src/queries/api-tokens.ts`

**Step 1: Update the create function signature**

Change `projectId: string` to `projectId: string | null` in the `create` method:

```typescript
async create(data: {
  userId: string;
  projectId: string | null;  // CHANGED: was string
  type: string;              // NEW
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt?: Date | null;
}) {
  const [token] = await db.insert(apiTokens).values(data).returning();
  return token;
},
```

**Step 2: Add type to listByUser select**

Add `type: apiTokens.type` to the select in `listByUser`:

```typescript
async listByUser(userId: string) {
  return db
    .select({
      id: apiTokens.id,
      type: apiTokens.type,       // NEW
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      scopes: apiTokens.scopes,
      projectId: apiTokens.projectId,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      revokedAt: apiTokens.revokedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(apiTokens.createdAt);
},
```

**Step 3: Commit**

```bash
git add packages/db/src/queries/api-tokens.ts
git commit -m "feat(db): update token queries for nullable projectId and type"
```

---

### Task 3: Update token service — support nullable projectId and type

**Files:**

- Modify: `apps/api/src/services/api-token-service.ts`

**Step 1: Update domain types**

Change `ApiToken`, `TokenContext`, and `CreateTokenInput` interfaces:

```typescript
export interface ApiToken {
  id: string;
  userId: string;
  projectId: string | null; // CHANGED: was string
  type: string; // NEW
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scopes: TokenScope[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface TokenContext {
  tokenId: string;
  userId: string;
  projectId: string | null; // CHANGED: was string
  scopes: TokenScope[];
}

export interface CreateTokenInput {
  userId: string;
  userPlan: PlanTier;
  projectId: string | null; // CHANGED: was string
  type: string; // NEW: "api" | "mcp"
  name: string;
  scopes: TokenScope[];
  expiresAt?: Date;
}
```

**Step 2: Update create method**

Skip `assertProjectOwnership` when `projectId` is null. Add `type` to stored data:

```typescript
async create(
  input: CreateTokenInput,
): Promise<{ plainToken: string; token: ApiToken }> {
  // 1. Verify project ownership (only if project-scoped)
  if (input.projectId) {
    await assertProjectOwnership(
      deps.projects,
      input.userId,
      input.projectId,
    );
  }

  // 2. Enforce plan limits
  const limits = PLAN_LIMITS[input.userPlan];
  if (limits.apiTokens === 0) {
    throw new ServiceError(
      "PLAN_LIMIT_REACHED",
      403,
      "Your plan does not include API token access",
    );
  }

  const existingCount = await deps.apiTokens.countByUser(input.userId);
  if (existingCount >= limits.apiTokens) {
    throw new ServiceError(
      "PLAN_LIMIT_REACHED",
      403,
      `API token limit reached (${limits.apiTokens} tokens for ${input.userPlan} plan)`,
    );
  }

  // 3. Generate token + hash
  const plainToken = generateRawToken();
  const tokenHash = await sha256Hex(plainToken);
  const tokenPrefix = plainToken.slice(0, 9);

  // 4. Store
  const token = await deps.apiTokens.create({
    userId: input.userId,
    projectId: input.projectId,
    type: input.type,
    name: input.name,
    tokenHash,
    tokenPrefix,
    scopes: input.scopes,
    expiresAt: input.expiresAt ?? null,
  });

  return { plainToken, token };
},
```

**Step 3: Update authenticate return**

The `authenticate` method already returns `token.projectId` which will now be `string | null`. No code change needed, just the type update from Step 1.

**Step 4: Commit**

```bash
git add apps/api/src/services/api-token-service.ts
git commit -m "feat(api): support nullable projectId and token type in service"
```

---

### Task 4: Fix API token route validation

**Files:**

- Modify: `apps/api/src/routes/api-tokens.ts`

**Step 1: Update POST / validation and add type support**

Replace the validation block and body type:

```typescript
tokenRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    projectId?: string; // CHANGED: now optional
    type?: "api" | "mcp"; // NEW
    name: string;
    scopes?: TokenScope[]; // CHANGED: optional for MCP
    expiresAt?: string;
  }>();

  const tokenType = body.type ?? "api";

  if (!body.name || !["api", "mcp"].includes(tokenType)) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "name is required and type must be 'api' or 'mcp'",
        },
      },
      422,
    );
  }

  // For MCP tokens, auto-assign all scopes; for API tokens, require scopes
  const scopes: TokenScope[] =
    tokenType === "mcp"
      ? (ALL_TOKEN_SCOPES as unknown as TokenScope[])
      : (body.scopes ?? []);

  if (tokenType === "api" && scopes.length === 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "At least one scope is required for API tokens",
        },
      },
      422,
    );
  }

  // Validate scopes
  const invalidScopes = scopes.filter(
    (s) => !(ALL_TOKEN_SCOPES as readonly string[]).includes(s),
  );
  if (invalidScopes.length > 0) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid scopes: ${invalidScopes.join(", ")}`,
        },
      },
      422,
    );
  }

  // Look up user plan
  const db = c.get("db");
  const uq = userQueries(db);
  const user = await uq.getById(userId);
  if (!user) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "User not found" } },
      401,
    );
  }

  const service = buildService(c);

  try {
    const result = await service.create({
      userId,
      userPlan: user.plan as PlanTier,
      projectId: body.projectId ?? null, // null = account-wide
      type: tokenType,
      name: body.name,
      scopes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    return c.json(
      {
        data: {
          ...result.token,
          plaintext: result.plainToken,
        },
      },
      201,
    );
  } catch (error) {
    return handleServiceError(c, error);
  }
});
```

**Step 2: Commit**

```bash
git add apps/api/src/routes/api-tokens.ts
git commit -m "fix(api): make projectId optional, add token type support"
```

---

### Task 5: Unified auth middleware — support both sessions and Bearer tokens

**Files:**

- Modify: `apps/api/src/middleware/auth.ts`

This is the most critical change. The MCP npm package sends `Authorization: Bearer llmb_xxx` to `/api/*` routes, but `authMiddleware` only checks sessions. We need it to also accept Bearer tokens.

**Step 1: Add Bearer token fallback to authMiddleware**

```typescript
import { createAuth } from "../lib/auth";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";
import { createLogger } from "../lib/logger";
import { apiTokenQueries, userQueries, projectQueries } from "@llm-boost/db";
import { createApiTokenService } from "../services/api-token-service";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const log =
    c.get("logger") ?? createLogger({ requestId: c.get("requestId") });

  // Check for Bearer API token first
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer llmb_")) {
    const rawToken = authHeader.slice("Bearer ".length).trim();
    const db = c.get("db");
    const service = createApiTokenService({
      apiTokens: apiTokenQueries(db) as any,
      projects: { getById: (id: string) => projectQueries(db).getById(id) },
    });

    const tokenCtx = await service.authenticate(rawToken);
    if (!tokenCtx) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or expired API token",
          },
        },
        401,
      );
    }

    // Check user status
    const user = await userQueries(db).getById(tokenCtx.userId);
    if (!user || user.status !== "active") {
      return c.json(
        {
          error: {
            code: "ACCOUNT_SUSPENDED",
            message:
              user?.status === "banned"
                ? "Your account has been permanently banned."
                : "Your account has been suspended.",
          },
        },
        403,
      );
    }

    c.set("userId", tokenCtx.userId);
    c.set("tokenCtx", tokenCtx);
    return next();
  }

  // Fall back to session auth
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication failed" } },
        401,
      );
    }

    c.set("userId", session.user.id);

    // Check if user is blocked/suspended
    const db = c.get("db");
    const user = await userQueries(db).getById(session.user.id);
    if (user && user.status !== "active") {
      return c.json(
        {
          error: {
            code: "ACCOUNT_SUSPENDED",
            message:
              user.status === "banned"
                ? "Your account has been permanently banned."
                : "Your account has been suspended. Contact support for assistance.",
          },
        },
        403,
      );
    }

    await next();
  } catch (error) {
    log.error("Authentication failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication failed" } },
      401,
    );
  }
});
```

**Step 2: Update api-token-auth.ts to also check user status**

In `apps/api/src/middleware/api-token-auth.ts`, add user status check after line 79 (after the user lookup):

```typescript
// Check user status
if (user.status !== "active") {
  return c.json(
    {
      error: {
        code: "ACCOUNT_SUSPENDED",
        message:
          user.status === "banned"
            ? "Your account has been permanently banned."
            : "Your account has been suspended.",
      },
    },
    403,
  );
}
```

**Step 3: Update v1 route's requireProjectAccess for nullable projectId**

In `apps/api/src/routes/v1.ts:21-29`, update `requireProjectAccess`:

```typescript
function requireProjectAccess(
  tokenCtx: TokenContext,
  projectId: string,
): string | null {
  // Account-wide tokens (null projectId) can access any project
  if (tokenCtx.projectId === null) {
    return null;
  }
  if (tokenCtx.projectId !== projectId) {
    return "Token is not authorized for this project";
  }
  return null;
}
```

**Step 4: Commit**

```bash
git add apps/api/src/middleware/auth.ts apps/api/src/middleware/api-token-auth.ts apps/api/src/routes/v1.ts
git commit -m "feat(api): unified auth — support Bearer tokens in main middleware, check user status"
```

---

### Task 6: Admin token endpoints

**Files:**

- Modify: `apps/api/src/routes/admin.ts`

**Step 1: Add token list and revoke routes**

Add before the promos section (after line 243 in admin.ts):

```typescript
// ─── GET /customers/:id/tokens — List user's API tokens ─────

adminRoutes.get("/customers/:id/tokens", async (c) => {
  const targetId = c.req.param("id");
  const db = c.get("db");
  const tokens = await apiTokenQueries(db).listByUser(targetId);
  return c.json({ data: tokens });
});

// ─── DELETE /customers/:id/tokens/:tokenId — Admin revoke token ─

adminRoutes.delete("/customers/:id/tokens/:tokenId", async (c) => {
  const adminId = c.get("userId");
  const targetId = c.req.param("id");
  const tokenId = c.req.param("tokenId");
  const db = c.get("db");

  // Verify token belongs to this user
  const tokens = await apiTokenQueries(db).listByUser(targetId);
  const owned = tokens.some((t) => t.id === tokenId);
  if (!owned) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Token not found" } },
      404,
    );
  }

  const revoked = await apiTokenQueries(db).revoke(tokenId);

  const service = buildAdminService(c);
  await service.recordAction({
    actorId: adminId,
    action: "revoke_token",
    targetType: "api_token",
    targetId: tokenId,
    reason: `Admin revoked token for user ${targetId}`,
  });

  return c.json({ data: revoked });
});
```

**Step 2: Add import**

Add `apiTokenQueries` to the import from `@llm-boost/db` at top of file.

**Step 3: Commit**

```bash
git add apps/api/src/routes/admin.ts
git commit -m "feat(admin): add token list and revoke endpoints"
```

---

### Task 7: Frontend — Update CreateTokenInput type

**Files:**

- Modify: `apps/web/src/lib/api.ts:1046-1050`

**Step 1: Update the type**

```typescript
export interface CreateTokenInput {
  name: string;
  type?: "api" | "mcp";
  projectId?: string;
  scopes?: string[];
}
```

**Step 2: Add `type` to ApiTokenInfo**

Find the `ApiTokenInfo` interface and add `type: string`:

```typescript
export interface ApiTokenInfo {
  id: string;
  type: string; // NEW
  name: string;
  prefix: string;
  scopes: string[];
  projectId: string | null; // CHANGED: was string
  createdAt: string;
  lastUsedAt: string | null;
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): update token types for nullable projectId and type"
```

---

### Task 8: Frontend — Token type toggle and MCP setup snippet

**Files:**

- Modify: `apps/web/src/components/settings/api-tokens-section.tsx`

**Step 1: Add token type state and MCP scopes constant**

After the existing `allScopes` constant (line 53-57), add:

```typescript
const mcpSetupSnippets = {
  "Claude Code": `claude mcp add llm-boost \\
  --env LLM_BOOST_API_TOKEN=TOKEN \\
  -- npx -y @llmrank.app/mcp`,
  "Cursor / Claude Desktop / Windsurf": `{
  "mcpServers": {
    "llm-boost": {
      "command": "npx",
      "args": ["-y", "@llmrank.app/mcp"],
      "env": {
        "LLM_BOOST_API_TOKEN": "TOKEN"
      }
    }
  }
}`,
};
```

Add new state in the component:

```typescript
const [tokenType, setTokenType] = useState<"api" | "mcp">("mcp");
```

**Step 2: Update the handleCreateToken function**

Change the `api.tokens.create` call to send `type` and conditionally send scopes:

```typescript
async function handleCreateToken() {
  setTokenError(null);
  if (!tokenName.trim()) {
    setTokenError("Token name is required.");
    return;
  }
  if (tokenType === "api" && tokenScopes.length === 0) {
    setTokenError("Select at least one scope.");
    return;
  }
  setSavingToken(true);
  try {
    const result = await api.tokens.create({
      name: tokenName.trim(),
      type: tokenType,
      projectId:
        tokenType === "api" && tokenProjectId && tokenProjectId !== "all"
          ? tokenProjectId
          : undefined,
      scopes: tokenType === "api" ? tokenScopes : undefined,
    });
    setCreatedToken(result);
    await mutateTokens();
  } catch (err) {
    setTokenError(
      err instanceof Error ? err.message : "Failed to create token",
    );
  } finally {
    setSavingToken(false);
  }
}
```

**Step 3: Update the create dialog form**

Add a Token Type selector before the name field. Conditionally show scopes and project only for API tokens. Replace the form section inside `DialogContent` (lines 278-332):

```tsx
<div className="space-y-4">
  {/* Token type */}
  <div className="space-y-2">
    <Label>Token Type</Label>
    <Select
      value={tokenType}
      onValueChange={(v) => setTokenType(v as "api" | "mcp")}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="mcp">MCP Server (recommended)</SelectItem>
        <SelectItem value="api">API Token</SelectItem>
      </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">
      {tokenType === "mcp"
        ? "Full access for Claude Code, Cursor, and other AI coding tools."
        : "Limited scopes for custom API integrations."}
    </p>
  </div>

  {/* Token name */}
  <div className="space-y-2">
    <Label>Name</Label>
    <Input
      placeholder={
        tokenType === "mcp"
          ? "e.g. Claude Code, Cursor"
          : "e.g. CI pipeline, Dashboard integration"
      }
      value={tokenName}
      onChange={(e) => {
        setTokenName(e.target.value);
        setTokenError(null);
      }}
    />
  </div>

  {/* Project selector — API tokens only */}
  {tokenType === "api" && (
    <div className="space-y-2">
      <Label>Project (optional)</Label>
      <Select value={tokenProjectId} onValueChange={setTokenProjectId}>
        <SelectTrigger>
          <SelectValue placeholder="All projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projectsData?.data.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name} ({project.domain})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )}

  {/* Scopes — API tokens only */}
  {tokenType === "api" && (
    <div className="space-y-2">
      <Label>Scopes</Label>
      <div className="space-y-2">
        {allScopes.map((scope) => (
          <label key={scope.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tokenScopes.includes(scope.value)}
              onChange={() => toggleScope(scope.value)}
              className="rounded border-input"
            />
            {scope.label}
          </label>
        ))}
      </div>
    </div>
  )}

  {tokenError && <p className="text-sm text-destructive">{tokenError}</p>}
</div>
```

**Step 4: Update the "Token Created" dialog for MCP tokens**

After the plaintext token copy section (line 263), add MCP setup snippets conditionally:

```tsx
{
  createdToken && tokenType === "mcp" && (
    <div className="space-y-3">
      <Label>Setup Instructions</Label>
      {Object.entries(mcpSetupSnippets).map(([name, snippet]) => (
        <div key={name} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{name}</p>
          <pre className="rounded-lg bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {snippet.replace(/TOKEN/g, createdToken.plaintext)}
          </pre>
        </div>
      ))}
    </div>
  );
}
```

**Step 5: Add type badge to token list**

In the token list item (line 381-404), add a type badge next to the name:

```tsx
<div className="flex items-center gap-2">
  <p className="text-sm font-medium">{token.name}</p>
  <Badge
    variant={token.type === "mcp" ? "default" : "outline"}
    className="text-xs"
  >
    {token.type === "mcp" ? "MCP" : "API"}
  </Badge>
  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
    {token.prefix}...
  </code>
</div>
```

**Step 6: Update resetTokenDialog**

Add `setTokenType("mcp")` to the reset function.

**Step 7: Commit**

```bash
git add apps/web/src/components/settings/api-tokens-section.tsx
git commit -m "feat(web): add token type toggle, MCP setup snippets, type badges"
```

---

### Task 9: Deploy and verify

**Step 1: Build and typecheck**

Run: `pnpm typecheck`
Expected: No type errors

**Step 2: Push DB schema**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Schema applied to Neon

**Step 3: Deploy API**

Run: `cd apps/api && npx wrangler deploy`
Expected: Worker deployed

**Step 4: Deploy Web**

Run: `cd apps/web && npx opennextjs-cloudflare build && npx wrangler deploy --config wrangler.jsonc`
Expected: Pages deployed

**Step 5: Verify in browser**

1. Go to https://llmrank.app/dashboard/settings → API Tokens tab
2. Click "Create Token" — verify type selector defaults to "MCP Server"
3. Enter a name, click Create Token — verify token is created (no 422)
4. Verify MCP setup snippets appear with the real token
5. Test the token: `LLM_BOOST_API_TOKEN=<token> npx @llmrank.app/mcp` — should start without error
6. Verify token appears in list with "MCP" badge

**Step 6: Verify admin**

1. Go to admin panel, find a user, check their tokens are visible
2. Verify admin can revoke a token

**Step 7: Verify security**

1. Ban a test user → verify their tokens stop working immediately
2. Verify account-wide token can access multiple projects
3. Verify project-scoped token cannot access other projects

**Step 8: Final commit and push**

```bash
git push origin main
```
