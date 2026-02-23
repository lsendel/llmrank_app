# MCP SEO Interface — Design Document

**Date:** 2026-02-22
**Status:** Approved
**Scope:** MCP server, documentation portal, landing page, agentic SEO strategy

---

## 1. Overview

Build a Model Context Protocol (MCP) server that exposes LLM Rank's AI-readiness SEO platform to AI agents (Claude, Cursor, Copilot, custom apps). Dual transport: local stdio for desktop clients + remote Streamable HTTP with OAuth 2.1 for app-to-app integration.

**Positioning:** "SEO Optimization for Your AI Agent" — the only MCP that scores AI-readiness AND provides agent-driven fixes.

---

## 2. Architecture

### Dual Transport Model

```
User's Machine                          LLM Rank Cloud
┌─────────────────────┐                 ┌──────────────────────────┐
│ Claude / Cursor      │                 │                          │
│   ↕ stdio            │                 │  apps/mcp-gateway/       │
│ @llm-boost/mcp-server│──HTTPS+Token──→│  (Streamable HTTP Worker)│
│ (npm package)        │                 │         ↓                │
└─────────────────────┘                 │  apps/api/ (Hono)        │
                                        │  (existing business logic)│
AI Agent / Custom App                   │         ↓                │
┌──────────────────┐    OAuth 2.1       │  packages/db/ (Neon PG)  │
│ Remote MCP Client │──────────────────→│                          │
│ (any language)    │   Streamable HTTP  └──────────────────────────┘
└──────────────────┘
```

Both transports proxy to the existing Hono API (`apps/api`), reusing all business logic, auth, rate limiting, and plan enforcement.

### Package Structure

```
packages/
  mcp/                              → MCP server package (npm)
    src/
      server.ts                     → MCP server bootstrap (dual transport)
      transports/
        stdio.ts                    → Local stdio for Claude Desktop/Cursor
        streamable-http.ts          → Remote Streamable HTTP + OAuth 2.1
      tools/                        → Tool definitions (one file per domain)
        projects.ts                 → list_projects, get_project, create_project
        crawls.ts                   → start_crawl, get_crawl_status, list_crawls
        pages.ts                    → list_pages, get_page_details
        scores.ts                   → get_site_score, compare_scores, get_score_history
        issues.ts                   → list_issues, get_fix_recommendation
        visibility.ts               → check_visibility, list_visibility_history
        fixes.ts                    → generate_fix
        strategy.ts                 → get_recommendations, get_content_gaps
        competitors.ts              → list_competitors, compare_competitor
        reports.ts                  → generate_report (markdown output)
        content.ts                  → analyze_content, suggest_meta_tags
        technical.ts                → check_llms_txt, validate_schema
        keywords.ts                 → discover_keywords
        queries.ts                  → suggest_queries
      resources/                    → MCP resources (read-only structured data)
        score-definitions.ts        → 37 scoring factors
        issue-catalog.ts            → Full issue code catalog
        platform-requirements.ts    → Per-LLM platform requirements
      prompts/                      → MCP prompt templates
        site-audit.ts               → "Audit this site for AI readiness"
        fix-plan.ts                 → "Create a fix plan for top issues"
        competitor-analysis.ts      → "Compare my site against competitors"
      auth/
        oauth-server.ts             → OAuth 2.1 authorization server
        token-validator.ts          → API token validation
        scopes.ts                   → Permission scopes definition
      client/
        api-client.ts               → HTTP client to existing Hono API
      middleware/
        rate-limiter.ts             → Per-token rate limiting
        audit-logger.ts             → Action audit trail
      __tests__/                    → Comprehensive test suite
    bin/
      cli.ts                        → npx @llm-boost/mcp-server entry
    package.json
    tsconfig.json
    README.md

apps/
  mcp-gateway/                      → Cloudflare Worker for remote MCP
    src/
      index.ts                      → Worker entry (Streamable HTTP)
      oauth/                        → OAuth 2.1 endpoints
    wrangler.toml
```

---

## 3. Tool Surface — 25 Tools

| Domain          | Tool                      | Action                         | Scope              |
| --------------- | ------------------------- | ------------------------------ | ------------------ |
| **Projects**    | `list_projects`           | List user's projects           | `projects:read`    |
|                 | `get_project`             | Project details + latest score | `projects:read`    |
|                 | `create_project`          | Create new project             | `projects:write`   |
| **Crawls**      | `start_crawl`             | Trigger a new crawl            | `crawls:write`     |
|                 | `get_crawl_status`        | Check crawl progress           | `crawls:read`      |
|                 | `list_crawls`             | Crawl history                  | `crawls:read`      |
| **Pages**       | `list_pages`              | Pages with scores              | `pages:read`       |
|                 | `get_page_details`        | Full page analysis             | `pages:read`       |
| **Scores**      | `get_site_score`          | Overall score breakdown        | `scores:read`      |
|                 | `compare_scores`          | Compare two crawls             | `scores:read`      |
|                 | `get_score_history`       | Score trends over time         | `scores:read`      |
| **Issues**      | `list_issues`             | Issues by severity/category    | `issues:read`      |
|                 | `get_fix_recommendation`  | AI fix for specific issue      | `issues:read`      |
| **Visibility**  | `check_visibility`        | Check AI search presence       | `visibility:write` |
|                 | `list_visibility_history` | Visibility trends              | `visibility:read`  |
| **Fixes**       | `generate_fix`            | Generate code/content fix      | `fixes:write`      |
| **Strategy**    | `get_recommendations`     | Prioritized action plan        | `strategy:read`    |
|                 | `get_content_gaps`        | Missing content opportunities  | `strategy:read`    |
| **Competitors** | `list_competitors`        | Competitor scores              | `competitors:read` |
|                 | `compare_competitor`      | Side-by-side comparison        | `competitors:read` |
| **Reports**     | `generate_report`         | Full report (markdown)         | `reports:write`    |
| **Content**     | `analyze_content`         | Analyze page content quality   | `content:read`     |
|                 | `suggest_meta_tags`       | Generate optimized meta tags   | `content:read`     |
| **Technical**   | `check_llms_txt`          | Validate llms.txt file         | `technical:read`   |
|                 | `validate_schema`         | Check structured data          | `technical:read`   |
| **Keywords**    | `discover_keywords`       | Run keyword discovery          | `keywords:write`   |
| **Queries**     | `suggest_queries`         | AI-suggest visibility queries  | `queries:write`    |

---

## 4. Security Architecture

### Authentication — Dual Model

**stdio transport (local):**

- API token provided in `claude_desktop_config.json` or env var
- Token format: `llmb_<32-char-hash>`
- Validated per-request against existing `/api/v1` auth

**Streamable HTTP transport (remote):**

- OAuth 2.1 Authorization Code Flow + PKCE
- No implicit flow
- Access tokens: JWT, 1-hour TTL
- Refresh tokens: 30-day TTL, rotatable
- Consent page shows requested scopes

### Authorization — Scope-Based Access Control

14 scopes organized by domain:

```
projects:read, projects:write
crawls:read, crawls:write
pages:read
scores:read
issues:read
visibility:read, visibility:write
fixes:write
strategy:read
competitors:read
keywords:write
queries:write
reports:write
content:read
technical:read
```

### Defense in Depth — 10 Layers

1. **Transport Security:** TLS 1.3 for all remote connections
2. **Authentication:** Token or OAuth 2.1 with PKCE
3. **Authorization:** Per-tool scope validation before execution
4. **Plan Enforcement:** MCP respects existing `PLAN_LIMITS` tier limits
5. **Rate Limiting:** Token bucket per API token (existing KV-based system)
6. **Input Validation:** Zod schemas for every tool input (reuse `packages/shared`)
7. **Output Sanitization:** Strip sensitive data from responses
8. **Audit Logging:** Every MCP tool call logged (user, tool, params, result status)
9. **Replay Protection:** Request nonces for write operations
10. **Token Rotation:** API tokens rotatable, OAuth refresh tokens with 30-day TTL

### MCP Plan Limits

| Resource            | Free | Starter | Pro | Agency |
| ------------------- | ---- | ------- | --- | ------ |
| MCP Access          | No   | No      | Yes | Yes    |
| API Calls/hour      | —    | —       | 100 | 1,000  |
| Write ops/hour      | —    | —       | 20  | 200    |
| Concurrent sessions | —    | —       | 2   | 10     |

---

## 5. Documentation Portal (`docs.llmboost.io`)

### Platform: Mintlify

### Structure

```
docs/
  introduction.mdx              → What is LLM Rank MCP?
  quickstart/
    claude-desktop.mdx           → 5-min setup with Claude Desktop
    cursor.mdx                   → Setup with Cursor IDE
    programmatic.mdx             → Connect from your own app (OAuth)
    docker.mdx                   → Docker one-liner setup
  authentication/
    api-tokens.mdx               → Token creation + management
    oauth.mdx                    → OAuth 2.1 flow + PKCE
    scopes.mdx                   → Permission scopes reference
  tools/
    overview.mdx                 → All 25 tools at a glance
    projects.mdx                 → Project tools + examples
    crawls.mdx                   → Crawl tools + examples
    pages.mdx                    → Page analysis tools
    scores.mdx                   → Score tools + trends
    issues.mdx                   → Issue tools + fix recommendations
    visibility.mdx               → AI visibility checking
    fixes.mdx                    → Fix generation
    strategy.mdx                 → Recommendations + content gaps
    competitors.mdx              → Competitor analysis
    reports.mdx                  → Markdown report generation
    content.mdx                  → Content analysis
    technical.mdx                → llms.txt + schema validation
    keywords.mdx                 → Keyword discovery
    queries.mdx                  → Visibility query suggestions
  resources/
    scoring-factors.mdx          → 37 scoring factors explained
    issue-codes.mdx              → Full issue catalog
    platform-requirements.mdx    → Per-LLM platform requirements
  guides/
    ci-cd-integration.mdx        → Add AI-readiness to your build pipeline
    content-pipeline.mdx         → Auto-optimize content before publish
    monitoring-dashboard.mdx     → Build an AI-readiness monitor
    competitor-tracking.mdx      → Automated competitor benchmarking
    agentic-seo-workflow.mdx     → End-to-end agent-driven SEO
  api-reference/
    rest-api.mdx                 → REST API reference (non-MCP users)
    rate-limits.mdx              → Rate limits by plan
    errors.mdx                   → Error codes + troubleshooting
  sdks/
    typescript.mdx               → TypeScript SDK usage
    python.mdx                   → Python SDK (future)
  changelog.mdx                  → Versioned changelog
  security.mdx                   → Security practices + responsible disclosure
```

### Documentation Principles

1. **Code-first:** Every tool page starts with a working code example
2. **Multi-language:** TypeScript + Python + cURL for every example
3. **Copy-paste quickstart:** Zero to working in <5 minutes
4. **Interactive playground:** Embedded tool tester on docs site
5. **Versioned:** All docs tied to MCP server version
6. **SEO-optimized:** Each doc page targets developer search queries

---

## 6. Landing Page — MCP Marketing Section

### Positioning

**"SEO Optimization for Your AI Agent"**

### Homepage Section

Add a dedicated MCP section to the existing homepage highlighting:

- One-line install for Claude Desktop / Cursor
- OAuth connection for custom apps
- Live code example showing agent analyzing a site
- "25 tools · 37 scoring factors · 6 AI platforms" tagline
- CTA buttons: View Docs, Try Live Playground, Get API Key
- Logos: Claude, Cursor, Copilot, Windsurf, Custom Agents

### Dedicated `/mcp` Page

- Interactive demo (try a tool without signing up)
- Setup guides per MCP client
- Use case showcases (CI/CD, content pipeline, monitoring)
- Pricing comparison (which plans include MCP)
- Developer social proof

---

## 7. Agentic SEO Strategy

### A. SEO for the MCP Product (Getting Found)

**Target Keywords:**

| Keyword                        | Intent     | Target Page     |
| ------------------------------ | ---------- | --------------- |
| `seo mcp server`               | Discovery  | /mcp            |
| `ai readiness mcp`             | Discovery  | /mcp            |
| `mcp server for seo`           | Discovery  | /mcp            |
| `claude desktop seo tools`     | Setup      | docs quickstart |
| `ai seo api`                   | Comparison | /mcp            |
| `llms.txt validator`           | Tool       | /scan + docs    |
| `ai search visibility checker` | Tool       | /scan           |
| `seo automation ai agent`      | Strategy   | blog posts      |
| `model context protocol seo`   | Education  | blog posts      |
| `dataforseo alternative mcp`   | Comparison | /mcp vs page    |

**Distribution Channels:**

1. Open-source MCP server on GitHub (stars → backlinks → SEO)
2. List on MCP directories (modelcontextprotocol.io, mcp.so, Smithery.ai)
3. Technical blog posts targeting "MCP for SEO" queries
4. Integration guides ranking for "[tool] + MCP" queries
5. Comparison pages against DataForSEO MCP, Nightwatch
6. Partner listings in Claude, Cursor, Copilot marketplaces

### B. Agentic SEO Positioning

LLM Rank is uniquely positioned in two layers:

1. **Optimizing FOR agents** — scoring how agent-ready sites are (existing platform)
2. **Optimizing WITH agents** — MCP tools so agents can fix sites (new capability)

No competitor does both.

### C. Growth Flywheel

```
Developer installs MCP → Agent analyzes site → Finds issues
  → Agent uses fix tools → Score improves → User upgrades plan
    → User shares setup → More developers discover
      → GitHub stars → SEO backlinks → Blog posts rank
        → More installs → (repeat)
```

### D. Competitive Differentiation

| Feature              | LLM Rank MCP   | DataForSEO MCP | Nightwatch | Ahrefs/SEMrush |
| -------------------- | -------------- | -------------- | ---------- | -------------- |
| AI-readiness scoring | 37 factors     | No             | No         | No             |
| llms.txt validation  | Yes            | No             | No         | No             |
| AI visibility checks | 6 platforms    | No             | Partial    | No             |
| Fix generation       | AI-powered     | No             | No         | No             |
| MCP server           | Dual transport | stdio only     | No         | No             |
| Open-source          | Yes            | Yes            | No         | No             |
| Content analysis     | AI + rules     | No             | No         | Rules only     |

### E. Integration Conversion Funnel

```
1. Discovery → GitHub repo, MCP directories, blog posts
2. Try → Live playground (no signup), npx one-liner
3. Convert → Free scan → see value → sign up for Pro
4. Retain → Agent automation saves hours/week → sticky
5. Expand → Agency plan for client management via MCP
```

**Conversion tactics:**

- Freemium MCP access with 10 calls/day (taste of value)
- GitHub-first distribution (README is the first doc)
- "Built with LLM Rank MCP" badge program
- Official listings in AI coding tool marketplaces
- Developer advocate tutorial content

---

## 8. Versioning Strategy

```
Semantic Versioning: MAJOR.MINOR.PATCH

v1.0.0 → Initial release (25 tools, stdio + Streamable HTTP)
v1.1.0 → New tools (keyword CRUD, persona CRUD, query CRUD)
v1.2.0 → Python SDK
v2.0.0 → Breaking changes (tool renames, schema changes)
```

**Version locations:**

- npm: `@llm-boost/mcp-server@1.0.0`
- API: `mcp.llmboost.io/v1/mcp`
- Docs: `docs.llmboost.io/v1/`
- Changelog: `docs.llmboost.io/changelog`

**Deprecation policy:** 6-month notice before removing tools. Old versions receive security patches for 12 months.

---

## 9. Research Sources

- [AgentMail](https://www.agentmail.to/) — Agentic-first positioning, SDK+MCP pattern, live demo
- [DataForSEO MCP](https://dataforseo.com/model-context-protocol) — SEO MCP reference implementation
- [OWASP MCP Security Guide](https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/) — Security best practices
- [MCP Best Practices](https://modelcontextprotocol.info/docs/best-practices/) — Architecture patterns
- [CData MCP Best Practices 2026](https://www.cdata.com/blog/mcp-server-best-practices-2026) — Performance, testing
- [Curity API Security 2026](https://curity.io/blog/api-security-trends-2026/) — OAuth 2.1, token patterns
- [Agentic AI in SEO](https://searchengineland.com/guide/agentic-ai-in-seo) — Market positioning
- [MCP Enterprise Adoption Guide](https://guptadeepak.com/the-complete-guide-to-model-context-protocol-mcp-enterprise-adoption-market-trends-and-implementation-strategies/) — Enterprise patterns
