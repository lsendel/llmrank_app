# MCP Full Test Coverage — Design Document

**Date:** 2026-02-23
**Status:** Approved
**Scope:** `packages/mcp` + `apps/mcp-gateway`

## Goal

Full integration test coverage for the MCP server (27 tools, 3 resources, 3 prompts) and HTTP gateway (OAuth 2.1, transport). All tool tests hit the real API — no mocking of API responses.

## Principles

1. **Real API calls** — every tool test calls `api.llmrank.app` with a real token
2. **InMemoryTransport** — tests go through the full MCP protocol, not just the API client
3. **Idempotent** — tests work with existing data, don't corrupt production state
4. **Ordered execution** — setup phase creates test project + crawl, all tool tests read from it
5. **Resources/prompts** — these are static (no API), tested for correctness of content
6. **Gateway** — tested via Hono `app.request()` with real OAuth crypto, miniflare KV

## Prerequisites

```bash
# Required env vars for test runs
LLM_BOOST_API_TOKEN=llmb_xxx    # Real API token with full scopes
LLM_BOOST_API_URL=https://api.llmrank.app  # Or staging URL
```

Tests skip gracefully if `LLM_BOOST_API_TOKEN` is not set (CI without credentials).

## Test Data Strategy

Tests need real data to validate against. Strategy:

1. **Setup phase** (`beforeAll`): Find or create a test project for domain `test.llmboost.dev`
2. **Seed phase**: If no completed crawl exists, start one and poll until complete
3. **Test phase**: All read-only tools run against the seeded project/crawl/pages
4. **Teardown**: No cleanup — test project persists for future runs (idempotent)

This avoids creating new projects every run while ensuring data exists.

## File Structure

```
packages/mcp/src/
  __tests__/
    helpers.ts                    ← NEW — real test server factory, env config
    server.test.ts                ← EXISTS — keep smoke tests
    integration.test.ts           ← REWRITE — real API calls for all 27 tools
    resources.test.ts             ← NEW — static content validation
    prompts.test.ts               ← NEW — prompt template validation
    e2e.test.ts                   ← NEW — CLI stdio transport
  client/__tests__/
    api-client.test.ts            ← EXISTS — keep (these mock intentionally for HTTP layer)

apps/mcp-gateway/src/
  __tests__/
    helpers.ts                    ← NEW — miniflare KV, test app factory
    well-known.test.ts            ← NEW — OAuth discovery endpoints
    oauth-registration.test.ts    ← NEW — dynamic client registration
    oauth-flow.test.ts            ← NEW — full authorize → token flow
    oauth-crypto.test.ts          ← NEW — PKCE, token generation (pure functions)
    http-transport.test.ts        ← NEW — MCP-over-HTTP with auth
```

## Test Specifications

### 1. Test Helpers (`packages/mcp/src/__tests__/helpers.ts`)

```typescript
export const TEST_CONFIG = {
  apiBaseUrl: process.env.LLM_BOOST_API_URL ?? "https://api.llmrank.app",
  apiToken: process.env.LLM_BOOST_API_TOKEN ?? "",
};

// Skip tests if no real token available
export const describeWithApi = TEST_CONFIG.apiToken ? describe : describe.skip;

// Create MCP server + client via InMemoryTransport (real fetch, no mocks)
export async function createTestServer(): Promise<{
  client: Client;
  cleanup: () => Promise<void>;
}>;

// Shared test state — populated in beforeAll
export const testData: {
  projectId: string;
  crawlId: string;
  pageId: string;
  issueId: string;
};

// Setup: find or create test project, ensure crawl data exists
export async function setupTestData(client: Client): Promise<void>;
```

### 2. MCP Integration Tests — All 27 Tools (~60 tests)

All tests use `InMemoryTransport` with the real MCP server making real API calls.

#### Setup Phase (beforeAll)

- Create MCP server with real API token
- Connect via InMemoryTransport
- Call `list_projects` — find test project or call `create_project`
- If no completed crawl, call `start_crawl` and poll `get_crawl_status` until done
- Store projectId, crawlId, pageId, issueId for all subsequent tests

#### Project Tools (6 tests)

- `list_projects` → returns array with ≥1 project, each has id/name/domain
- `get_project` → returns project matching stored projectId with domain + score
- `create_project` → creates project, returns id (cleanup: use existing if already exists)
- `get_project` with fake UUID → returns error (not found or unauthorized)
- `list_projects` response structure matches expected schema
- `create_project` with duplicate domain → appropriate error

#### Crawl Tools (6 tests)

- `list_crawls` → returns array with ≥1 crawl for test project
- `get_crawl_status` → returns status for stored crawlId (completed)
- `start_crawl` → starts crawl, returns crawlId (only if no active crawl)
- `get_crawl_status` with fake UUID → error
- `list_crawls` with limit=1 → returns exactly 1 crawl
- `list_crawls` response includes score + timestamp

#### Page Tools (4 tests)

- `list_pages` → returns array with ≥1 page, each has url/title/scores
- `get_page_details` → returns full analysis for stored pageId
- `list_pages` with sortBy/order → returns sorted results
- `get_page_details` with fake UUID → error

#### Score Tools (5 tests)

- `get_site_score` → returns overall score + 4 category breakdowns
- `get_site_score` → category weights present (technical, content, aiReadiness, performance)
- `get_score_history` → returns ≥1 historical score entry
- `compare_scores` with same crawlId twice → returns zero deltas
- `get_site_score` with fake UUID → error

#### Issue Tools (4 tests)

- `list_issues` → returns issues grouped by severity
- `list_issues` with severity=critical → only critical issues
- `get_fix_recommendation` → returns recommendation with steps
- `list_issues` with fake UUID → error

#### Visibility Tools (4 tests)

- `check_visibility` → returns visibility results for ≥1 platform
- `list_visibility_history` → returns array (may be empty if no checks yet)
- `check_visibility` response includes brandMentioned/urlCited fields
- `check_visibility` with fake UUID → error

#### Fix Tools (2 tests)

- `generate_fix` → returns fix with steps and expected impact
- `generate_fix` with fake issueCode → error or empty result

#### Strategy Tools (4 tests)

- `get_recommendations` → returns prioritized action list
- `get_content_gaps` → returns content gap analysis
- `get_recommendations` response includes effort/impact ranking
- `get_content_gaps` with fake UUID → error

#### Competitor Tools (4 tests)

- `list_competitors` → returns competitor list (may be empty)
- `compare_competitor` → returns comparison data
- `list_competitors` response structure is valid
- `compare_competitor` with fake UUID → error

#### Content Tools (4 tests)

- `analyze_content` → returns 37-factor analysis for stored pageId
- `suggest_meta_tags` → returns title/description/OG suggestions
- `analyze_content` response includes per-category scores
- `suggest_meta_tags` with fake pageId → error

#### Technical Tools (4 tests)

- `check_llms_txt` → returns llms.txt validation result
- `validate_schema` → returns structured data validation
- `check_llms_txt` response includes exists/valid/content fields
- `validate_schema` with fake pageId → error

#### Keyword/Query Tools (4 tests)

- `discover_keywords` → returns keyword list with relevance scores
- `suggest_queries` → returns suggested visibility queries
- `discover_keywords` response includes searchVolume/aiRelevance
- `suggest_queries` with count param → returns requested number

#### Report Tools (3 tests)

- `generate_report` → returns markdown report content
- `generate_report` with format=json → returns JSON report
- `generate_report` with fake projectId → error

### 3. Resource Tests (10 tests)

Static content — no API calls needed.

#### scoring-factors

- Contains 4 categories: technical, content, aiReadiness, performance
- Weights: 0.25, 0.30, 0.30, 0.15
- Weights sum to 1.0
- Grading scale: A(90-100), B(80-89), C(70-79), D(60-69), F(<60)
- All 37 factors present across categories

#### issue-catalog

- Contains all issue codes from `@llm-boost/shared` ISSUE_DEFINITIONS
- Each issue has: severity, category, description
- Known codes present: MISSING_TITLE, AI_CRAWLER_BLOCKED, NOINDEX_SET, MISSING_LLMS_TXT

#### platform-requirements

- Lists 6 platforms: chatgpt, claude, perplexity, gemini, copilot, grok
- Each platform entry has name

### 4. Prompt Tests (10 tests)

Static templates — no API calls needed.

- `site-audit`: returns user message referencing get_site_score, list_issues, check_llms_txt
- `site-audit`: includes projectId argument in message text
- `site-audit`: message is non-empty and well-formed
- `fix-plan`: references list_issues, generate_fix
- `fix-plan`: includes projectId and maxIssues in message
- `fix-plan`: uses default maxIssues when omitted
- `competitor-analysis`: references list_competitors, compare_competitor, get_content_gaps
- `competitor-analysis`: includes projectId in message
- All 3 prompts listed via listPrompts
- Unknown prompt → error

### 5. Gateway OAuth Crypto Tests (5 tests)

Pure function tests — no external dependencies.

- `generateToken(16)` returns 32-char hex string
- `generateToken(32)` returns 64-char hex string
- Two calls produce different tokens (randomness)
- `verifyPkceChallenge` returns true for valid S256 verifier→challenge
- `verifyPkceChallenge` returns false for tampered challenge

### 6. Gateway Well-Known Endpoints (5 tests)

Via Hono `app.request()` with miniflare KV.

- GET `/.well-known/oauth-authorization-server` → 200 with JSON metadata
- Metadata includes `authorization_endpoint`, `token_endpoint`, `registration_endpoint`
- Metadata includes `scopes_supported` with all 17 scopes
- Metadata `code_challenge_methods_supported` includes `S256`
- GET `/.well-known/oauth-protected-resource` → 200 with resource metadata

### 7. Gateway OAuth Registration Tests (4 tests)

Via Hono `app.request()`.

- POST `/oauth/register` with valid HTTPS redirect_uri → 201 with client_id
- POST `/oauth/register` with HTTP non-localhost redirect_uri → 400
- POST `/oauth/register` with localhost redirect_uri → 201 (allowed)
- POST `/oauth/register` with missing redirect_uris → 400

### 8. Gateway OAuth Full Flow Tests (8 tests)

Via Hono `app.request()` with miniflare KV. Tests the complete flow.

- Register → GET authorize page → renders consent form HTML
- Register → POST authorize with valid credentials → redirects with auth code
- Register → POST authorize with bad password → renders error
- Auth code → POST token exchange with valid PKCE → returns access + refresh tokens
- Auth code → POST token exchange with wrong PKCE verifier → 400
- Auth code used twice → second exchange fails
- Refresh token → POST token with grant_type=refresh_token → new tokens
- Invalid refresh token → 400

### 9. Gateway HTTP Transport Tests (8 tests)

Via Hono `app.request()`.

- POST `/v1/mcp` with valid Bearer token → 200 MCP response
- POST `/v1/mcp` with direct `llmb_` token → 200 (bypasses OAuth)
- POST `/v1/mcp` with no Authorization header → 401
- POST `/v1/mcp` with expired/invalid token → 401
- OPTIONS `/v1/mcp` → CORS preflight with correct Access-Control headers
- Response includes `mcp-session-id` header
- POST `/v1/mcp` with `initialize` JSON-RPC → server capabilities
- POST `/v1/mcp` with `tools/list` JSON-RPC → 27 tools

### 10. E2E CLI Tests (5 tests)

Spawn actual CLI process.

- `LLM_BOOST_API_TOKEN=llmb_xxx node dist/cli.js` → starts without error
- No `LLM_BOOST_API_TOKEN` → exits with error + help message
- Custom `LLM_BOOST_API_URL` → uses provided URL (verify via debug output)
- Full stdio round-trip: spawn CLI → send initialize → get capabilities → close
- Spawn CLI → send tools/list → receive 27 tools → close

## Implementation Order

1. **Test helpers** — `helpers.ts` for both packages (test server factory, env config, test data setup)
2. **Resources + prompts** — static tests, no API dependency (fast to write, validate structure)
3. **Gateway crypto** — pure functions, no dependencies
4. **Gateway well-known + registration** — Hono app.request(), miniflare KV
5. **Gateway OAuth flow** — full authorize → token chain
6. **Gateway HTTP transport** — MCP-over-HTTP with auth
7. **MCP tool integration tests** — all 27 tools against real API (biggest chunk)
8. **E2E CLI tests** — spawn process, stdio protocol

## Environment Setup

### Local Development

```bash
# Copy test token from dashboard
export LLM_BOOST_API_TOKEN=llmb_your_test_token

# Run MCP tests
pnpm --filter @llmrank.app/mcp test

# Run gateway tests
pnpm --filter @llm-boost/mcp-gateway test
```

### CI

```yaml
env:
  LLM_BOOST_API_TOKEN: ${{ secrets.LLM_BOOST_API_TOKEN }}
  LLM_BOOST_API_URL: https://api.llmrank.app
```

Tests that require `LLM_BOOST_API_TOKEN` skip when the env var is absent (e.g., external PRs).

### Gateway Tests

Gateway tests use `miniflare` (or in-memory KV shim) for Cloudflare KV — this is the only "mock" in the entire suite, since KV is an infrastructure binding, not business logic.

## Test Timeouts

Real API calls are slower than mocks. Configure vitest:

```typescript
// vitest.config.ts adjustments
export default {
  test: {
    testTimeout: 30_000, // 30s per test (API calls + possible crawl polling)
    hookTimeout: 120_000, // 2 min for beforeAll (may need to wait for crawl)
  },
};
```

## Success Criteria

- ~120 tests total (reduced from 200 since no mock duplication)
- All tests pass against live `api.llmrank.app`
- Tests skip gracefully without API token
- Gateway tests work locally without deploying
- No test mutates production data destructively
- Test suite completes in < 3 minutes
