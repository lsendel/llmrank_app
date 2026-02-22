# API Token Provisioning — Design

**Date:** 2026-02-22
**Status:** Approved

## Problem

1. Token creation fails with 422 — API requires `projectId` but UI labels it "optional" and sends `undefined` for "All projects"
2. MCP server needs account-wide tokens (calls `list_projects`, `start_crawl` across any project) but DB schema ties every token to a single `projectId` (non-nullable FK)
3. Only 3 API scopes shown in UI, but MCP needs 17 additional scopes
4. No admin visibility into tokens — can ban users but can't inspect/revoke their tokens
5. Banned users' API tokens still work (user status not checked in token auth middleware)

## Design

### 1. Database — Make `projectId` nullable

- `api_tokens.projectId` becomes nullable (`ALTER TABLE api_tokens ALTER COLUMN project_id DROP NOT NULL`)
- Add `type` column: `text("type").notNull().default("api")` — values: `"api"` or `"mcp"`
- Null `projectId` = account-wide token (can access all user's projects)
- Non-null `projectId` = project-scoped token (current behavior)

### 2. API Route — Fix validation & support token types

**`POST /api/tokens`:**

- Remove `projectId` from required validation
- Accept `type` field: `"api"` (default) or `"mcp"`
- MCP tokens auto-receive all 20 scopes regardless of request body
- API tokens use the scopes from the request (current 3 API scopes)

**Token auth middleware (`api-token-auth.ts`):**

- Add user status check: look up `user.status` → reject if `banned` or `suspended`
- If `token.projectId` is null, allow access to any of the user's projects
- If `token.projectId` is set, enforce single-project access (current behavior)
- Scope enforcement unchanged

### 3. Frontend — Token type toggle

Create Token dialog gets a **Token Type** selector:

- **"API Token"** — Shows 3 scope checkboxes, project selector (optional)
- **"MCP Token"** — All scopes auto-selected (hidden), project always "All projects"
  - After creation: show setup snippet for Claude Code / Cursor / VS Code

Token list shows a badge for type (`API` vs `MCP`).

### 4. Admin — Token visibility & revocation

- `GET /admin/customers/:id/tokens` — list all tokens for a user
- `DELETE /admin/customers/:id/tokens/:tokenId` — admin revoke any token
- When admin bans a user: existing flow cancels Stripe sub + sets status; token auth middleware now rejects their tokens

### 5. Security

- **Rate limiting**: No change (per-token via KV, limits by plan tier)
- **User status enforcement**: Token auth middleware checks user status → banned/suspended tokens fail immediately
- **SHA256 hashing**: No change (plaintext never stored)
- **Multi-tenancy**: Tokens user-scoped, no cross-tenant access possible
- **Stripe integration**: Plan limits enforce token counts (Pro: 5, Agency: 20); banning cancels Stripe sub

## Files to Modify

| File                                                      | Change                                                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/src/schema.ts`                               | Make `projectId` nullable, add `type` column                                                                                        |
| `packages/db/src/queries/api-tokens.ts`                   | Update `findByHash` to return `type`, handle null `projectId`                                                                       |
| `apps/api/src/routes/api-tokens.ts`                       | Fix validation, accept `type`, auto-assign MCP scopes                                                                               |
| `apps/api/src/services/api-token-service.ts`              | Support nullable `projectId`, token type                                                                                            |
| `apps/api/src/middleware/api-token-auth.ts`               | Add user status check, handle null `projectId`                                                                                      |
| `apps/api/src/routes/admin.ts`                            | Add token list/revoke endpoints                                                                                                     |
| `apps/web/src/components/settings/api-tokens-section.tsx` | Add token type toggle, MCP setup snippet, type badge                                                                                |
| `apps/web/src/lib/api.ts`                                 | Update `CreateTokenInput` type                                                                                                      |
| DB migration                                              | `ALTER TABLE api_tokens ALTER COLUMN project_id DROP NOT NULL; ALTER TABLE api_tokens ADD COLUMN type text NOT NULL DEFAULT 'api';` |
