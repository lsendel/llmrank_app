# URL Normalization, HTTPS Enforcement & Admin Controls

## Problem

Users paste full URLs like `https://www.agentmail.to/` into scan and project forms. The system stores and displays the protocol and trailing slash, which is noisy. Additionally, there's no control over HTTP vs HTTPS crawling and no way to block domains.

## Requirements

1. **Normalize domains** — strip protocol, `www.`, trailing slash. Preserve subdomains (`blog.example.com`). Store only clean domain.
2. **HTTPS by default** — crawler always tries `https://` first.
3. **HTTP fallback** — per-project toggle (paid plans only), gated by global admin toggle. Crawler tries HTTPS first, falls back to HTTP on failure.
4. **Admin blocklist** — super admin manages domains that cannot be crawled by anyone.

## Design

### 1. Domain Normalization Utility

**Location:** `packages/shared/src/utils/normalize-domain.ts`

```
normalizeDomain(input: string): string
```

Rules (in order):

1. Trim whitespace
2. Strip `http://` or `https://` prefix
3. Strip `www.` prefix (but NOT other subdomains)
4. Strip trailing `/` and any path
5. Lowercase

Examples:

- `https://www.agentmail.to/` → `agentmail.to`
- `http://blog.example.com/page` → `blog.example.com`
- `WWW.Example.COM` → `example.com`
- `shop.mysite.com` → `shop.mysite.com`

Applied at three layers:

- **Frontend:** on input blur, update field to normalized value
- **Zod schema:** transform in `CreateProjectSchema` and public scan validation
- **Crawler dispatch:** prepend `https://` when building `seed_urls`

### 2. Database Changes

#### New table: `blocked_domains`

| Column     | Type            | Notes                |
| ---------- | --------------- | -------------------- |
| id         | uuid PK         | defaultRandom()      |
| domain     | text, unique    | normalized domain    |
| reason     | text, nullable  | internal note        |
| blocked_by | uuid FK → users | which admin added it |
| created_at | timestamp       | defaultNow()         |

#### New table: `admin_settings`

| Column     | Type            | Notes              |
| ---------- | --------------- | ------------------ |
| key        | text PK         | setting identifier |
| value      | jsonb           | setting value      |
| updated_by | uuid FK → users | last modifier      |
| updated_at | timestamp       | defaultNow()       |

Initial setting: `http_fallback_enabled` → `{ "enabled": false }`

#### Modified: `projects.settings` jsonb

Add field: `allowHttpFallback: boolean` (default `false`)

#### Migration: existing project domains

Update all `projects.domain` values to normalized form (strip protocol, www, trailing slash).

### 3. API Changes

#### Admin endpoints

- `GET /admin/blocked-domains` — list all blocked domains
- `POST /admin/blocked-domains` — add domain `{ domain, reason? }`
- `DELETE /admin/blocked-domains/:id` — remove domain
- `GET /admin/settings` — get all admin settings
- `PUT /admin/settings/:key` — update setting (e.g. `http_fallback_enabled`)

#### Blocklist enforcement

Check blocked domains at three points:

1. `POST /api/public/scan` — before dispatching
2. `POST /api/projects` — before creating project
3. `POST /api/crawls` — before starting crawl (safety net)

Return `{ error: { code: "DOMAIN_BLOCKED", message: "This domain cannot be crawled" } }` (403)

#### Crawl dispatch changes

In `buildCrawlConfig()`:

1. Always prepend `https://` to seed URL
2. If project has `allowHttpFallback: true` AND admin `http_fallback_enabled` is true AND user plan is not `free`:
   - Add `allow_http_fallback: true` to crawl config
3. Crawler behavior: try HTTPS → on connection failure → retry HTTP → on failure → report error

### 4. Frontend Changes

#### Scan page (`apps/web/src/app/scan/client.tsx`)

- Placeholder: `example.com` (no protocol)
- On blur: normalize input with `normalizeDomain()`
- Submit sends clean domain

#### New project page (`apps/web/src/app/dashboard/projects/new/page.tsx`)

- Domain input placeholder: `example.com`
- On blur: normalize input
- Submit sends clean domain

#### Project display (dashboard, cards, lists)

- Show clean domain everywhere (no protocol prefix)

#### Crawl settings tab (project settings)

- New checkbox: "Allow HTTP fallback" — visible only for Starter/Pro/Agency
- Hidden entirely if admin global toggle is off
- Tooltip: "Try HTTP if HTTPS connection fails"

#### Admin dashboard (`/dashboard/admin`)

- New "Blocked Domains" section: table with domain, reason, date, remove button. Add form at top.
- New "Settings" section: "Allow HTTP fallback" toggle (global master switch)

### 5. Validation Flow

```
User input: "https://www.agentmail.to/"
         ↓
Frontend blur: normalizeDomain() → "agentmail.to"
         ↓
Zod schema: normalizeDomain() again (safety) → "agentmail.to"
         ↓
Blocklist check: is "agentmail.to" in blocked_domains? → pass/reject
         ↓
Store in DB: projects.domain = "agentmail.to"
         ↓
Crawl dispatch: seed_url = "https://agentmail.to"
         ↓
Crawler: fetch https://agentmail.to
         ↓ (if HTTPS fails AND http fallback enabled)
Crawler: fetch http://agentmail.to
```

### 6. Error Messages

| Scenario                              | Error                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Blocked domain                        | "This domain cannot be crawled" (403, DOMAIN_BLOCKED)                                     |
| Invalid domain format                 | "Please enter a valid domain (e.g. example.com)" (422, INVALID_DOMAIN)                    |
| HTTP-only site, free plan             | "This site doesn't support HTTPS. Upgrade to enable HTTP fallback." (422, HTTPS_REQUIRED) |
| HTTP-only site, paid but fallback off | "Enable HTTP fallback in crawl settings to crawl this site." (422, HTTPS_REQUIRED)        |

### 7. Files to Modify

| File                                                | Change                                             |
| --------------------------------------------------- | -------------------------------------------------- |
| `packages/shared/src/utils/normalize-domain.ts`     | New utility                                        |
| `packages/shared/src/schemas/project.ts`            | Use normalizeDomain in transform                   |
| `packages/db/src/schema/`                           | New tables: blocked_domains, admin_settings        |
| `packages/db/migrations/`                           | Migration for new tables + existing domain cleanup |
| `apps/api/src/routes/public.ts`                     | Blocklist check, normalization                     |
| `apps/api/src/routes/projects.ts`                   | Blocklist check, normalization                     |
| `apps/api/src/routes/crawls.ts`                     | Blocklist check, HTTP fallback config              |
| `apps/api/src/routes/admin.ts`                      | New endpoints for blocklist + settings             |
| `apps/web/src/app/scan/client.tsx`                  | Input normalization, placeholder                   |
| `apps/web/src/app/dashboard/projects/new/page.tsx`  | Input normalization, placeholder                   |
| `apps/web/src/app/dashboard/admin/page.tsx`         | Blocklist UI, settings toggle                      |
| `apps/web/src/app/dashboard/projects/[id]/page.tsx` | HTTP fallback checkbox in settings                 |
