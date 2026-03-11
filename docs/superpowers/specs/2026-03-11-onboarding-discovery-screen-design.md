# Onboarding Discovery Screen — Design Spec

**Date:** 2026-03-11
**Status:** Approved
**Goal:** Replace the crawl-wait spinner (current Step 3) with a rich Discovery screen that collects business goals, personas, keywords, and competitors while the crawl runs in the background.

---

## Problem

The current onboarding wizard has 3 steps: Profile → Website → Crawl Progress. Step 3 is a passive wait screen with rotating tips while the crawl runs (30-60s). This wastes the user's time and misses the opportunity to collect critical project context (goals, personas, keywords, competitors) that powers downstream features.

## Solution

Extend the wizard to 3 phases: **Setup** (Profile, Website) → **Discovery** (single screen with 4 collapsible cards) → **Dashboard**. The crawl triggers after the Website step and runs in the background while the user works through Discovery cards at their own pace.

---

## Wizard Flow

```
Phase 1: Setup (existing)
  Step 1: Profile — name, work style, team size
  Step 2: Website — domain, project name → triggers crawl on "Next"

Phase 2: Discovery (NEW — single screen, replaces old Step 3)
  Card 1: Business Goals — single-select from 4 options
  Card 2: Target Personas — multi-select from suggestions + custom input
  Card 3: Target Keywords — free-text tag input
  Card 4: Competitors — AI suggestions (unlocks after crawl) + manual add

Phase 3: Launch
  "Go to Dashboard →" button — always visible, saves all collected data
```

### Crawl Progress Indicator

A sticky banner at the top of the Discovery screen shows crawl status:

- Pulsing green dot + "Crawling example.com — 12 of ~30 pages"
- Progress bar fills as pages are crawled
- On completion: brief toast notification "Crawl complete!" — does not interrupt the user's current card
- Competitor card transitions from locked to unlocked with AI suggestions

### Score Reveal on Crawl Completion

When the crawl completes, the crawl progress banner transitions to show the overall score + letter grade inline (e.g., "Crawl complete — Score: 72 / C"). The full score breakdown (technical, content, AI readiness, performance) and "View Full Report" CTA are deferred to the dashboard. This preserves the "wow moment" from the current flow without blocking the Discovery screen.

### Free-Tier Behavior

Free plan users (0 competitors allowed) see the competitor card with AI suggestions displayed, but selecting any competitor shows an inline upgrade CTA. The competitor card is auto-marked as "skipped" for free-tier users so they are not blocked from proceeding. The "Go to Dashboard" button is always available regardless of card completion.

---

## Discovery Cards

### Card 1: Business Goals

Single-select from 4 options:

- "Get mentioned in AI responses (ChatGPT, Claude, Perplexity)"
- "Generate more leads from AI-driven search"
- "Outrank competitors in AI recommendations"
- "Understand how AI sees my brand"

Stored as `businessGoal` field on the project. Used to prioritize dashboard recommendations.

**Completion criteria:** One option selected.

### Card 2: Target Personas

Multi-select from a static mapping of persona suggestions based on the user's `workStyle` (from Step 1). No LLM call needed — suggestions are derived client-side:

| workStyle               | Suggested Personas                                     |
| ----------------------- | ------------------------------------------------------ |
| `own_site_optimization` | Marketing Manager, Startup Founder, Content Strategist |
| `client_reporting`      | Agency Owner, SEO Specialist, Account Manager          |
| `technical_audit`       | Developer/Engineer, Technical SEO, DevOps/Platform     |

Each persona shows: role + job-to-be-done (e.g., "Marketing Manager — evaluating SEO tools").

- "+ Describe a custom persona..." opens a text input for free-form entry
- Custom personas are created with `name` and `role` fields; other `personas` table fields (`funnelStage`, `jobToBeDone`, etc.) are set to sensible defaults: `funnelStage: "education"`, `jobToBeDone` derived from the label text
- Selected personas are created in the `personas` table on save

**Completion criteria:** At least 1 persona selected.

### Card 3: Target Keywords

Tag-style input for keywords/phrases the user wants to rank for in AI responses.

- Free-text input with Enter/comma to add
- Tags displayed as removable pills
- No auto-suggestions in v1 (future: extract from crawl data)

**Completion criteria:** At least 1 keyword entered.

### Card 4: Competitors

Two states based on crawl status:

**Locked (crawl in progress):**

- Card is visually dimmed (opacity 0.6)
- Shows lock icon + "Waiting for crawl data..."
- Cannot be expanded
- Manual add is available even while locked (user can still type competitors they already know)

**Unlocked (crawl complete):**

- AI suggestions fetched using crawl-derived page data (title, meta description) + user-entered keywords + goal
- Suggestions appear with domain + reason (5-8 suggestions)
- Each suggestion is toggleable (select/deselect)
- Plan limit indicator: "X / N selected (Plan name)"
- "+ Add competitor manually..." input at bottom
- Free tier: suggestions shown but selecting triggers inline upgrade CTA; card auto-completes as "skipped"

**Why crawl data is needed:** The `POST /api/discovery/:projectId/suggest-competitors` endpoint uses the crawled homepage's title, meta description, and detected industry to generate accurate competitor suggestions. Without this context, suggestions would be based solely on the domain name, producing lower-quality results.

**Completion criteria:** At least 1 competitor selected (paid plans), or auto-skipped (free tier).

---

## API

### New Endpoint: POST /api/discovery/:projectId/suggest-competitors

Added as a new route on the **existing** `discoveryRoutes` in `apps/api/src/routes/discovery.ts`. This avoids creating a parallel route file and reuses the existing auth/project validation patterns.

**Request:**

```json
{
  "keywords": ["keyword1", "keyword2"],
  "goal": "ai_mentions"
}
```

The endpoint fetches the domain and crawl data (homepage title, meta description) from the project + latest crawl internally, so the client only needs to send keywords and goal.

**Implementation:**

- Uses Claude Haiku (claude-haiku-4-5-20251001)
- System prompt: "You identify competitor websites. Return JSON array of objects with 'domain' and 'reason' fields. Return 5-8 competitors. Only return actual competitor domains, not aggregators or directories."
- User prompt includes domain, page title, meta description, keywords, and goal for context
- Filters out blocked domains (Wikipedia, Reddit, YouTube, etc.)
- Deduplicates results
- Falls back to empty array on LLM failure

**Response:**

```json
{
  "competitors": [
    {
      "domain": "competitor1.com",
      "reason": "Direct competitor in SaaS project management"
    },
    { "domain": "competitor2.com", "reason": "..." }
  ]
}
```

**Auth:** Requires authenticated user. No plan restriction (suggestions are free, saving is gated).

**Relationship to existing discovery pipeline:** The existing `POST /api/discovery/:projectId/run` triggers the full auto-discovery pipeline (personas + keywords + competitors via Perplexity/Grok). The new `suggest-competitors` endpoint is a lightweight, suggestion-only call for the wizard UI. It does NOT save anything to the database — it only returns suggestions. The full discovery pipeline continues to run post-crawl as before via the `runDiscovery` call in the onboarding hook.

### Save Actions (on "Go to Dashboard")

All saves use `Promise.allSettled` — partial failure is acceptable:

1. `PATCH /api/projects/:id` — save `businessGoal` (requires adding `businessGoal` to the project update Zod schema in `apps/api/src/routes/projects.ts`)
2. `POST /api/personas` — create each selected persona with `name`, `role`, `jobToBeDone`, `funnelStage` defaults
3. `POST /api/keywords/:projectId/batch` — bulk save keywords (existing endpoint in `apps/api/src/routes/keywords.ts`)
4. `POST /api/strategy/:projectId/competitors` — add each selected competitor (paid plans only, skipped for free)
5. `POST /api/account/classify-persona` — existing, updated with goal context

---

## Data Model

### Schema Migration

**projects table — new column:**

- `businessGoal: text` — nullable, one of: "ai_mentions", "lead_gen", "outrank", "brand_understanding"

**Migration steps:**

1. Add `businessGoal` column to `packages/db/src/schema/projects.ts`
2. Run `export $(grep -v '^#' .env | xargs) && cd packages/db && npx drizzle-kit push` to push schema to Neon
3. Update the project update Zod schema in `apps/api/src/routes/projects.ts` to accept `businessGoal`

### Existing Tables Used

- `personas` — created from card 2 selections. Required fields: `name` (from label), `role` (from label), `projectId`, `funnelStage` (default: "education"), `jobToBeDone` (derived from label or custom input)
- `savedKeywords` — created from card 3 entries via existing `POST /api/keywords/:projectId/batch` endpoint
- `competitors` — created from card 4 selections via existing `POST /api/strategy/:projectId/competitors`, `source: "user_added"`

### New Query Helper

**packages/db/src/queries/competitors.ts:**

- `addMultiple(projectId: string, domains: string[])` — bulk insert, skips duplicates via `ON CONFLICT DO NOTHING`

---

## Component Architecture

### Component Tree

```
OnboardingPage
├── WizardStepper — labels: ["Profile", "Website", "Discovery"]
├── ProfileStep (existing step 0)
├── WebsiteStep (existing step 1, triggers crawl)
└── DiscoveryScreen (NEW step 2)
    ├── CrawlProgressBar — sticky top, polls crawl status, shows score on complete
    ├── DiscoveryProgressPills — checkmark/dot/circle/lock status per card
    ├── DiscoveryCard (×4) — reusable accordion wrapper
    │   ├── GoalsCardContent
    │   ├── PersonasCardContent
    │   ├── KeywordsCardContent
    │   └── CompetitorsCardContent
    └── DiscoveryLaunchFooter — "X of 4 completed" + "Go to Dashboard →"
```

### Relationship to Existing Onboarding Code

The current Step 3 (`CrawlProgressSection` + `DiscoveryPreviewSection` in `onboarding-page-sections.tsx`) is **replaced** by `DiscoveryScreen`. Specifically:

- `CrawlProgressSection` — replaced by `CrawlProgressBar` (sticky banner instead of full-page). Score circle + letter grade display moves into the banner's "complete" state.
- `DiscoveryPreviewSection` — removed. Its functionality (showing auto-discovered personas/keywords/competitors) is superseded by the interactive Discovery cards where users actively choose these items.
- The existing `discoveryResult`/`discoveryStatus`/`discoveryError` state fields in `use-onboarding-wizard.ts` are **repurposed**: `discoveryStatus` tracks the overall Discovery screen state, `discoveryResult` stores the auto-discovery pipeline output (which populates competitor suggestions as a fallback if the lightweight suggest endpoint fails).

### DiscoveryCard (reusable accordion)

Props:

- `id: string` — card identifier
- `title: string` — display name
- `status: "completed" | "active" | "pending" | "locked"` — drives icon and styling
- `summary?: string` — shown when collapsed and completed (e.g., "Get mentioned in AI responses")
- `locked?: boolean` — prevents expansion
- `lockedReason?: string` — tooltip/text for locked state
- `isOpen: boolean` — controlled expand state
- `onToggle: () => void` — expand/collapse handler
- `children: ReactNode` — card content

Visual states:

- **Completed:** green border, checkmark icon, summary text, collapsed
- **Active:** indigo border, filled dot icon, expanded with content
- **Pending:** gray border, empty circle icon, collapsed
- **Locked:** gray border, lock icon, dimmed, non-interactive

**Accessibility:**

- Uses `role="region"` with `aria-labelledby` pointing to the card title
- Card header is a `<button>` with `aria-expanded` matching `isOpen`
- Locked cards have `aria-disabled="true"` and `tabIndex={-1}`
- Content area uses `aria-hidden` when collapsed
- Keyboard navigation: Enter/Space toggles expand, Tab moves between cards

### Hooks

**use-onboarding-wizard.ts (extended):**

New state fields:

```typescript
businessGoal: string | null;
selectedPersonas: Array<{ label: string; role: string; custom: boolean }>;
keywords: string[];
competitors: Array<{ domain: string; reason: string; selected: boolean; source: "ai_suggested" | "manual" }>;
competitorSuggestionsLoading: boolean;
competitorSuggestionsError: string | null;
discoveryCardOpen: "goals" | "personas" | "keywords" | "competitors" | null;
```

New action types:

- `SET_BUSINESS_GOAL`
- `TOGGLE_PERSONA` / `ADD_CUSTOM_PERSONA`
- `ADD_KEYWORD` / `REMOVE_KEYWORD`
- `SET_COMPETITORS` / `TOGGLE_COMPETITOR` / `ADD_MANUAL_COMPETITOR`
- `COMPETITOR_SUGGEST_START` / `COMPETITOR_SUGGEST_SUCCESS` / `COMPETITOR_SUGGEST_FAIL`
- `SET_DISCOVERY_CARD_OPEN`

The existing `discoveryStatus` / `discoveryResult` fields remain for the auto-discovery pipeline (post-crawl). The new fields above are specifically for the wizard UI's interactive selections.

**use-competitor-discovery.ts (new):**

- Watches `crawl.status` from parent wizard state
- On `status === "complete"` AND competitor card is opened: calls `POST /api/discovery/:projectId/suggest-competitors` with keywords and goal
- Returns `{ suggestions, loading, error, retry }`
- Does not re-fetch if suggestions already loaded
- Falls back to `discoveryResult.competitors` from auto-discovery pipeline if suggest endpoint fails

**use-discovery-completion.ts (new):**

- Derives completion status from wizard state:
  - Goals: `businessGoal !== null`
  - Personas: `selectedPersonas.length > 0`
  - Keywords: `keywords.length > 0`
  - Competitors: `competitors.some(c => c.selected)` OR free tier (auto-skipped)
- Returns `{ completedCount, cardStatuses }`
- All cards are optional — "Go to Dashboard" works with 0 completed

**use-discovery-save.ts (new):**

- `save()` function called on "Go to Dashboard" click
- Fires all API calls via `Promise.allSettled`:
  1. `PATCH /api/projects/:id` with `{ businessGoal }`
  2. `POST /api/personas` for each selected persona
  3. `POST /api/keywords/:projectId/batch` with `{ keywords: [...] }`
  4. `POST /api/strategy/:projectId/competitors` for each selected competitor
  5. `POST /api/account/classify-persona` with goal context
- Tracks `{ saving, error }` state
- On success: redirects to `/dashboard/[projectId]`
- On partial failure: redirects anyway, logs errors (non-blocking)

---

## Files

### New Files (8 components)

| File                                                                   | Purpose                                   |
| ---------------------------------------------------------------------- | ----------------------------------------- |
| `apps/web/src/app/onboarding/_components/discovery-screen.tsx`         | Main Discovery screen container           |
| `apps/web/src/app/onboarding/_components/discovery-card.tsx`           | Reusable accordion card wrapper with ARIA |
| `apps/web/src/app/onboarding/_components/discovery-progress-pills.tsx` | Status pills per card                     |
| `apps/web/src/app/onboarding/_components/discovery-launch-footer.tsx`  | Footer with completion count + CTA        |
| `apps/web/src/app/onboarding/_components/goals-card-content.tsx`       | Business goals single-select              |
| `apps/web/src/app/onboarding/_components/personas-card-content.tsx`    | Persona multi-select + custom input       |
| `apps/web/src/app/onboarding/_components/keywords-card-content.tsx`    | Keyword tag input                         |
| `apps/web/src/app/onboarding/_components/competitors-card-content.tsx` | AI suggestions + manual add + plan gating |

### New Files (3 hooks)

| File                                             | Purpose                            |
| ------------------------------------------------ | ---------------------------------- |
| `apps/web/src/hooks/use-competitor-discovery.ts` | AI competitor suggestion lifecycle |
| `apps/web/src/hooks/use-discovery-completion.ts` | Card completion tracking           |
| `apps/web/src/hooks/use-discovery-save.ts`       | Save-all on launch                 |

### Modified Files (5)

| File                                                                   | Change                                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/web/src/hooks/use-onboarding-wizard.ts`                          | Add discovery state fields + ~10 new action types                                         |
| `apps/web/src/app/onboarding/_components/onboarding-page-sections.tsx` | Replace `CrawlProgressSection`/`DiscoveryPreviewSection` with `DiscoveryScreen` at step 2 |
| `apps/web/src/components/onboarding/stepper.tsx`                       | Change step labels to 3 phases                                                            |
| `apps/api/src/routes/discovery.ts`                                     | Add `POST /:projectId/suggest-competitors` endpoint                                       |
| `apps/api/src/index.ts`                                                | No change needed — discovery routes already mounted                                       |

### Modified Files (2 DB/API)

| File                                     | Change                                          |
| ---------------------------------------- | ----------------------------------------------- |
| `packages/db/src/schema/projects.ts`     | Add `businessGoal: text()` column               |
| `packages/db/src/queries/competitors.ts` | Add `addMultiple()` bulk insert helper          |
| `apps/api/src/routes/projects.ts`        | Add `businessGoal` to project update Zod schema |

---

## Error Handling

- **AI suggestion failure:** Empty competitor list shown with "We couldn't find competitors automatically. Add them manually below." Falls back to `discoveryResult.competitors` from auto-discovery if available. No retry loop.
- **Save failure:** `Promise.allSettled` ensures partial saves don't block dashboard redirect. Failed saves can be completed from dashboard tabs later.
- **Crawl failure:** If crawl fails, competitor card unlocks with manual-only mode: "Crawl encountered an issue. You can add competitors manually." Manual input is available.
- **Plan limit exceeded:** Adding competitors beyond plan limit shows inline upgrade CTA. Selection is prevented, not rolled back.

## Testing Strategy

- **Unit tests:** DiscoveryCard accordion behavior (expand/collapse, ARIA states, keyboard nav), completion logic, pill status derivation, persona suggestion mapping
- **Integration tests:** Wizard state transitions through all steps, save-all API calls, competitor suggestion endpoint
- **Edge cases:** Fast user (reaches competitors before crawl), slow crawl (user waits), crawl failure, LLM suggestion failure with auto-discovery fallback, free-tier gating and auto-skip, partial save failures
