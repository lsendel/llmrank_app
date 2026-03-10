# Onboarding Wizard, Prompt Management & Unified Reports — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a multi-step project onboarding wizard, a super-admin prompt management system with version control, and unify all AI outputs into a single actionable report.

**Architecture:** Wizard replaces flat project creation form with 4-step guided flow (Website → Crawl → Competitors → Launch). Prompt management uses a `prompt_templates` table with content-hash versioning, admin UI in existing admin panel. Unified report aggregates all AI analyses (scoring, visibility, fixes, structured data) into one actionable document with prioritized recommendations.

**Tech Stack:** Next.js App Router, shadcn/ui, Hono API, Neon PostgreSQL (Drizzle), existing LLM packages (`packages/llm`, `packages/narrative`), Cloudflare KV for rate limiting.

---

## Phase 5: Project Onboarding Wizard

### Task 21: Wizard stepper + container component

**Files:**

- Create: `apps/web/src/components/wizard/wizard-stepper.tsx`
- Create: `apps/web/src/components/wizard/project-wizard.tsx`
- Create: `apps/web/src/components/wizard/index.ts`
- Test: `apps/web/src/components/wizard/wizard-stepper.test.tsx`

**Step 1: Write the failing test**

```tsx
// wizard-stepper.test.tsx
import { render, screen } from "@testing-library/react";
import { WizardStepper } from "./wizard-stepper";

const STEPS = ["Website", "Crawl Scope", "Competitors", "Launch"];

describe("WizardStepper", () => {
  it("renders all step labels", () => {
    render(<WizardStepper steps={STEPS} currentStep={0} />);
    for (const step of STEPS) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it("marks current step as active", () => {
    render(<WizardStepper steps={STEPS} currentStep={1} />);
    const step = screen.getByText("Crawl Scope").closest("[data-step]");
    expect(step).toHaveAttribute("data-state", "active");
  });

  it("marks completed steps", () => {
    render(<WizardStepper steps={STEPS} currentStep={2} />);
    const step = screen.getByText("Website").closest("[data-step]");
    expect(step).toHaveAttribute("data-state", "completed");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/wizard/wizard-stepper.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement WizardStepper**

```tsx
// wizard-stepper.tsx
"use client";

import { Check } from "lucide-react";

interface WizardStepperProps {
  steps: string[];
  currentStep: number;
}

export function WizardStepper({ steps, currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((label, i) => {
        const state =
          i < currentStep
            ? "completed"
            : i === currentStep
              ? "active"
              : "upcoming";
        return (
          <div
            key={label}
            data-step
            data-state={state}
            className="flex flex-1 items-center"
          >
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors ${
                  state === "completed"
                    ? "border-primary bg-primary text-primary-foreground"
                    : state === "active"
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                }`}
              >
                {state === "completed" ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-xs ${
                  state === "active"
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-2 h-px flex-1 ${
                  i < currentStep ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 4: Implement ProjectWizard container**

```tsx
// project-wizard.tsx
"use client";

import { useState } from "react";
import { WizardStepper } from "./wizard-stepper";

const STEPS = ["Website", "Crawl Scope", "Competitors", "Launch"];

interface WizardData {
  // Step 1
  name: string;
  domain: string;
  keywords: Array<{ keyword: string; source: "ai" | "extracted" | "user" }>;
  // Step 2
  pageLimit: number;
  crawlDepth: number;
  crawlSchedule: "manual" | "daily" | "weekly" | "monthly";
  enablePipeline: boolean;
  enableVisibility: boolean;
  // Step 3
  competitors: Array<{ domain: string; selected: boolean }>;
  // Step 4 — computed from above
}

export function ProjectWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    name: "",
    domain: "",
    keywords: [],
    pageLimit: 10,
    crawlDepth: 3,
    crawlSchedule: "weekly",
    enablePipeline: true,
    enableVisibility: true,
    competitors: [],
  });

  const updateData = (partial: Partial<WizardData>) =>
    setData((prev) => ({ ...prev, ...partial }));

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <WizardStepper steps={STEPS} currentStep={step} />
      <div className="rounded-lg border border-border p-6">
        {/* Step components rendered here — implemented in Tasks 22-25 */}
        {step === 0 && <div>Step 1 placeholder</div>}
        {step === 1 && <div>Step 2 placeholder</div>}
        {step === 2 && <div>Step 3 placeholder</div>}
        {step === 3 && <div>Step 4 placeholder</div>}
      </div>
    </div>
  );
}
```

**Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/components/wizard/wizard-stepper.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/web/src/components/wizard/
git commit -m "feat: add WizardStepper and ProjectWizard container"
```

---

### Task 22: Step 1 — Website & Keyword Extraction

**Files:**

- Create: `apps/web/src/components/wizard/steps/website-step.tsx`
- Create: `apps/api/src/routes/wizard.ts` — mount at `/api/wizard`
- Modify: `apps/api/src/index.ts` — mount wizard routes

**Step 1: Add API endpoint for keyword extraction**

```ts
// apps/api/src/routes/wizard.ts
import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authMiddleware } from "../middleware/auth";
import { suggestKeywords } from "@llm-boost/llm";

const app = new Hono<AppEnv>();
app.use("*", authMiddleware);

// Extract keywords from a domain's homepage
app.post("/extract-keywords", async (c) => {
  const { domain } = await c.req.json<{ domain: string }>();

  // Fetch homepage
  const url = `https://${domain.replace(/^https?:\/\//, "")}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "LLMRank-Bot/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  const html = await res.text();

  // Extract title, meta, h1-h3 text
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const metaMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/is,
  );
  const headingMatches = [...html.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gis)];

  const extractedKeywords = [
    titleMatch?.[1]?.trim(),
    metaMatch?.[1]?.trim(),
    ...headingMatches.map((m) => m[1].replace(/<[^>]+>/g, "").trim()),
  ]
    .filter(Boolean)
    .slice(0, 10);

  // Get AI suggestions using existing keyword suggester
  const aiSuggestions = await suggestKeywords(
    c.env.ANTHROPIC_API_KEY,
    domain,
    extractedKeywords,
  );

  return c.json({
    extracted: extractedKeywords.map((k) => ({
      keyword: k,
      source: "extracted" as const,
    })),
    aiSuggested: aiSuggestions.map((k: string) => ({
      keyword: k,
      source: "ai" as const,
    })),
  });
});

export default app;
```

**Step 2: Mount in API index**

In `apps/api/src/index.ts`, add:

```ts
import wizardRoutes from "./routes/wizard";
app.route("/wizard", wizardRoutes);
```

**Step 3: Create WebsiteStep component**

```tsx
// apps/web/src/components/wizard/steps/website-step.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, X } from "lucide-react";

interface KeywordItem {
  keyword: string;
  source: "ai" | "extracted" | "user";
}

interface WebsiteStepProps {
  name: string;
  domain: string;
  keywords: KeywordItem[];
  onUpdate: (data: {
    name?: string;
    domain?: string;
    keywords?: KeywordItem[];
  }) => void;
  onNext: () => void;
}

export function WebsiteStep({
  name,
  domain,
  keywords,
  onUpdate,
  onNext,
}: WebsiteStepProps) {
  const [extracting, setExtracting] = useState(false);
  const [customKeyword, setCustomKeyword] = useState("");

  async function handleExtract() {
    if (!domain) return;
    setExtracting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/wizard/extract-keywords`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ domain }),
        },
      );
      const data = await res.json();
      onUpdate({
        keywords: [
          ...data.extracted.slice(0, 5),
          ...data.aiSuggested.slice(0, 10),
        ],
      });
    } finally {
      setExtracting(false);
    }
  }

  function addCustom() {
    if (!customKeyword.trim()) return;
    onUpdate({
      keywords: [
        ...keywords,
        { keyword: customKeyword.trim(), source: "user" },
      ],
    });
    setCustomKeyword("");
  }

  function removeKeyword(index: number) {
    onUpdate({ keywords: keywords.filter((_, i) => i !== index) });
  }

  const isValid = name.trim() && domain.trim();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Your Website</h2>
        <p className="text-sm text-muted-foreground">
          Enter your domain and we'll extract keywords automatically.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Project Name</label>
          <Input
            value={name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="My Website"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Domain</label>
          <div className="flex gap-2">
            <Input
              value={domain}
              onChange={(e) => onUpdate({ domain: e.target.value })}
              placeholder="example.com"
              onBlur={() => domain && keywords.length === 0 && handleExtract()}
            />
            <Button
              variant="outline"
              onClick={handleExtract}
              disabled={!domain || extracting}
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Extract
            </Button>
          </div>
        </div>

        {keywords.length > 0 && (
          <div>
            <label className="text-sm font-medium">
              Keywords ({keywords.length}/15)
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {keywords.map((kw, i) => (
                <Badge
                  key={`${kw.keyword}-${i}`}
                  variant={kw.source === "ai" ? "secondary" : "default"}
                  className="flex items-center gap-1"
                >
                  {kw.source === "ai" && <Sparkles className="h-3 w-3" />}
                  {kw.keyword}
                  <button onClick={() => removeKeyword(i)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={customKeyword}
            onChange={(e) => setCustomKeyword(e.target.value)}
            placeholder="Add custom keyword..."
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
          />
          <Button
            variant="outline"
            onClick={addCustom}
            disabled={!customKeyword.trim()}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!isValid}>
          Next: Crawl Scope →
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src/components/wizard/steps/website-step.tsx apps/api/src/routes/wizard.ts apps/api/src/index.ts
git commit -m "feat: add wizard Step 1 — website entry with AI keyword extraction"
```

---

### Task 23: Step 2 — Crawl Scope & Schedule

**Files:**

- Create: `apps/web/src/components/wizard/steps/crawl-step.tsx`

**Step 1: Implement CrawlStep**

```tsx
// crawl-step.tsx
"use client";

import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface CrawlStepProps {
  pageLimit: number;
  crawlDepth: number;
  crawlSchedule: string;
  enablePipeline: boolean;
  enableVisibility: boolean;
  planMaxPages: number; // from user's current plan
  onUpdate: (data: Partial<CrawlStepProps>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function CrawlStep(props: CrawlStepProps) {
  // Slider for page limit (capped by plan)
  // Depth selector (1-5)
  // Schedule dropdown (manual/daily/weekly/monthly)
  // Pipeline toggle
  // Visibility tracking toggle
  // Back + Next buttons
}
```

Key UX details:

- Page limit slider shows plan cap with upgrade CTA if at max
- Crawl depth defaults to 3
- Schedule defaults to "weekly"
- Both toggles default to enabled
- Shows estimated crawl time based on pageLimit

**Step 2: Commit**

```bash
git add apps/web/src/components/wizard/steps/crawl-step.tsx
git commit -m "feat: add wizard Step 2 — crawl scope with plan-aware limits"
```

---

### Task 24: Step 3 — AI Competitor Discovery

**Files:**

- Create: `apps/web/src/components/wizard/steps/competitors-step.tsx`
- Modify: `apps/api/src/routes/wizard.ts` — add `/suggest-competitors` endpoint

**Step 1: Add API endpoint**

```ts
// In apps/api/src/routes/wizard.ts, add:
app.post("/suggest-competitors", async (c) => {
  const { domain, keywords } = await c.req.json<{
    domain: string;
    keywords: string[];
  }>();

  const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You identify competitor websites. Return JSON array of objects with "domain" and "reason" fields. Return 5-8 competitors. Only return actual competitor domains, not aggregators or directories.`,
    messages: [
      {
        role: "user",
        content: `Find competitors for ${domain}. Their focus keywords: ${keywords.join(", ")}. Return JSON array.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const competitors = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
  return c.json({ competitors });
});
```

**Step 2: Create CompetitorsStep component**

- Shows "Discovering competitors..." loading state with shimmer
- Displays 5-8 discovered competitors with domain + reason
- Each has a "Select" toggle (up to 3-5 based on plan)
- "+ Add manually" input at bottom
- Selected count indicator: "2/3 competitors selected"

**Step 3: Commit**

```bash
git add apps/web/src/components/wizard/steps/competitors-step.tsx apps/api/src/routes/wizard.ts
git commit -m "feat: add wizard Step 3 — AI competitor discovery with selection"
```

---

### Task 25: Step 4 — Launch & Progress

**Files:**

- Create: `apps/web/src/components/wizard/steps/launch-step.tsx`
- Create: `apps/web/src/components/wizard/crawl-progress-stream.tsx`

**Step 1: Create LaunchStep with settings review**

Shows summary of all settings:

- Domain + project name
- Selected keywords count
- Crawl scope (pages, depth, schedule)
- Selected competitors
- "Start Crawl" button

**Step 2: Create CrawlProgressStream**

Uses existing `useCrawlPolling` hook but with enhanced UI:

```tsx
// crawl-progress-stream.tsx
"use client";

import { useCrawlPolling } from "@/hooks/use-crawl";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2 } from "lucide-react";

interface CrawlProgressStreamProps {
  crawlId: string;
  onComplete: () => void;
}

// Shows 3 phases:
// Phase 1: Crawl progress (pages discovered / pages crawled)
// Phase 2: Scoring progress (pages scored / pages crawled)
// Phase 3: AI analysis (visibility checks, action items)
// Each phase appears as a card that transitions from loading → complete
// "X/3 phases ready" indicator at top
```

**Step 3: Wire up ProjectWizard to create project + start crawl**

In `project-wizard.tsx`, the final submit:

1. `POST /api/projects` — create project
2. `POST /api/wizard/extract-keywords` — save keywords to `savedKeywords` table
3. Save competitors to `competitors` table
4. `POST /api/crawls` — start crawl
5. Show `CrawlProgressStream`
6. On complete, redirect to `/dashboard/projects/:id`

**Step 4: Commit**

```bash
git add apps/web/src/components/wizard/steps/launch-step.tsx apps/web/src/components/wizard/crawl-progress-stream.tsx apps/web/src/components/wizard/project-wizard.tsx
git commit -m "feat: add wizard Step 4 — launch with streaming crawl progress"
```

---

### Task 26: Route setup + replace project creation page

**Files:**

- Create: `apps/web/src/app/dashboard/projects/new/wizard/page.tsx`
- Modify: `apps/web/src/app/dashboard/projects/new/page.tsx` — redirect to wizard

**Step 1: Create wizard page**

```tsx
// apps/web/src/app/dashboard/projects/new/wizard/page.tsx
import { ProjectWizard } from "@/components/wizard";

export default function NewProjectWizardPage() {
  return <ProjectWizard />;
}
```

**Step 2: Update existing new project page to redirect**

```tsx
// apps/web/src/app/dashboard/projects/new/page.tsx
import { redirect } from "next/navigation";

export default function NewProjectPage() {
  redirect("/dashboard/projects/new/wizard");
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/projects/new/
git commit -m "feat: replace flat project creation with wizard flow"
```

---

## Phase 6: Super Admin Prompt Management

### Task 27: Database schema for prompt templates

**Files:**

- Modify: `packages/db/src/schema/admin.ts` (or create if doesn't exist)
- Run: `cd packages/db && npx drizzle-kit generate`

**Step 1: Add prompt_templates table**

```ts
// In packages/db/src/schema/
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

export const promptStatusEnum = pgEnum("prompt_status", [
  "draft",
  "active",
  "archived",
]);

export const promptTemplates = pgTable("prompt_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(), // e.g. "content_scoring", "fix_meta_desc"
  slug: text("slug").notNull(), // machine-readable key
  category: text("category").notNull(), // e.g. "scoring", "fix", "narrative", "discovery"
  description: text("description"), // what this prompt does
  systemPrompt: text("system_prompt").notNull(),
  userPromptTemplate: text("user_prompt_template").notNull(), // with {{variable}} placeholders
  variables: jsonb("variables").$type<string[]>(), // list of template variables
  model: text("model").notNull(), // e.g. "claude-haiku-4-5-20251001"
  modelConfig: jsonb("model_config").$type<{
    maxTokens?: number;
    temperature?: number;
  }>(),
  version: integer("version").notNull().default(1),
  contentHash: text("content_hash").notNull(), // SHA256 of system+user prompts
  status: promptStatusEnum("status").notNull().default("draft"),
  parentId: uuid("parent_id"), // previous version's ID
  createdBy: text("created_by"), // admin user ID
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track prompt performance metrics
export const promptMetrics = pgTable("prompt_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  promptId: uuid("prompt_id")
    .references(() => promptTemplates.id)
    .notNull(),
  invocations: integer("invocations").default(0),
  avgLatencyMs: integer("avg_latency_ms"),
  avgTokensIn: integer("avg_tokens_in"),
  avgTokensOut: integer("avg_tokens_out"),
  avgCostCents: integer("avg_cost_cents"),
  errorRate: integer("error_rate_bps"), // basis points (0-10000)
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Step 2: Generate migration**

Run: `export $(grep -v '^#' .env | xargs) && cd packages/db && npx drizzle-kit generate`

**Step 3: Push schema**

Run: `export $(grep -v '^#' .env | xargs) && cd packages/db && npx drizzle-kit push`

**Step 4: Commit**

```bash
git add packages/db/
git commit -m "feat: add prompt_templates and prompt_metrics tables"
```

---

### Task 28: Seed existing prompts into the database

**Files:**

- Create: `packages/db/src/seeds/seed-prompts.ts`

**Step 1: Create seed script**

Extract all 20+ existing prompts from:

- `packages/llm/src/prompts.ts` → `content_scoring`
- `packages/llm/src/summary.ts` → `executive_summary`
- `packages/llm/src/optimizer.ts` → `rewrite_ai_visibility`, `content_brief`, `structural_gap`, `content_fix`, `improve_dimension`
- `packages/llm/src/fact-extractor.ts` → `fact_extraction`
- `packages/llm/src/personas.ts` → `persona_generation`
- `packages/llm/src/keyword-suggester.ts` → `keyword_suggestion`
- `packages/llm/src/prompt-research.ts` → `prompt_discovery`
- `apps/api/src/services/fix-generator-service.ts` → 11 fix prompts (`fix_meta_desc`, `fix_title`, `fix_structured_data`, `fix_llms_txt`, `fix_faq`, `fix_summary`, `fix_alt_text`, `fix_og_tags`, `fix_canonical`, `fix_heading_hierarchy`, `fix_crawler_blocked`)
- `packages/narrative/src/prompts/section-prompts.ts` → 8 narrative prompts

Each gets inserted with:

- `slug` matching the function/key name
- `category` matching the group (scoring, fix, narrative, discovery, optimization)
- `version: 1`
- `status: "active"`
- `contentHash` computed from SHA256 of system+user prompt text

**Step 2: Run seed**

Run: `cd packages/db && npx tsx src/seeds/seed-prompts.ts`

**Step 3: Commit**

```bash
git add packages/db/src/seeds/seed-prompts.ts
git commit -m "feat: seed 25+ existing prompts into prompt_templates table"
```

---

### Task 29: Prompt management API routes

**Files:**

- Create: `apps/api/src/routes/admin-prompts.ts`
- Modify: `apps/api/src/routes/admin.ts` — mount prompt routes

**Step 1: Create CRUD routes**

```ts
// admin-prompts.ts
import { Hono } from "hono";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// List all prompts (grouped by category, latest version per slug)
app.get("/", async (c) => {
  /* ... */
});

// Get single prompt with version history
app.get("/:id", async (c) => {
  /* ... */
});

// Get version history for a prompt slug
app.get("/history/:slug", async (c) => {
  /* ... */
});

// Create new version of a prompt (creates new row, links to parent)
app.post("/:slug/versions", async (c) => {
  /* ... */
});

// Activate a prompt version (sets status=active, archives previous active)
app.post("/:id/activate", async (c) => {
  /* ... */
});

// Archive a prompt version
app.post("/:id/archive", async (c) => {
  /* ... */
});

// Test a prompt with sample input (dry run)
app.post("/:id/test", async (c) => {
  // Accepts test variables, runs the prompt, returns LLM output
  // Does NOT save results — just for testing
});

// Get metrics for a prompt
app.get("/:id/metrics", async (c) => {
  /* ... */
});

// Diff two versions
app.get("/diff/:id1/:id2", async (c) => {
  /* ... */
});

export default app;
```

**Step 2: Mount under admin routes**

In `apps/api/src/routes/admin.ts`:

```ts
import promptRoutes from "./admin-prompts";
app.route("/prompts", promptRoutes);
```

**Step 3: Commit**

```bash
git add apps/api/src/routes/admin-prompts.ts apps/api/src/routes/admin.ts
git commit -m "feat: add admin prompt management API with versioning and testing"
```

---

### Task 30: Prompt runtime resolver

**Files:**

- Create: `packages/llm/src/prompt-resolver.ts`
- Modify: `packages/llm/src/prompts.ts` — use resolver fallback

**Step 1: Create prompt resolver**

The resolver:

1. Looks up the active prompt version from DB by slug
2. Falls back to hardcoded prompt if DB unavailable (resilience)
3. Interpolates template variables (replaces `{{variable}}` with values)
4. Tracks invocation metrics (async, non-blocking)

```ts
// prompt-resolver.ts
export class PromptResolver {
  constructor(
    private db: DrizzleClient,
    private fallbacks: Map<string, PromptTemplate>,
  ) {}

  async resolve(
    slug: string,
    variables: Record<string, string>,
  ): Promise<{
    system: string;
    user: string;
    model: string;
    config: { maxTokens?: number; temperature?: number };
    promptId: string | null; // for metrics tracking
  }> {
    // 1. Try DB lookup (active version for this slug)
    // 2. Fallback to hardcoded if DB fails
    // 3. Interpolate variables
    // 4. Return resolved prompt
  }

  private interpolate(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => variables[key] ?? `{{${key}}}`,
    );
  }
}
```

**Step 2: Update existing prompts.ts to use resolver with fallback**

The existing hardcoded prompts become the fallback map. New code path:

```ts
// Before: const prompt = buildContentScoringPrompt(text);
// After:  const prompt = await resolver.resolve("content_scoring", { document: text });
```

This is a gradual migration — existing code continues to work, resolver is opt-in per callsite.

**Step 3: Commit**

```bash
git add packages/llm/src/prompt-resolver.ts packages/llm/src/prompts.ts
git commit -m "feat: add PromptResolver with DB-backed versioning and hardcoded fallback"
```

---

### Task 31: Admin prompt management UI

**Files:**

- Create: `apps/web/src/app/dashboard/admin/prompts/page.tsx`
- Create: `apps/web/src/components/admin/prompt-editor.tsx`
- Create: `apps/web/src/components/admin/prompt-version-history.tsx`
- Create: `apps/web/src/components/admin/prompt-test-panel.tsx`

**Step 1: Create prompt list page**

Groups prompts by category (Scoring, Fixes, Narrative, Discovery, Optimization).
Each prompt card shows: name, slug, model, status badge, version number, last activated date, invocation count.
Click opens editor.

**Step 2: Create prompt editor**

Split-pane editor:

- Left: System prompt + User prompt template (with syntax highlighting for `{{variables}}`)
- Right: Test panel — enter sample variables, run test, see LLM output
- Bottom: Version history timeline (click to view/diff/activate)
- Actions: Save as Draft, Activate, Archive

**Step 3: Create version diff view**

Side-by-side diff of two prompt versions (like GitHub diff). Highlights additions/removals in system and user prompts.

**Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/admin/prompts/ apps/web/src/components/admin/
git commit -m "feat: add admin prompt management UI with editor, testing, and version history"
```

---

## Phase 7: Unified Actionable Report

### Task 32: Enhance report data aggregation

**Files:**

- Modify: `packages/reports/src/data-aggregator.ts`

**Step 1: Add new report sections**

Extend `ReportData` to include:

- `structuredDataAnalysis` — per-page schema.org coverage (found types, missing recommended types)
- `aiCrawlerStatus` — which AI bots are allowed/blocked (from robots.txt)
- `promptCoverage` — results from visibility checks mapped to prompts
- `competitorGaps` — where competitors are cited but user isn't, with reasons
- `prioritizedActions` — impact-effort scored action items (Quick Wins, Major Projects, Fill-ins)

**Step 2: Add impact-effort scoring to recommendations**

```ts
interface PrioritizedAction {
  title: string;
  description: string;
  category: "technical" | "content" | "ai_readiness" | "performance" | "schema";
  impact: "high" | "medium" | "low"; // score improvement potential
  effort: "low" | "medium" | "high"; // implementation difficulty
  quadrant: "quick_win" | "major_project" | "fill_in" | "deprioritize";
  estimatedScoreImpact: number; // estimated points gained
  affectedPages: number;
  fixSnippet?: string; // auto-generated fix code (from fix-generator)
}
```

**Step 3: Commit**

```bash
git add packages/reports/src/data-aggregator.ts
git commit -m "feat: enhance report with structured data analysis and impact-effort scoring"
```

---

### Task 33: AI report narrative generator

**Files:**

- Modify: `packages/narrative/src/prompts/section-prompts.ts` — add unified report prompt
- Create: `packages/narrative/src/unified-report.ts`

**Step 1: Add unified actionable report prompt**

```ts
// New section prompt for generating a unified actionable summary
export const UNIFIED_REPORT_PROMPT = {
  system: `You are an AI SEO consultant generating a comprehensive, actionable audit report.

The report MUST include these sections in order:
1. Executive Summary (2-3 sentences, overall grade, biggest win, biggest risk)
2. Quick Wins (top 3-5 fixes that take <30 min each, with exact code/text to implement)
3. AI Visibility Status (which AI engines cite this site, for which queries, sentiment)
4. Structured Data Coverage (what schema.org types are present/missing, JSON-LD to add)
5. Competitive Position (vs selected competitors, where they win, where you win)
6. Priority Action Plan (ranked by impact×effort, grouped into: This Week, This Month, This Quarter)

Each action item MUST include:
- What to do (specific, not generic)
- Why it matters (quantified impact where possible)
- How to do it (code snippet, text to copy, or step-by-step)
- Estimated score improvement

Write for a marketing manager who can implement or delegate technical tasks.
Use bullet points, not paragraphs. Be specific, not vague.`,
  user: `Generate an actionable AI-readiness report for {{domain}}.

Scores: Overall {{overallScore}}/100 ({{grade}})
- Technical: {{technicalScore}} | Content: {{contentScore}}
- AI Readiness: {{aiReadinessScore}} | Performance: {{performanceScore}}

Top Issues:
{{topIssues}}

Structured Data Found: {{structuredDataFound}}
Structured Data Missing: {{structuredDataMissing}}

AI Crawler Status: {{crawlerStatus}}

Visibility Results: {{visibilityResults}}

Competitors: {{competitorAnalysis}}

Quick Wins Available: {{quickWins}}`,
};
```

**Step 2: Create unified report generator**

```ts
// unified-report.ts
export class UnifiedReportGenerator {
  async generate(data: ReportData): Promise<UnifiedReport> {
    // 1. Aggregate all data sources
    // 2. Call LLM with UNIFIED_REPORT_PROMPT
    // 3. Parse structured output
    // 4. Merge with auto-generated fix snippets from fix-generator
    // 5. Return UnifiedReport with all sections
  }
}
```

**Step 3: Commit**

```bash
git add packages/narrative/src/
git commit -m "feat: add unified actionable report generator with impact-effort prioritization"
```

---

### Task 34: Structured data composer in fix generator

**Files:**

- Modify: `apps/api/src/services/fix-generator-service.ts`

**Step 1: Enhance NO_STRUCTURED_DATA fix prompt**

Current prompt just says "Generate JSON-LD structured data for the given page." Improve to:

```ts
NO_STRUCTURED_DATA: (ctx) => ({
  system: `You are a schema.org structured data expert. Generate JSON-LD markup for a web page.

Rules:
1. Analyze the page content to determine appropriate schema types
2. ALWAYS include Organization or WebSite schema for the root domain
3. Include the most specific applicable type: Article, Product, FAQPage, HowTo, LocalBusiness, Service, etc.
4. Include BreadcrumbList if the URL has path segments
5. For content pages, include speakable property (helps AI assistants)
6. Validate all required properties per schema.org spec
7. Use proper @context and @type
8. Return ONLY valid JSON-LD in a <script type="application/ld+json"> tag
9. Include multiple schema types as an @graph array when appropriate

Output format:
{
  "schemas": [
    { "type": "Organization", "jsonLd": "..." },
    { "type": "Article", "jsonLd": "..." },
    { "type": "BreadcrumbList", "jsonLd": "..." }
  ],
  "missing": ["FAQPage — add FAQ section to earn this"],
  "speakable": true
}`,
  user: `<document>\nURL: ${ctx.url}\nTitle: ${ctx.title}\nMeta: ${ctx.metaDescription}\nHeadings: ${ctx.headings?.join(", ")}\nContent excerpt: ${ctx.excerpt?.slice(0, 2000)}\n</document>`,
}),
```

**Step 2: Add new fix prompts for emerging issues**

```ts
// New fix types:
MISSING_SPEAKABLE: (ctx) => ({
  system: `Generate a speakable property for this page's structured data. The speakable property tells AI assistants which parts of the page are suitable for text-to-speech. Select the most informative 2-3 CSS selectors.`,
  user: `...`,
}),

THIN_CONTENT_FOR_AI: (ctx) => ({
  system: `This page has thin content that AI engines will skip. Generate a content expansion plan: 3-5 sections to add, each with a heading, 2-3 paragraph description, and key facts/statistics to include. Focus on making the content citation-worthy for AI assistants.`,
  user: `...`,
}),
```

**Step 3: Commit**

```bash
git add apps/api/src/services/fix-generator-service.ts
git commit -m "feat: enhance structured data composer with multi-type JSON-LD and speakable support"
```

---

### Task 35: Report UI — unified actionable report page

**Files:**

- Create: `apps/web/src/components/reports/unified-report-view.tsx`
- Modify: existing report display components to render new sections

**Step 1: Create unified report view**

Renders the 6 sections from Task 33 with:

- Collapsible sections with progress indicators
- Copy-to-clipboard for all code snippets
- "Mark as Done" checkboxes for action items
- Export to PDF (uses existing PDF generation)
- Share link (uses existing share token mechanism)

**Step 2: Add "Generate AI Report" button to project overview**

In the project overview tab, add a prominent CTA: "Generate AI Report" that triggers the unified report generation and displays results.

**Step 3: Commit**

```bash
git add apps/web/src/components/reports/
git commit -m "feat: add unified actionable report UI with copy-to-clipboard and progress tracking"
```

---

## Phase 8: Verification

### Task 36: Full integration verification

**Step 1: Run typecheck**

```bash
pnpm typecheck
```

**Step 2: Run all tests**

```bash
pnpm test
```

**Step 3: Manual smoke test**

- [ ] Wizard flow: enter domain → keywords extracted → crawl scope configured → competitors discovered → crawl starts
- [ ] Keywords saved to `savedKeywords` table with correct source
- [ ] Competitors saved to `competitors` table
- [ ] Crawl progress shows 3 phases with streaming updates
- [ ] Admin prompt list shows all 25+ prompts grouped by category
- [ ] Admin can edit prompt, save as new version, test with sample input
- [ ] Admin can activate new version, archive old one
- [ ] Prompt resolver uses DB version when available, falls back to hardcoded
- [ ] Version diff view works
- [ ] Unified report generates all 6 sections
- [ ] Structured data composer generates multi-type JSON-LD with speakable
- [ ] Report action items have impact-effort scoring
- [ ] Export to PDF includes new sections
- [ ] No regressions in existing functionality

**Step 4: Commit any fixes**

```bash
git commit -m "chore: verify wizard, prompt management, and unified report integration"
```

---

## Suggested Improvements Beyond Plan

### Improvements to Existing Prompts

Each of our 25+ prompts can be improved. Key patterns from competitor research:

| Prompt                | Current Issue                    | Improvement                                                                                             |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `content_scoring`     | Scores 5 dimensions in isolation | Add "AI citation likelihood" as 6th dimension — how likely is an AI to cite this content?               |
| `executive_summary`   | Generic summary                  | Add per-engine breakdown — "ChatGPT would rate this B+, Perplexity would cite 3 facts"                  |
| `keyword_suggestion`  | Generic queries                  | Add funnel stage classification (education/comparison/purchase) and estimated AI search volume          |
| `persona_generation`  | Generic personas                 | Add "AI search behavior" — what prompts does each persona type into ChatGPT?                            |
| `fix_structured_data` | Single schema type               | Multi-type @graph with speakable property (done in Task 34)                                             |
| `prompt_discovery`    | Discovers generic prompts        | Weight by actual AI engine usage patterns — Perplexity favors Reddit-style, ChatGPT favors encyclopedic |
| All fix prompts       | Generate fix only                | Add "estimated score impact" and "implementation time" to each fix response                             |
| Narrative prompts     | Report sections in isolation     | Add cross-references — "This connects to the schema issue identified in Technical Analysis"             |

### Trending Features to Consider (Future Phases)

1. **Per-engine optimization playbooks** — ChatGPT cites lower-ranking pages, Perplexity favors Reddit, Google AI Overviews prefers YouTube → give engine-specific recommendations
2. **AI citation-to-revenue attribution** — Connect GA4 integration data to visibility checks → "Your ChatGPT citations drove X visits last month"
3. **AI crawler analytics** — Track GPTBot, ClaudeBot, PerplexityBot visit frequency from server logs → "ClaudeBot crawls your site 3x/week"
4. **Real-time AI mention alerts** — Webhook/email when brand drops from or appears in AI answers for tracked queries
5. **Share of Voice dashboard** — Weighted by prompt volume, tracked weekly, visualized as trend lines
6. **Content format optimizer** — AI engines prefer bullet lists, comparison tables, step-by-step guides → analyze content format and suggest restructuring
7. **Multimodal readiness scoring** — Score images (alt text quality), videos (transcript availability), not just text
8. **Historical AI visibility trends** — Weekly/monthly trend lines showing citation frequency per engine over time
