# Navigation Redesign, Free Tools, Auth Upgrade & Onboarding

**Date:** 2026-03-09
**Status:** Approved
**Approach:** B — Global Sidebar + Existing Project Sidebar

## 1. Global Sidebar (AppSidebar)

Narrow (~60px collapsed, ~200px expanded) sidebar at the dashboard layout level. Always visible across all dashboard routes. When inside a project, the existing ProjectSidebar renders alongside it.

### Navigation Items

```
[Logo]
Home              → /dashboard
Projects          → /dashboard/projects
── TOOLS ──
Readiness Checker → /tools/readiness
Schema Validator  → /tools/schema
Snippet Simulator → /tools/snippet
llms.txt Generator→ /tools/llms-txt
Meta Optimizer    → /tools/meta
Crawler Checker   → /tools/crawler-check
── separator ──
Billing           → /dashboard/billing
Team              → /dashboard/team
Settings          → /dashboard/settings
── spacer ──
[avatar] User     → logout action
```

### Behavior

- Default state: collapsed (icon-only, 60px)
- Hover or click toggle expands to ~200px with labels
- Collapse/expand state persisted in localStorage
- Active route highlighted with accent background
- Tooltips on icons when collapsed
- Keyboard shortcut: Cmd+B to toggle

### Layout (Global Context)

```
┌────┬─────────────────────────────────────────┐
│    │ TopBar: Breadcrumb + Actions             │
│ A  ├─────────────────────────────────────────┤
│ p  │                                         │
│ p  │              {children}                 │
│ S  │                                         │
│ i  │                                         │
│ d  │                                         │
│ e  │                                         │
│ b  │                                         │
│ a  │                                         │
│ r  │                                         │
└────┴─────────────────────────────────────────┘
```

### Layout (Project Context)

```
┌────┬────────────────┬─────────────────────────┐
│    │ ProjectSidebar │                         │
│ A  │ (existing,     │  Tab content            │
│ p  │  unchanged)    │                         │
│ p  │                │                         │
│    │ ANALYZE        │                         │
│ S  │  Overview      │                         │
│ i  │  Actions       │                         │
│ d  │  Pages...      │                         │
│ e  │                │                         │
│ b  │ GROW VIS.      │                         │
│ a  │  Strategy...   │                         │
│ r  │                │                         │
│    │ AUTOMATE       │                         │
│    │  Integrations..│                         │
└────┴────────────────┴─────────────────────────┘
```

### Mobile

- Global sidebar → bottom tab bar (Home, Projects, Tools sheet, Billing, Profile)
- Project sidebar → slide-out drawer (unchanged)

## 2. Dashboard Layout Restructure

### DashboardNav → AppSidebar + TopBar

- Remove `DashboardNav` (top bar with 2 links)
- `AppSidebar` provides global navigation
- `TopBar` provides: breadcrumbs (Home > Projects > families.care > Issues), action buttons (New Project, Start Crawl), notification bell placeholder
- Onboarding redirect logic moves from DashboardNav into layout or shared hook
- UserButton moves into sidebar footer

### New Components

- `AppSidebar` — global sidebar component
- `TopBar` — slim contextual header with breadcrumbs
- `SidebarContext` — React context for collapse state, persisted to localStorage
- `BreadcrumbNav` — breadcrumb component using route segments

## 3. Free Tools

Six public tools at `/tools/[slug]`, no auth required. Each tool has its own page with a shared layout.

### Shared Tools Layout (`/tools/layout.tsx`)

Marketing nav (Logo, Tools, Pricing, Sign In) + conversion banner at bottom ("Want deeper analysis? Start free").

### Rate Limiting

- Anonymous: 1 use per tool per day (by IP)
- Logged-in: unlimited
- Display: "You've used your free check today — Sign up for unlimited"

### Tools

| Tool                       | Route                  | Input                             | Output                                                          | Backend                                                   |
| -------------------------- | ---------------------- | --------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| LLM Readiness Checker      | `/tools/readiness`     | URL                               | Score card (grade, top 5 issues, category breakdown)            | Existing scoring engine, single-page lightweight crawl    |
| Schema Validator           | `/tools/schema`        | URL                               | Structured data found/missing, JSON-LD preview, recommendations | New API endpoint: fetch page, parse ld+json, validate     |
| AI Snippet Simulator       | `/tools/snippet`       | Query + optional URL              | Simulated AI response showing if/how URL appears                | New API endpoint: LLM call with query                     |
| llms.txt Generator         | `/tools/llms-txt`      | Domain + company description form | Valid llms.txt file, copy-to-clipboard                          | Client-side only, template-based                          |
| Meta Description Optimizer | `/tools/meta`          | Meta description + target keyword | 3 AI-rewritten options with char count                          | New API endpoint: LLM rewrite                             |
| Crawler Blocked Checker    | `/tools/crawler-check` | URL                               | Table of AI crawlers blocked/allowed                            | New API endpoint: fetch robots.txt, parse bot user agents |

### SEO

Each tool page gets: unique meta title/description, HowTo structured data, canonical URL. Target long-tail queries like "check if chatgpt can crawl my site".

## 4. Auth Redesign + Google One Tap

### Sign-In Page Redesign

- Google-first: "Continue with Google" as primary CTA (large, prominent button with Google logo)
- Email as secondary: "Sign in with Email" expandable section
- Trust signals: "No credit card required", "Free plan available", "Secure & private"
- Benefit-driven headline: "See how AI ranks your website" (not "Sign In")
- Right panel: animated product showcase with real metrics

### Google One Tap

- Load GIS SDK via `next/script` (`accounts.google.com/gsi/client`)
- New `GoogleOneTap` component: renders popup flow, user sees profile pic + name, one click
- Falls back to `signIn.social({ provider: "google" })` redirect if One Tap dismissed
- Can be added to tool pages as conversion trigger after free use

### Sign-Up Page

Same pattern: Google-first, email secondary. Headline: "Start optimizing for AI search — free"

### Technical

- Rebuild sign-in/sign-up forms with shadcn/ui components (Card, Input, Button)
- Keep better-auth as auth backend, add GIS SDK for frontend UX
- `GoogleOneTap` reusable across sign-in, sign-up, and tool pages

## 5. Project Onboarding Wizard

New guided onboarding flow when creating a project. Replaces the current flat form at `/dashboard/projects/new` with a multi-step wizard (modal or full-page). Inspired by LLMRankr's 4-step provisioning flow but adapted to our strengths (multi-page crawling, integrations, 37-factor scoring).

### Wizard Steps

```
Step 1: Website     → Enter domain, auto-extract brand keywords + AI suggestions
Step 2: Crawl Scope → Configure pages/depth, schedule (our unique advantage)
Step 3: Competitors → AI-discovered competitors + manual add (select up to 3-5)
Step 4: Launch      → Review settings, start crawl with streaming progress
```

### Step 1: Website & Keywords

- User enters domain (existing field)
- Backend auto-extracts brand keywords from homepage crawl (title, meta, headings)
- LLM generates AI keyword suggestions (similar to LLMRankr's "AI Suggestions" panel)
- User selects/removes keywords (up to 15), can add custom topics
- Keywords stored in project settings for AI visibility checks

### Step 2: Crawl Scope & Schedule

- Page limit slider (based on plan: Free=10, Starter=100, Pro=500, Agency=2000)
- Crawl depth selector (1-5 levels)
- Schedule: Manual / Daily / Weekly / Monthly
- Toggle: Auto-run post-crawl automation pipeline
- Toggle: Enable weekly AI visibility tracking

### Step 3: AI-Discovered Competitors

- **Zero-friction discovery**: LLM call to identify competitors from brand keywords + domain
- Show list of 5-8 discovered competitor domains with "Select" toggle
- User picks up to 3-5 to track (plan-dependent)
- "+ Add competitor manually" option (existing functionality)
- Competitors stored in project, crawled alongside main site
- **Key insight from LLMRankr**: They show "They win because / You lose because" per competitor — we can do this with our 37-factor scoring after crawl completes

### Step 4: Launch & Streaming Progress

- Summary of all settings before launch
- "Start Crawl" button triggers crawl job
- **Progressive dashboard**: Show results as they arrive (inspired by LLMRankr's streaming approach)
  - Phase 1: Crawl progress bar (pages discovered/crawled)
  - Phase 2: Scoring results stream in as pages complete
  - Phase 3: AI analysis generates (visibility checks, action items)
- Each section appears on the dashboard as it completes, not all at once
- "X/Y sections ready" indicator with last-completed label

### New API Endpoints

| Endpoint                                     | Purpose                                                    |
| -------------------------------------------- | ---------------------------------------------------------- |
| `POST /api/projects/:id/extract-keywords`    | Crawl homepage, extract brand keywords via LLM             |
| `POST /api/projects/:id/suggest-competitors` | LLM-based competitor discovery from keywords               |
| `GET /api/projects/:id/crawl-progress`       | SSE or polling endpoint for streaming crawl/scoring status |

### New Components

- `ProjectWizard` — multi-step wizard container with stepper
- `KeywordExtractor` — keyword selection with AI suggestions
- `CompetitorDiscovery` — AI-suggested competitor list with selection
- `CrawlProgressStream` — real-time crawl/scoring progress display
- `WizardStepper` — horizontal step indicator (Website → Crawl → Competitors → Launch)

## What Does NOT Change

- `ProjectSidebar` — stays exactly as-is
- `ProjectMobileNav` — stays as-is
- All tab components, data hooks, SWR patterns
- API routes, scoring engine, crawler
- Billing, Stripe, plan limits
- Database schema (keywords + competitors already supported)
