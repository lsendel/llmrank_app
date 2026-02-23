# Pricing Page Improvements + Full Rebrand to "LLM Rank"

**Date:** 2026-02-23
**Status:** Design

## Summary

Rebrand "LLM Rank" to "LLM Rank" across the entire web app, and enhance the pricing page with a monthly/annual toggle, score history on plan cards, and a stronger final CTA.

## Changes

### 1. Global Rebrand: "LLM Rank" → "LLM Rank"

Find-and-replace all ~80 instances of "LLM Rank" with "LLM Rank" across `apps/web/src/`. This covers:

- **Metadata:** `<title>`, `description`, OpenGraph, Twitter cards
- **JSON-LD:** Organization, SoftwareApplication, Product, WebSite schemas
- **Nav/Footer:** Logo text, copyright lines
- **Body copy:** Landing page, pricing, integrations, chatgpt-seo, terms, privacy, MCP, scan, sign-in/up, onboarding, dashboard, reports, share pages
- **Components:** `json-ld.tsx`, `report-template.tsx`, `pdf-download-button.tsx`, `backlink-card.tsx`, `api-tokens-section.tsx`

**Not changed:** The npm package name `@llm-boost/*` stays as-is (internal, not user-facing). Only user-visible text changes.

### 2. Pricing Page: Add Monthly/Annual Toggle

Add a billing period toggle above the pricing cards:

- Default: Monthly (current prices)
- Annual: Show `price * 12 * 0.8` (20% savings) with "Save 20%" badge
- Visual: Simple pill toggle with `bg-primary` on active side
- When annual is selected, display `/year` instead of `/month` and show the annual price

### 3. Pricing Page: Add Score History to Plan Cards

Each plan card currently shows 4 quick stats. Add a 5th:

- Free: "7-day score history"
- Starter: "30-day score history"
- Pro: "1-year score history"
- Agency: "Unlimited score history"

The data is already in `PLAN_LIMITS` via `historyDays`. Render it using the same `Check` icon + text pattern.

### 4. Pricing Page: Stronger Final CTA

Replace the current small text paragraph with a more prominent section:

- Headline: "Not sure which plan? Start free."
- Subtext: "Run a free AI audit on your site — no credit card required."
- Primary CTA button: "Start Free Audit" → links to `/scan`
- Centered, with slight background tint (`bg-muted/30`)

## Files Modified

- `apps/web/src/app/pricing/page.tsx` — toggle, score history, CTA
- ~25 files across `apps/web/src/` for "LLM Rank" → "LLM Rank" rename
- `apps/web/src/components/seo/json-ld.tsx` — organization/brand name

## Out of Scope

- Package names (`@llm-boost/*`)
- Backend API code
- Rust crawler
- Database/migration changes
- Annual billing Stripe integration (toggle is UI-only for now; actual Stripe annual plans are a separate task)
