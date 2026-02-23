# Public Sharing — Design Document

**Date:** 2026-02-16
**Status:** Approved

## Overview

Enable users to share their AI-readiness score reports publicly via shareable links and embeddable card-style badges. Users control the detail level (summary, issues, full) and link expiry (permanent or time-limited). Builds on existing `shareToken`/`shareEnabled` infrastructure in `crawlJobs`.

## Goals

1. Shareable public report pages with configurable detail levels
2. Embeddable card-style SVG badges for READMEs, docs, emails
3. Lead capture gate on public reports
4. OG/Twitter meta tags for rich social previews
5. Foundation for future client deliverables and competitive benchmarking

## Data Model

Two new columns on `crawlJobs`:

| Column           | Type                                | Default   | Purpose                                  |
| ---------------- | ----------------------------------- | --------- | ---------------------------------------- |
| `shareLevel`     | pgEnum: `summary`, `issues`, `full` | `summary` | Controls data shown on public page       |
| `shareExpiresAt` | `timestamp`                         | `null`    | Null = permanent, otherwise auto-expires |

Existing columns used: `shareToken` (UUID), `shareEnabled` (boolean), `sharedAt` (timestamp).

## API Endpoints

### Authenticated (project owner)

- **`POST /api/projects/:id/share`** — Enable sharing
  - Body: `{ level: "summary" | "issues" | "full", expiresAt?: string }`
  - Returns: `{ token, shareUrl, badgeUrl, level, expiresAt }`
- **`PATCH /api/projects/:id/share`** — Update level/expiry (keeps same token)
  - Body: `{ level?, expiresAt? }`
- **`DELETE /api/projects/:id/share`** — Revoke sharing
  - Sets `shareEnabled=false`, clears token

### Public (unauthenticated)

- **`GET /api/public/reports/:token`** (modify existing) — Add expiry check, filter response by `shareLevel`
- **`GET /api/public/badge/:token.svg`** (new) — Card-style SVG badge

## Share Levels

### Summary

- Overall score + letter grade
- 4 category scores (Technical, Content, AI Readiness, Performance)
- Domain, scan date, pages crawled

### Issues (Summary + top issues)

- Everything from Summary
- Top 10 issues grouped by severity (critical > info)
- Each issue: code, message, recommendation, affected page count

### Full (mini dashboard)

- Everything from Issues
- Per-page score table (sortable)
- Quick wins with effort/impact
- Score history chart (multi-crawl)
- Visibility data (LLM provider mention rates)

## Public Report Page

**Route:** `/share/[token]` (Next.js App Router)

Renders based on `shareLevel`. All modes include:

- "Powered by LLM Rank" footer
- OG / Twitter meta tags with score + grade in og:image
- Lead capture gate (optional email wall before full access)
- CTA: "Get your free AI-readiness scan"
- Responsive / mobile-friendly

## Embeddable Badge

**Card-style SVG** (~320x120px) served at `/api/public/badge/:token.svg`:

```
+-------------------------------------+
|  AI Readiness Score                  |
|  +---+                               |
|  | A |  94 / 100                     |
|  +---+                               |
|  Tech 88 . Content 96 . AI 98 . Perf 91 |
|  example.com . Scanned Feb 2026     |
|  --- Powered by LLM Rank ---       |
+-------------------------------------+
```

- Grade in colored square (A=green, B=blue, C=yellow, D=orange, F=red)
- 4 category scores in compact row
- Domain + scan date
- Branding footer
- Cache-Control: 1 hour
- Embed snippets provided in HTML + Markdown

## Dashboard Share UI

**"Share" button** on project dashboard opens modal:

1. **Configure:**
   - Detail level: Summary / Summary + Issues / Full Report (radio)
   - Expiry: Permanent / 7 days / 30 days / 90 days / Custom (dropdown)
2. **After generation:**
   - Share URL with copy button
   - Badge embed code (HTML + Markdown tabs) with copy button
   - Preview thumbnail
3. **Manage existing:**
   - Edit level/expiry
   - "Revoke Access" button with confirmation dialog

## Existing Infrastructure Leveraged

- `crawlJobs.shareToken`, `shareEnabled`, `sharedAt` columns
- `crawlQueries.generateShareToken()`, `getByShareToken()`, `disableSharing()`
- `/api/public/reports/:token` endpoint (returns summary + pages + issues + quick wins)
- `/api/public/leads` for lead capture
- `summaryData` JSONB with scores, categories, quick wins
- Project branding (logo, colors, company name)
