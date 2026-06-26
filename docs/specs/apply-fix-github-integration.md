# Spec: "Apply Fix → Open PR" GitHub Integration

Status: Proposed
Owner: TBD
Last updated: 2026-06-26

## Why

Today LLM Rank diagnoses issues and can generate fix text ("AI Fix"), but the
only terminal action is **copy / download**. The user has to leave the product,
find the right file, paste, and ship. For customers whose sites live in a Git
repo, we can close the loop: turn a recommendation into a reviewed pull request.

This is the difference between "LLM Rank tells you what's wrong" and "LLM Rank
fixes it for you" — the single biggest lever on activation and retention. It
also makes the existing AI-fix output actually useful instead of a dead end.

Non-goal for v1: auto-merging or editing production directly. We open a PR a
human reviews. Safety and trust first.

## User story

1. In Settings → Integrations, the user clicks **Connect GitHub** and installs
   the LLM Rank GitHub App on the repo backing their site.
2. They map the project's domain to that repo (and optionally a content root,
   e.g. `content/` or `src/app/`).
3. On any supported issue, the expanded `IssueCard` now shows **Apply fix → PR**
   next to "AI Fix".
4. Clicking it generates the fix (existing flow), proposes a concrete file edit,
   shows a diff preview, and on confirm opens a branch + PR in their repo with a
   clear title/body linking back to the LLM Rank issue.
5. The action item moves to "In Progress"; when the next crawl confirms the
   issue is resolved, it auto-moves to "Fixed" (existing verify-by-crawl path).

## Where this plugs into existing code

- Fix generation already exists: `apps/api/src/routes/fixes.ts` →
  `apps/api/src/services/fix-generator-service.ts` (`FIX_PROMPTS`, 13+ issue
  codes, model `claude-sonnet-4-6`). Reuse verbatim — this spec adds an
  _applicator_ layer on top of the generated text, not a new generator.
- The fix UI is `apps/web/src/components/ai-fix-button.tsx` and
  `apps/web/src/components/issue-card.tsx`. Add an `ApplyFixButton` beside the
  existing one, gated on "repo connected for this project".
- Integration catalog lives in `apps/api/src/routes/integrations.ts` (today:
  Cloudflare, GSC, GA4, Meta, MCP, WordPress=coming_soon, Slack=coming_soon).
  Add `github` here.
- Action items / verify-by-crawl already exist (`IssueCard` status select,
  `verifiedByCrawlId`). Reuse for the PR lifecycle.

## Architecture

### 1. GitHub App (not OAuth token)

Create a **GitHub App** (org-installable, least privilege):

- Permissions: `contents: read & write`, `pull_requests: write`, `metadata: read`.
- No `workflows`, no admin. Per-repo installation chosen by the user.
- Store the App's private key as a Worker secret (`GITHUB_APP_PRIVATE_KEY`,
  `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID/SECRET`, `GITHUB_WEBHOOK_SECRET`).
- Auth flow: installation → webhook gives us `installation_id`; we mint short-
  lived installation tokens on demand (JWT signed with the App key → `POST
/app/installations/{id}/access_tokens`). Never store long-lived tokens.

### 2. Data model (D1_APP)

```
github_installations
  id, user_id, installation_id (unique), account_login, created_at

repo_connections
  id, project_id (unique FK), installation_id FK, repo_full_name,
  default_branch, content_root (nullable), file_strategy ('auto'|'manual'),
  created_at, updated_at
```

(One repo per project for v1. Multi-repo later.)

### 3. The applicator (the hard part)

Generated fix text → concrete file change. Three tiers, pick per issue code:

- **Tier A — site-level files (deterministic).** `MISSING_LLMS_TXT`,
  `AI_CRAWLER_BLOCKED` (robots.txt), `MISSING_SITEMAP`, `NO_STRUCTURED_DATA` at
  root. The fix _is_ a file. Write/patch `public/llms.txt`, `public/robots.txt`,
  etc. Highest confidence, ship first.
- **Tier B — locate-then-edit (assisted).** `META_DESC_LENGTH`,
  `MISSING_TITLE`, `MISSING_OG_TAGS`, `MISSING_ALT_TEXT`. Use the GitHub code
  search API + the crawled page URL → route mapping to find the candidate
  file, propose a targeted edit, **always show the diff for confirmation**.
  Never silently edit when confidence is low.
- **Tier C — content/body (manual handoff).** `THIN_CONTENT`,
  `LOW_EEAT_SCORE`. Too site-specific to auto-place; generate the content and
  open a PR that adds it to a `llmrank/proposed/` staging path with
  instructions, or just attach as a PR comment. Don't pretend to know the CMS.

Each connection declares `file_strategy`; default `auto` only enables Tier A.

### 4. API routes (new, under `apps/api/src/routes/`)

- `GET  /api/integrations/github/install-url` → App install URL + state.
- `POST /api/integrations/github/callback` → record installation.
- `POST /api/integrations/github/webhook` → handle `installation`,
  `installation_repositories` (HMAC-verify `GITHUB_WEBHOOK_SECRET`).
- `GET  /api/projects/:id/repo` / `PUT` → read/set `repo_connections`.
- `POST /api/fixes/apply` → body `{ projectId, pageId?, issueCode }`:
  1. generate fix (reuse `generateFix`),
  2. resolve target file(s) via the applicator tier,
  3. create branch `llmrank/fix-<issueCode>-<short>`,
  4. commit the change, open PR, return `{ prUrl, diff }`.
     Plan-gate the same way `fixes.generate` is gated.

### 5. Frontend

- Settings → Integrations: GitHub card (connect, pick repo, set content root,
  choose `auto`/`manual`).
- `ApplyFixButton`: visible only when `repo_connections` exists for the project.
  Generate → diff preview modal → "Open PR" → toast with PR link.
- Reuse `AiFixButton`'s generate path; add the apply step after.

## Security & trust

- Least-privilege GitHub App, per-repo install, short-lived tokens.
- Always open a PR to a **new branch**; never push to default, never auto-merge.
- Diff preview + explicit confirm for every Tier B/C apply.
- Webhook HMAC verification; reject replays.
- Audit log row per apply (who, project, issue, PR url) in D1_ADMIN audit table.
- Prompt-injection guard already in `FIX_PROMPTS` carries over; additionally,
  never let generated text choose the target path — the applicator decides.

## Rollout

- **Phase 1 (Tier A only):** GitHub App + connect flow + `llms.txt`/`robots.txt`
  PRs. This alone covers the highest-severity AI-readiness fixes
  (`MISSING_LLMS_TXT`, `AI_CRAWLER_BLOCKED`) and is fully deterministic.
- **Phase 2 (Tier B):** meta/title/OG/alt with code-search location + diff
  confirm.
- **Phase 3 (Tier C):** content staging PRs + WordPress write-back (the existing
  `wordpress` coming_soon integration shares the connect/apply UI).

## Effort (rough)

- Phase 1: ~3-5 days (App registration, install/webhook, token minting, D1
  tables, `/fixes/apply` Tier A, connect UI, ApplyFixButton).
- Phase 2: ~3-4 days (code search + route→file mapping + diff modal).
- Phase 3: ~1-2 weeks (content placement heuristics + CMS write-back).

## Open questions

- Route → source-file mapping for arbitrary frameworks (Next.js app router vs
  pages vs Astro vs Hugo). Start with a per-connection `content_root` hint and a
  small framework detector; expand from telemetry on confirmed PRs.
- Monorepo support (multiple sites in one repo) — defer past v1.
- Do we offer this on all paid tiers or gate to Pro+? (Recommend Pro+.)
