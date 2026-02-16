# Agency Features Bundle — Design

**Date:** 2026-02-16
**Status:** Approved
**Goal:** Ship 6 features required to attract and retain Agency-tier ($299/mo) customers.

## Approach: Wire & Ship

Most features are 60-90% implemented with code in untracked files on the `refactor/ddd-clean-code-perf-v2` branch. The main work is wiring existing code into the schema/routes/UI, plus building 2 features from scratch (Export, WordPress Gutenberg).

## Current State

| Feature              | Status | Remaining                                            |
| -------------------- | ------ | ---------------------------------------------------- |
| Teams & RBAC         | ~90%   | Schema tables + mount routes + export queries        |
| Email Digests        | ~85%   | Verify cron wiring + integrate UI into settings      |
| White-Label Branding | ~30%   | R2 upload route + branding service + PDF integration |
| Scoring Profiles     | ~20%   | Schema + API routes + UI + wire scoring pipeline     |
| Bulk Export          | 0%     | Everything from scratch                              |
| WordPress Plugin     | ~15%   | Gutenberg panel + lightweight scoring endpoint       |

---

## Section 1: Teams & RBAC

### What Exists

- `packages/db/src/queries/organizations.ts` — Full CRUD for orgs, members, invites
- `packages/db/src/queries/audit-logs.ts` — Audit log queries
- `apps/api/src/services/organization-service.ts` — Service with RBAC enforcement
- `apps/api/src/routes/organizations.ts` — Complete REST routes
- `apps/api/src/lib/audit.ts` — Audit logging utility
- `packages/shared/src/domain/permissions.ts` — Permission matrix (owner/admin/member/viewer, 14 permissions)
- `apps/web/src/components/settings/team-section.tsx` — Team management UI
- `apps/web/src/components/settings/audit-log-section.tsx` — Audit log viewer
- `apps/web/src/components/settings/sso-configuration.tsx` — SSO config
- Settings page already has Team/SSO/Audit Log tabs with dynamic imports

### Remaining Work

1. Add schema tables to `packages/db/src/schema.ts`:
   - `orgRoleEnum` — pgEnum for owner/admin/member/viewer
   - `organizations` — id, name, slug, plan, settings, ssoEnabled, ssoProvider, ssoConfig, createdAt, updatedAt
   - `orgMembers` — id, orgId, userId, role, invitedBy, invitedAt, acceptedAt
   - `orgInvites` — id, orgId, email, role, token, invitedBy, expiresAt, acceptedAt, createdAt
   - `auditLogs` — id, orgId, userId, action, resourceType, resourceId, metadata, ipAddress, createdAt
2. Export queries from `packages/db/src/index.ts`
3. Mount routes in `apps/api/src/index.ts` as `/api/orgs`
4. Run `drizzle-kit push`
5. Integration test: create org → invite → accept → RBAC check

### Risk

Queries reference schema symbols that don't exist yet — may need minor import fixes after adding tables.

---

## Section 2: Email Digests

### What Exists

- `packages/db/src/schema.ts` — `digestFrequency`, `digestDay`, `lastDigestSentAt` on users
- `packages/db/src/queries/digest-preferences.ts` — Preference queries
- `apps/api/src/services/digest-service.ts` — `processWeeklyDigests()` + `processMonthlyDigests()`
- `apps/api/src/services/email-templates/weekly-digest.ts` + `monthly-digest.ts`
- `apps/api/wrangler.toml` — Cron triggers: `0 9 * * 1` (weekly Mon 9AM), `0 9 1 * *` (monthly 1st 9AM)
- `apps/web/src/components/settings/digest-preferences-section.tsx` (untracked)

### Remaining Work

1. Verify `scheduled()` handler calls digest service for the correct cron patterns
2. Integrate digest preferences UI into the settings page Notifications tab (or add separate Digest tab)
3. Verify API endpoint for updating digest preferences exists in account routes
4. Add unit test for cron dispatch → service call

---

## Section 3: White-Label Report Branding

### What Exists

- `packages/db/src/schema.ts` — `branding: jsonb("branding").default({})` on projects
- `apps/web/src/components/forms/branding-settings-form.tsx`
- `apps/web/src/components/settings/branding-section.tsx` (stub)
- `apps/web/src/components/report/report-template.tsx`

### Remaining Work

1. Create `POST /api/projects/:id/branding/logo` — Upload to R2 (max 2MB, PNG/SVG/JPG), return URL
2. Create `PUT /api/projects/:id/branding` — Save branding config (companyName, primaryColor, logoUrl)
3. Modify PDF report templates to consume branding:
   - Header: custom logo (or LLM Boost logo if none), company name
   - Accent color for headings and borders
   - Footer: company name instead of "LLM Boost"
4. Wire `BrandingSection` component to call correct API endpoints
5. Plan gating: Agency = full branding, Pro = logo only, Starter/Free = none

---

## Section 4: Custom Scoring Profiles

### What Exists

- `packages/db/src/schema.ts` — `scoringProfileId: uuid("scoring_profile_id")` on projects
- `packages/scoring/src/profiles.ts` — `ScoringWeights`, `DEFAULT_WEIGHTS`, `SCORING_PRESETS`, `normalizeWeights()`
- `packages/scoring/src/engine.ts` — `scorePage()` accepts `customWeights?: ScoringWeights`
- `packages/db/src/queries/scoring-profiles.ts` (untracked) — CRUD queries

### Remaining Work

1. Add `scoringProfiles` table to `schema.ts`:
   - id, userId, name, isDefault, weights (jsonb), disabledFactors (jsonb), createdAt
2. Export scoring profile queries from db index
3. Create `apps/api/src/routes/scoring-profiles.ts`:
   - `POST /api/scoring-profiles` — Create profile
   - `GET /api/scoring-profiles` — List user's profiles
   - `PUT /api/scoring-profiles/:id` — Update
   - `DELETE /api/scoring-profiles/:id` — Delete
   - `PUT /api/projects/:id/scoring-profile` — Assign profile to project
4. Mount in index.ts
5. Build UI in project settings: preset dropdown + 4 weight sliders (must sum to 100) + save
6. Wire scoring pipeline: when scoring a crawl, load the project's scoring profile and pass weights to `scorePage()`
7. Plan gating: Agency = full custom, Pro = presets only, Starter/Free = default only

---

## Section 5: Bulk CSV/JSON Export (From Scratch)

### Design

- `GET /api/projects/:id/export?format=csv` — All pages from latest completed crawl
- `GET /api/projects/:id/export?format=json` — Same data as JSON
- Lightweight CSV serializer: no external library, string concatenation with proper escaping
- Columns: URL, Overall Score, Technical, Content, AI Readiness, Performance, Letter Grade, Issue Count, Top Issues
- Response headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="project-export.csv"`

### Files

- Create: `apps/api/src/routes/exports.ts`
- Modify: `apps/api/src/index.ts` (mount route)
- Modify: `apps/web/src/lib/api.ts` (export method)
- Modify: `apps/web/src/components/tabs/overview-tab.tsx` (add export dropdown button)

### Plan Gating

- Starter+: CSV export
- Pro+: JSON with full issue detail
- Agency: unlimited + includes competitor data

---

## Section 6: WordPress Plugin (Gutenberg + Scoring)

### What Exists

- `apps/wordpress-plugin/llm-boost.php` — Plugin bootstrap
- `apps/wordpress-plugin/src/Admin/Settings.php` — API key settings
- `apps/wordpress-plugin/src/Generator/LLMSTxt.php` — llms.txt skeleton
- `apps/api/src/routes/v1.ts` — v1 routes (may have lightweight scoring endpoint)

### Remaining Work

1. Verify/complete `POST /api/v1/score` endpoint — accepts `{ title, content, url, metaDescription }`, returns `{ overall, technical, content, aiReadiness, issues: [...top5] }`. Auth via API token.
2. Build Gutenberg sidebar panel (`assets/js/editor-panel.js`):
   - React component registered via `wp.plugins.registerPlugin`
   - Extracts post data from `wp.data.select('core/editor')`
   - Debounced API call (5s delay) on content change
   - Displays: score circle (SVG), category breakdown, top 3 issues, AI fix button
3. Register panel in `llm-boost.php` via `enqueue_block_editor_assets`
4. Style: `assets/css/editor-panel.css`
5. Complete llms.txt generator in `Generator/LLMSTxt.php`

---

## Execution Order

| Phase | Features                    | Tasks | Strategy                                 |
| ----- | --------------------------- | ----- | ---------------------------------------- |
| **1** | Teams + Digests             | 6     | Parallel — both are "wire existing code" |
| **2** | Branding + Scoring Profiles | 9     | Parallel — independent features          |
| **3** | Export + WordPress          | 7     | Parallel — independent features          |

Phases are sequential (1 → 2 → 3). Tasks within each phase can be parallelized via subagents.

**Total: ~22 tasks across 3 phases.**
