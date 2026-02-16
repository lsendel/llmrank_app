# Remaining Features Design — Ship Everything

**Date:** 2026-02-16
**Goal:** Complete all pending features from the 10-feature roadmap. 6 work sections covering 7 features.

**Already done:** AI Fixes (F1), Competitor Benchmarking (F2), Trends/Regressions (F4), Copilot Provider, Apply Fix UI, Usability Improvements (delta arrows, regression alerts, progress card, next-steps).

---

## Section 1: Email Digests Completion (Feature 3)

**Existing:** `digest-service.ts`, weekly/monthly email templates, `digestFrequency`/`digestDay`/`lastDigestSentAt` columns on users table.

**What's missing:**

1. **Cron trigger** — Wire `scheduled()` handler in `apps/api/src/index.ts` to call digest service. Add cron triggers to `wrangler.toml`:
   - `"0 8 * * 1"` — Mondays 8 AM UTC → weekly digests
   - `"0 8 1 * *"` — 1st of month 8 AM UTC → monthly digests

2. **Settings UI** — Add "Email Notifications" section to account settings page (`apps/web/src/app/dashboard/settings/page.tsx`). Radio group: Off / Weekly / Monthly. Day picker (Mon-Sun for weekly, 1-28 for monthly). Calls existing `api.account.updateProfile()`.

3. **Test** — Unit test the cron dispatch logic and digest service method calls.

**Files:**

- Modify: `apps/api/src/index.ts` (scheduled handler)
- Modify: `wrangler.toml` (cron triggers)
- Modify: `apps/web/src/app/dashboard/settings/page.tsx` (digest UI)
- Create: `apps/api/src/__tests__/services/digest-service.test.ts`

---

## Section 2: Custom Scoring Profiles (Feature 7)

**Purpose:** Let users adjust category weights (Technical/Content/AI Readiness/Performance) per project. Industry presets for quick setup.

### Schema

```sql
CREATE TABLE scoring_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(128) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  weights JSONB NOT NULL, -- { technical: 25, content: 30, aiReadiness: 30, performance: 15 }
  disabled_factors JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### Scoring Engine Change

`packages/scoring/src/engine.ts` — `scorePageFactors()` accepts optional `weights` parameter. Default stays 25/30/30/15. The function normalizes weights to sum to 100.

### Industry Presets

```ts
const PRESETS = {
  default: { technical: 25, content: 30, aiReadiness: 30, performance: 15 },
  ecommerce: { technical: 30, content: 20, aiReadiness: 35, performance: 15 },
  blog: { technical: 15, content: 40, aiReadiness: 30, performance: 15 },
  saas: { technical: 25, content: 25, aiReadiness: 35, performance: 15 },
  local_business: {
    technical: 30,
    content: 25,
    aiReadiness: 25,
    performance: 20,
  },
};
```

### API Routes

- `POST /api/scoring-profiles` — Create profile
- `GET /api/scoring-profiles` — List user's profiles
- `PUT /api/scoring-profiles/:id` — Update profile
- `DELETE /api/scoring-profiles/:id` — Delete profile
- `PUT /api/projects/:id/scoring-profile` — Assign profile to project

### Frontend

Project settings tab → "Scoring Profile" section:

- Dropdown with presets + "Custom" option
- 4 range sliders that must sum to 100 (live validation)
- Save button

**Files:**

- Modify: `packages/db/src/schema.ts` (add table)
- Create: `packages/db/src/queries/scoring-profiles.ts`
- Modify: `packages/scoring/src/engine.ts` (optional weights param)
- Create: `packages/scoring/src/profiles.ts` (presets)
- Create: `apps/api/src/routes/scoring-profiles.ts`
- Modify: `apps/api/src/index.ts` (mount route)
- Modify: `apps/web/src/lib/api.ts` (client methods)
- Create: `apps/web/src/components/settings/scoring-profile-section.tsx`
- Modify: `apps/web/src/components/tabs/settings-tab.tsx` (add section)

---

## Section 3: Bulk Export & Content Generators (Features 8 + 9)

### CSV/JSON Export

`GET /api/projects/:id/export?format=csv` — Returns all pages from latest crawl with columns: URL, Overall Score, Technical, Content, AI Readiness, Performance, Letter Grade, Issue Count, Top Issues.

Lightweight CSV serializer — no external library. JSON format also supported via `format=json`.

### Sitemap Generator

`POST /api/projects/:id/generate/sitemap` — Pulls all pages from latest completed crawl, generates valid XML sitemap. Returns XML content.

### llms.txt Generator

`POST /api/projects/:id/generate/llms-txt` — Builds llms.txt from crawl data following the spec. Returns plain text.

### Frontend

- Export dropdown button on project overview ("Export CSV" / "Export JSON")
- "Generate" dropdown on project overview ("Generate Sitemap" / "Generate llms.txt")
- Modal with preview, copy-to-clipboard, and download buttons for generators

**Files:**

- Create: `apps/api/src/routes/exports.ts`
- Create: `apps/api/src/services/generator-service.ts`
- Create: `apps/api/src/routes/generators.ts`
- Modify: `apps/api/src/index.ts` (mount routes)
- Modify: `apps/web/src/lib/api.ts` (client methods)
- Create: `apps/web/src/components/generators/generator-modal.tsx`
- Modify: `apps/web/src/components/tabs/overview-tab.tsx` (add buttons)

---

## Section 4: Public Leaderboard & Benchmarks (Feature 10)

### Aggregation Cron

Daily job queries all completed crawls from last 30 days, computes percentile distribution (p10, p25, p50, p75, p90), stores in KV as `benchmarks:overall`.

### Public API

`GET /api/public/benchmarks` — Returns percentile data from KV cache. No auth required.

### Percentile Badge

Dashboard home shows contextual badge: "Your average score of 83 puts you in the top 15% of all sites scanned."

### Leaderboard Page

`/leaderboard` — Opt-in public ranking. Projects must explicitly opt-in via settings (`leaderboardOptIn` boolean on projects table). Display: rank, domain, score, grade, trend arrow. Filterable by score range.

**Files:**

- Create: `apps/api/src/services/benchmark-aggregation-service.ts`
- Modify: `apps/api/src/index.ts` (cron handler + mount)
- Modify: `apps/api/src/routes/public.ts` (benchmarks endpoint)
- Modify: `packages/db/src/schema.ts` (add leaderboardOptIn to projects)
- Modify: `apps/web/src/lib/api.ts` (client methods)
- Create: `apps/web/src/components/percentile-badge.tsx`
- Modify: `apps/web/src/app/dashboard/page.tsx` (add badge)
- Create: `apps/web/src/app/leaderboard/page.tsx`

---

## Section 5: Team Collaboration & RBAC (Feature 5)

The largest feature. Enables agency/enterprise use cases.

### Schema

```sql
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id),
  plan plan NOT NULL DEFAULT 'free',
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role team_role NOT NULL DEFAULT 'viewer',
  invited_at TIMESTAMP DEFAULT now() NOT NULL,
  accepted_at TIMESTAMP
);

CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id),
  email VARCHAR(256) NOT NULL,
  role team_role NOT NULL DEFAULT 'viewer',
  token VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
```

Add optional `teamId` to `projects` table for team-owned projects.

### Permission Matrix

| Action         | Owner | Admin | Editor | Viewer |
| -------------- | ----- | ----- | ------ | ------ |
| Manage billing | Yes   | No    | No     | No     |
| Manage team    | Yes   | Yes   | No     | No     |
| CRUD projects  | Yes   | Yes   | Yes    | No     |
| Start crawls   | Yes   | Yes   | Yes    | No     |
| Generate fixes | Yes   | Yes   | Yes    | No     |
| View data      | Yes   | Yes   | Yes    | Yes    |

### Auth Middleware

`teamAuth` middleware reads `teamId` from route/query, verifies membership, checks role permissions. Sets `c.set("teamRole", role)`.

### API Routes

- `POST /api/teams` — Create team
- `GET /api/teams` — List user's teams
- `GET /api/teams/:id` — Get team detail
- `POST /api/teams/:id/invite` — Send invitation email
- `POST /api/teams/accept-invite` — Accept invitation via token
- `PATCH /api/teams/:id/members/:memberId` — Update role
- `DELETE /api/teams/:id/members/:memberId` — Remove member

### Frontend

- `/dashboard/team` page with member list, invite dialog, role management
- Team switcher in nav (when user belongs to multiple teams)
- Project creation UI updated to allow team-owned projects

**Files:**

- Modify: `packages/db/src/schema.ts` (3 tables + projects teamId)
- Create: `packages/db/src/queries/teams.ts`
- Create: `apps/api/src/middleware/team-auth.ts`
- Create: `apps/api/src/routes/teams.ts`
- Modify: `apps/api/src/index.ts` (mount route)
- Modify: `apps/web/src/lib/api.ts` (client methods)
- Create: `apps/web/src/app/dashboard/team/page.tsx`
- Create: `apps/web/src/components/team/` (invite-dialog, member-list, role-badge)

---

## Section 6: WordPress Plugin Completion (Feature 6)

### Gutenberg Sidebar Panel

React sidebar panel that:

1. Extracts post title, content, meta description from editor
2. Sends to `POST /api/v1/score` for real-time scoring
3. Displays score circle, top 3 issues, AI fix suggestions
4. Debounced scoring on content change (5s delay)

### Lightweight Scoring Endpoint

`POST /api/v1/score` — Accepts `{ title, content, url, metaDescription }`, runs subset of scoring engine (no crawl, no Lighthouse), returns `{ overall, technical, content, aiReadiness, issues: [...top5] }`. Auth via API token.

### Dashboard Sync

WP plugin settings connect to LLM Boost project via API key. Syncs page scores back to the project.

**Files:**

- Create: `apps/api/src/routes/v1.ts` (lightweight scoring)
- Modify: `apps/api/src/index.ts` (mount)
- Modify: `apps/wordpress-plugin/src/Admin/Settings.php` (project sync)
- Create: `apps/wordpress-plugin/assets/js/editor-panel.js` (Gutenberg sidebar)
- Create: `apps/wordpress-plugin/assets/css/editor-panel.css`

---

## Execution Order

| Phase | Section                   | Est. Tasks | Dependencies |
| ----- | ------------------------- | ---------- | ------------ |
| 1     | Email Digests (S1)        | 3          | None         |
| 2     | Custom Scoring (S2)       | 5          | None         |
| 3     | Exports & Generators (S3) | 4          | None         |
| 4     | Leaderboard (S4)          | 4          | None         |
| 5     | Teams & RBAC (S5)         | 6          | None         |
| 6     | WordPress Plugin (S6)     | 4          | None         |

Phases 1-4 are fully independent and can be parallelized via subagents. Phase 5 (Teams) is the largest and most isolated. Phase 6 (WordPress) can run in parallel with Phase 5.

**Total: ~26 tasks across 6 phases.**
