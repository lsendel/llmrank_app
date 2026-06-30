# AI Platform Readiness + Crawler Lighthouse — Runbook

_Session log + operational runbook from the 2026-06-30 push to improve scoring accuracy for
project `cd19e84d` (families.care) and fix the long-broken Performance/Lighthouse signal._

## TL;DR — what shipped

| PR | What | State |
|---|---|---|
| #79 | Stop unmeasured Performance from inflating overall + per-platform scores (renormalize over measured categories) | merged |
| #80 | Integration insights anchor to **completed** crawls, not in-flight ones | merged |
| #81 | **Workers AI content-score calibration** (structure +13 / authority +8 / clarity +5) — the "LLM Quality 59 F" fix | merged + live |
| #84 | **Size-aware main-content extraction** for LLM scoring (strip nav/header/footer/aside when chrome >25%) | merged |
| #85 | **Data-driven** per-provider recommendations (replaces static `PLATFORM_TIPS`) | merged |
| #87 | Local Lighthouse (first attempt) — **STALLED prod crawls, reverted** | reverted (#88) |
| #89 | Crash-proof local Lighthouse (`kill_on_drop` + circuit-breaker + sampling) — safe but Chromium still hung on Fly | merged |
| #90 | **Lighthouse via PageSpeed Insights API** (server-side, no browser) — the working fix | merged + live |

Tracked issues: **#86** (crawler Lighthouse, full diagnosis), **#1680** (families.care content grounding, on the fleet branch).

Net result: **LLM Quality `60.1 F → 67.1 D`** (calibration) and **Performance now has real data** (`lighthouse_perf` ~0.95 via PSI) instead of being null on every page.

---

## 1. Scoring / measurement accuracy

### "LLM Quality" is the Workers AI content aggregate
The dashboard "LLM Quality / NN / grade" card = the average of the 5 LLM content sub-scores
(clarity/authority/comprehensiveness/structure/citation_worthiness) in `page_scores.detail.llmContentScores`,
produced **in production by Cloudflare Workers AI** (`@cf/openai/gpt-oss-120b`, `runWorkersAiScoring`
in `apps/api/src/services/llm-scoring.ts`) — **NOT** Anthropic Haiku. It legitimately diverges from
the deterministic upper-dashboard scores because it's a different, harsher signal.

**Validation method (Phase 0):** re-score a sample with **Haiku in BATCH mode** (50% off; the standing
preference) using the exact pipeline prompt (`packages/llm/src/prompts.ts` `buildContentScoringPrompt`)
on the same page text, and compare to the stored Workers AI scores. Result (n=60): Workers AI overall
**59.9** vs Haiku **66.6** (+6.7); Workers AI systematically under-rates **structure (+15.9)** and
**authority (+10.5)**. Cross-domain check (Wikipedia/Atlassian, replicating the scorer via the Cloudflare
AI REST API) confirmed the bias is **model-intrinsic**, not eldercare-specific.

**#81 calibration:** additive offsets at the `runWorkersAiScoring` boundary (structure +13, authority +8,
clarity +5; citation/comprehensiveness within noise → 0), clamped [0,100]. The KV cache stores **raw**
scores so offsets stay re-tunable without a cache bust. Verified on a re-crawl: LLM Quality `60.1 → 67.1`.
**Don't bother with Haiku-batch routing** — post-calibration the marginal gain is ~1.5 pts and it collides
with the D1-vs-Supabase persistence issue.

### Main-content extraction (#84)
`htmlToScoringText` previously kept ALL body text (nav/menus/footers), which dominates the truncated
4000-word scoring window on nav-heavy pages. #84 strips `<nav>/<header>/<footer>/<aside>` and prefers
`<main>/<article>` — but **only when chrome is >25% of the page** (size-aware). The naive "always strip"
version slightly regressed content-dense pages (families.care isn't nav-heavy); the size-aware version is
a strict improvement (big win on nav-heavy sites, zero change on light pages).

### Performance not-measured (#79)
Bulk crawls had null Lighthouse (see §2), so `scorePerformanceFactors` returned a fabricated 100,
inflating overall + per-platform (Copilot/Grok weight perf up to .25). #79 adds a `measured` flag and
**renormalizes weights over measured categories** when perf is absent. Made the families.care overall an
honest 84 (was an inflated 86).

### Data-driven tips (#85)
`derivePlatformTips` (`apps/api/src/services/platform-tips.ts`) ranks the project's actual issues by
`|scoreImpact| × affectedPages × PLATFORM_WEIGHTS[provider][category]` and surfaces the top-3 canonical
recommendations per provider. Static `PLATFORM_TIPS` is the fallback when there are no issues.

---

## 2. Crawler Lighthouse — the saga, and how it actually works now

### The original bug
`run_lighthouse: true` is set on every crawl, but the Rust crawler offloaded audits to a remote
`{API_BASE_URL}/api/browser/audit` endpoint **that does not exist** → every audit failed → swallowed to
`None` (warn-only) → `lighthouse_perf` NULL on 100% of pages. A 100% feature outage masquerading as null data.

### What went wrong, in order
1. **#87** switched to the local Chromium path. It **stalled and failed prod crawls** — `kill_on_drop`
   was absent, so timed-out audits **orphaned Chromium processes** that piled up and exhausted the 2GB
   Fly machine. Reverted (#88).
2. **#89** crash-proofed the local path: `.kill_on_drop(true)`, a per-crawl **circuit-breaker** (stop after
   3 consecutive failures), short timeout, and page **sampling** (`MAX_LIGHTHOUSE_PAGES`, default 25). No
   more stall — but `lighthouse_perf` was still null.
3. **Fly diagnosis** (with a `FLY_API_TOKEN`): `flyctl ssh console` showed all binaries present
   (chromium, lighthouse v13, node v20, `CHROME_PATH` correct) but `chromium --headless --dump-dom
   about:blank` **HANGS forever, silently** (no stdout, no stderr, every flag combo). Local Lighthouse is
   a dead end on this host. **Probing it on the prod machine degraded it** (health check → 0/1; needed a
   `flyctl machine restart`). Lesson: **never launch Chromium on the prod crawler to debug.**
4. **#90** pivoted to the **Google PageSpeed Insights API** — server-side Lighthouse, plain HTTP, no
   browser, no stall/leak surface. `run_psi_audit` GETs
   `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` and reads the same 0-1 category scores.

### How Lighthouse works now (#90)
- `LIGHTHOUSE_MODE` env: **`psi`** (default) / `local` (Chromium — hangs on Fly, DON'T use) / `off`.
- `PAGESPEED_API_KEY` env (falls back to `GOOGLE_API_KEY`). Keyless PSI is quota-exhausted — a key is required.
- Keeps #89's sampling + circuit-breaker, so a failing/rate-limited PSI degrades to null, never stalls.
- Verified: families.care pages return **perf ~0.94-0.96, seo 1.0**; the WAF does NOT block Google's fetch.

### The GCP key gotcha (cost me an hour)
The **new GCP "Create API key" flow forces you to pick allowed APIs up front**, so every existing key was
API-restricted to Gemini → PSI returned *"Requests to this API are blocked"* (distinct from the
"API not enabled" error). The fix: create a **fresh key with "PageSpeed Insights API" in its allowlist**
(or unrestricted) in project **`gen-lang-client-0549483979`** (where PSI is enabled). The GA4 service
account (`secrets/ga4-service-account.json`, project `families-care`) is Analytics-only — it can't enable
APIs or create keys (403), so this needs a console action. The current crawler key was created via the
gstack `/browse` headed browser with the user logged in.

---

## 3. Operational facts & gotchas (the "next time" gold)

- **Fly access:** `FLY_API_TOKEN` is now in the root `.env`; `flyctl` is installed at `~/.fly/bin/flyctl`.
  Use it: `export FLYCTL_INSTALL=$HOME/.fly; export PATH=$FLYCTL_INSTALL/bin:$PATH; export FLY_API_TOKEN=...`.
- **Crawler app:** `llmrank-crawler` (iad, 2GB/2vCPU, single machine). A crawler deploy restarts the
  machine and **kills in-flight crawls** — check for active crawls first; stall-recovery re-dispatches
  killed crawls within ~30 min as a fresh `job_id`.
- **Crawler Lighthouse env:** `LIGHTHOUSE_MODE=psi`, `PAGESPEED_API_KEY=<PSI-allowed GCP key>`,
  `MAX_LIGHTHOUSE_PAGES=25`. The `LIGHTHOUSE_REMOTE_URL` env was a temporary kill-switch (now unset);
  setting it again forces the old remote path (fast-fail → null). Stage secrets with
  `flyctl secrets set --stage ...` so the next `flyctl deploy` (CI) applies them in one restart.
- **NEVER launch Chromium on the prod crawler to debug** — it hangs, orphans processes, and degrades the
  machine. If you must, do it in a throwaway Fly machine or a local container.
- **families.care WAF** challenges curl + headless browsers but does NOT block Google PSI's fetch (and
  AI crawlers / `X-Smoke-Bypass` are allowlisted). See [[families-care-waf-needs-headed-browse]].
- **Shared working tree + concurrent codex agents:** the `llmrank_app` checkout is shared with codex
  agents that switch branches mid-operation → commits can land on the wrong branch. **Do all PR work in an
  isolated `git worktree` off `origin/main`** (`pnpm install --offline --ignore-scripts` in the fresh
  worktree; reuse the main `target/` via `CARGO_TARGET_DIR=<main>/apps/crawler/target` for fast Rust checks).
- **CI runs only `cargo check` + `cargo test`** for the crawler (not clippy) — so pre-existing clippy
  warnings don't block, but keep new code clean.
- **D1 schema:** `page_scores` has `job_id` directly (not via `pages`), plus `lighthouse_perf`,
  `lighthouse_seo`, and `detail` (JSON with `llmContentScores`). Query calibrated scores with
  `json_extract(detail,'$.llmContentScores.<dim>')`. `created_at` is `YYYY-MM-DD HH:MM:SS` while
  `updated_at` is ISO — wrap both in `datetime(...)` for stall comparisons.
- **Re-crawl:** `POST /api/v1/crawls {projectId}` with `LLMRANK_TOKEN` (root `.env`). No `GET /crawls/:id`
  — verify via `/projects/:id/metrics` or query D1. A re-crawl is needed for scoring changes (#81, #84,
  #90) to show on the dashboard.
- **Anthropic scoring = BATCH mode** (50% off) — standing rule for any Anthropic content scoring.

---

## 4. Open items / what's next

- **The real ceiling past LLM Quality ~67 is content quality, not measurement.** The two dominant content
  warnings (CONTENT_DEPTH/comprehensiveness, CITATION_WORTHINESS, ~1,990 pages each) are REAL — both Haiku
  and Workers AI agree. The lever is the **Dagster-generated content** (a sections→grounding extractor for
  richer, citable descriptions — issue **#1680** in families.care). ⚠️ The content pipeline runs on the
  **`feat/dagster-migration` fleet branch**, not `main` — generator changes from `main` don't reach prod
  (see [[families-care-pipeline-runs-fleet-branch]]). This is already in active development by concurrent
  codex agents (`fix/enrich-sections-grounding`, `codex/live-description-quality-audit-fleet`) — coordinate,
  don't duplicate.
- **POOR_READABILITY** (fires 1997/2000) is NOT a scorer bug — median Flesch 46, content is genuinely
  college-level. It's a content problem, not a calibration one.
- **Leftover cleanup** (never actioned): the throwaway `claude-recrawl-verify` API token + the `familias.care`
  verification project (`76b19c79…`) created earlier — keep or revoke/delete.

## 5. Handy commands

```bash
# Re-crawl families.care (applies scoring changes)
export LLMRANK_TOKEN=$(grep '^LLMRANK_TOKEN=' .env | cut -d= -f2- | tr -d '"')
curl -sX POST https://api.llmrank.app/api/v1/crawls -H "Authorization: Bearer $LLMRANK_TOKEN" \
  -H 'Content-Type: application/json' -d '{"projectId":"cd19e84d-0b41-4e09-b908-c36bb39ca399"}'

# Check a crawl's calibrated LLM Quality + lighthouse coverage in D1
npx wrangler d1 execute llmrank-app --remote --json --command "
  SELECT cj.status, cj.pages_scored,
    (SELECT COUNT(*) FROM page_scores ps WHERE ps.job_id=cj.id AND ps.lighthouse_perf IS NOT NULL) AS lh,
    (SELECT ROUND(AVG((json_extract(ps.detail,'\$.llmContentScores.clarity')+json_extract(ps.detail,'\$.llmContentScores.authority')+json_extract(ps.detail,'\$.llmContentScores.comprehensiveness')+json_extract(ps.detail,'\$.llmContentScores.structure')+json_extract(ps.detail,'\$.llmContentScores.citation_worthiness'))/5.0),1) FROM page_scores ps WHERE ps.job_id=cj.id) AS llm_quality
  FROM crawl_jobs cj WHERE cj.id='<JOB_ID>'"

# Fly: crawler health / secrets / restart
export FLYCTL_INSTALL=$HOME/.fly; export PATH=$FLYCTL_INSTALL/bin:$PATH
export FLY_API_TOKEN=$(grep '^FLY_API_TOKEN=' .env | cut -d= -f2- | tr -d '"')
flyctl machine status <machine-id> -a llmrank-crawler
flyctl secrets set --stage PAGESPEED_API_KEY=... LIGHTHOUSE_MODE=psi -a llmrank-crawler

# Test PSI directly (the audit backend)
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Ffamilies.care&category=performance&strategy=mobile&key=$PSI_KEY"
```
