# Post-Crawl Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire existing services (visibility checks, persona generation, narrative regeneration, report generation, competitor discovery) into the post-crawl pipeline so they run automatically, plus add frontend UX improvements (onboarding checklist, keyword expansion, platform readiness dedup, integration prompts).

**Architecture:** All auto-triggers hook into `apps/api/src/services/post-processing-service.ts → schedule()` as new `waitUntil` calls when `batch.is_final === true`. Each calls existing service functions with the project's saved keywords, LLM API keys, and plan limits. Frontend features are standalone components with localStorage persistence.

**Tech Stack:** Hono Workers API, Drizzle ORM (Neon PG), Next.js (App Router), Anthropic/OpenAI SDKs, SWR for data fetching.

---

## Task 1: Auto-Run Visibility Checks After Crawl (P0 — Backend)

**Files:**

- Modify: `apps/api/src/services/post-processing-service.ts`
- Create: `apps/api/src/services/auto-visibility-service.ts`
- Modify: `apps/api/src/services/outbox-processor.ts`

**Step 1: Create auto-visibility service**

Create `apps/api/src/services/auto-visibility-service.ts`:

```ts
import {
  createDb,
  savedKeywordQueries,
  projectQueries,
  userQueries,
} from "@llm-boost/db";
import { createVisibilityService } from "./visibility-service";
import {
  createProjectRepository,
  createUserRepository,
  createVisibilityRepository,
  createCompetitorRepository,
} from "../repositories";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";

export interface AutoVisibilityInput {
  databaseUrl: string;
  projectId: string;
  apiKeys: Record<string, string>;
}

const AUTO_PROVIDERS = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "copilot",
  "gemini_ai_mode",
  "grok",
];

// Plan-gated limits for auto-visibility
const AUTO_LIMITS: Record<string, { keywords: number; providers: string[] }> = {
  free: { keywords: 0, providers: [] },
  starter: { keywords: 3, providers: ["chatgpt", "claude", "perplexity"] },
  pro: { keywords: 10, providers: AUTO_PROVIDERS },
  agency: { keywords: 10, providers: AUTO_PROVIDERS },
};

export async function runAutoVisibilityChecks(
  input: AutoVisibilityInput,
): Promise<void> {
  const log = createLogger({ context: "auto-visibility" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  const limits = AUTO_LIMITS[user.plan] ?? AUTO_LIMITS.free;
  if (limits.keywords === 0) {
    log.info("Auto-visibility skipped: free plan", {
      projectId: input.projectId,
    });
    return;
  }

  const keywords = await savedKeywordQueries(db).listByProject(input.projectId);
  if (keywords.length === 0) {
    log.info("Auto-visibility skipped: no saved keywords", {
      projectId: input.projectId,
    });
    return;
  }

  const topKeywords = keywords.slice(0, limits.keywords);
  const service = createVisibilityService({
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    visibility: createVisibilityRepository(db),
    competitors: createCompetitorRepository(db),
  });

  for (const kw of topKeywords) {
    try {
      await service.runCheck({
        userId: project.userId,
        projectId: input.projectId,
        query: kw.keyword,
        providers: limits.providers,
        apiKeys: input.apiKeys,
      });
      log.info("Auto-visibility check completed", { keyword: kw.keyword });
    } catch (err) {
      // Plan limit or rate limit — stop early
      if (err instanceof Error && err.message.includes("limit")) break;
      log.error("Auto-visibility check failed", {
        keyword: kw.keyword,
        error: String(err),
      });
    }
  }
}
```

**Step 2: Wire into post-processing service**

In `apps/api/src/services/post-processing-service.ts`, add the import at the top:

```ts
import {
  runAutoVisibilityChecks,
  type AutoVisibilityInput,
} from "./auto-visibility-service";
```

Add a new `waitUntil` block after the existing regression detection block (around line 168), inside the `if (batch.is_final)` guard:

```ts
// Auto-run visibility checks (fire-and-forget)
if (batch.is_final) {
  args.executionCtx.waitUntil(
    runAutoVisibilityChecks({
      databaseUrl: env.databaseUrl,
      projectId,
      apiKeys: {
        chatgpt: (env as any).openaiApiKey ?? "",
        claude: env.anthropicApiKey ?? "",
        perplexity: (env as any).perplexityApiKey ?? "",
        gemini: (env as any).googleApiKey ?? "",
        copilot: (env as any).bingApiKey ?? "",
        gemini_ai_mode: (env as any).googleApiKey ?? "",
        grok: (env as any).xaiApiKey ?? "",
      },
    }).catch(() => {}),
  );
}
```

**Step 3: Add API keys to PostProcessingEnv**

In `post-processing-service.ts`, extend `PostProcessingEnv` to include:

```ts
openaiApiKey?: string;
perplexityApiKey?: string;
googleApiKey?: string;
bingApiKey?: string;
xaiApiKey?: string;
```

**Step 4: Pass API keys from ingest-service**

In `apps/api/src/services/ingest-service.ts`, the `env` object is passed through. It gets its shape from `BatchEnvironment`. Extend `BatchEnvironment` with the same keys. Then in the ingest route (`apps/api/src/routes/ingest.ts`), ensure the env binding maps `OPENAI_API_KEY → openaiApiKey`, etc.

Alternatively — simpler approach: pass the raw `Bindings` env through as an `any` on the `PostProcessingEnv` and extract keys in the auto-visibility call. The cleanest way: add a `rawBindings?: Record<string, string>` field to `PostProcessingEnv` and pass `env` from the ingest handler.

**Step 5: Run typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

**Step 6: Commit**

```bash
git add apps/api/src/services/auto-visibility-service.ts apps/api/src/services/post-processing-service.ts apps/api/src/services/ingest-service.ts apps/api/src/routes/ingest.ts
git commit -m "feat(api): auto-run visibility checks after crawl completion"
```

---

## Task 2: Auto-Regenerate Stale Narratives (P0 — Backend)

**Files:**

- Create: `apps/api/src/services/auto-narrative-service.ts`
- Modify: `apps/api/src/services/post-processing-service.ts`

**Step 1: Create auto-narrative service**

Create `apps/api/src/services/auto-narrative-service.ts`:

```ts
import { createDb, projectQueries, userQueries } from "@llm-boost/db";
import { createNarrativeService } from "./narrative-service";
import {
  createNarrativeRepository,
  createProjectRepository,
  createUserRepository,
  createCrawlRepository,
} from "../repositories";
import { createLogger } from "../lib/logger";

export interface AutoNarrativeInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
  anthropicApiKey: string;
}

export async function runAutoNarrativeRegeneration(
  input: AutoNarrativeInput,
): Promise<void> {
  const log = createLogger({ context: "auto-narrative" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  // Only Pro and Agency get narratives
  if (user.plan !== "pro" && user.plan !== "agency") return;

  const narrativeRepo = createNarrativeRepository(db);

  // Check if a narrative exists for this project (any crawl)
  const existingNarratives = await narrativeRepo.listByProject(
    input.projectId,
    1,
  );
  if (existingNarratives.length === 0) {
    log.info("Auto-narrative skipped: no existing narrative to regenerate", {
      projectId: input.projectId,
    });
    return;
  }

  const service = createNarrativeService({
    narratives: narrativeRepo,
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  // Generate a fresh narrative for the new crawl in "technical" tone
  try {
    await service.generate(project.userId, input.crawlJobId, "technical", {
      anthropicApiKey: input.anthropicApiKey,
    });
    log.info("Auto-narrative generated (technical)", {
      crawlJobId: input.crawlJobId,
    });
  } catch (err) {
    log.error("Auto-narrative generation failed", { error: String(err) });
  }
}
```

**Step 2: Wire into post-processing**

In `post-processing-service.ts`, import and add after auto-visibility:

```ts
import {
  runAutoNarrativeRegeneration,
  type AutoNarrativeInput,
} from "./auto-narrative-service";
```

```ts
// Auto-regenerate narrative (fire-and-forget)
if (batch.is_final && env.anthropicApiKey) {
  args.executionCtx.waitUntil(
    runAutoNarrativeRegeneration({
      databaseUrl: env.databaseUrl,
      projectId,
      crawlJobId,
      anthropicApiKey: env.anthropicApiKey,
    }).catch(() => {}),
  );
}
```

**Step 3: Run typecheck and commit**

```bash
cd apps/api && pnpm exec tsc --noEmit
git add apps/api/src/services/auto-narrative-service.ts apps/api/src/services/post-processing-service.ts
git commit -m "feat(api): auto-regenerate narrative after crawl completion"
```

---

## Task 3: Auto-Generate Personas (P1 — Backend)

**Files:**

- Create: `apps/api/src/services/auto-persona-service.ts`
- Modify: `apps/api/src/services/post-processing-service.ts`

**Step 1: Create auto-persona service**

Create `apps/api/src/services/auto-persona-service.ts`:

````ts
import {
  createDb,
  personaQueries,
  projectQueries,
  userQueries,
} from "@llm-boost/db";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";

export interface AutoPersonaInput {
  databaseUrl: string;
  projectId: string;
  anthropicApiKey: string;
}

const DEFAULT_ROLES = [
  "Decision Maker researching solutions",
  "Technical Evaluator comparing options",
  "End User seeking help or tutorials",
];

export async function runAutoPersonaGeneration(
  input: AutoPersonaInput,
): Promise<void> {
  const log = createLogger({ context: "auto-persona" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  const limits = PLAN_LIMITS[user.plan];
  if (!limits.personaRefinement) {
    log.info("Auto-persona skipped: free plan", { projectId: input.projectId });
    return;
  }

  const existing = await personaQueries(db).countByProject(input.projectId);
  if (existing > 0) {
    log.info("Auto-persona skipped: personas already exist", {
      projectId: input.projectId,
    });
    return;
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: input.anthropicApiKey });

  const prompt = `Generate 3 audience personas for a website. Each persona represents someone who would search for this product/service using AI search engines like ChatGPT or Perplexity.

Domain: ${project.domain}
Name: ${project.name}

Return ONLY valid JSON array with 3 objects, each having: { "name", "role", "jobToBeDone", "constraints", "successMetrics", "decisionCriteria", "vocabulary": [], "sampleQueries": [], "funnelStage": "education"|"comparison"|"purchase" }`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const personas = JSON.parse(cleaned);

    if (!Array.isArray(personas)) return;

    const maxToCreate = Math.min(
      personas.length,
      limits.personasPerProject - existing,
    );

    for (const p of personas.slice(0, maxToCreate)) {
      await personaQueries(db).create({
        projectId: input.projectId,
        name: p.name ?? "Auto-generated Persona",
        role: p.role ?? p.name,
        jobToBeDone: p.jobToBeDone,
        constraints: p.constraints,
        successMetrics: p.successMetrics,
        decisionCriteria: p.decisionCriteria,
        vocabulary: p.vocabulary ?? [],
        sampleQueries: p.sampleQueries ?? [],
        funnelStage: p.funnelStage ?? "education",
        isAutoGenerated: true,
      });
    }

    log.info(`Auto-persona created ${maxToCreate} personas`, {
      projectId: input.projectId,
    });
  } catch (err) {
    log.error("Auto-persona generation failed", { error: String(err) });
  }
}
````

**Step 2: Wire into post-processing**

```ts
import {
  runAutoPersonaGeneration,
  type AutoPersonaInput,
} from "./auto-persona-service";
```

```ts
// Auto-generate personas on first crawl (fire-and-forget)
if (batch.is_final && env.anthropicApiKey) {
  args.executionCtx.waitUntil(
    runAutoPersonaGeneration({
      databaseUrl: env.databaseUrl,
      projectId,
      anthropicApiKey: env.anthropicApiKey,
    }).catch(() => {}),
  );
}
```

**Step 3: Commit**

```bash
git add apps/api/src/services/auto-persona-service.ts apps/api/src/services/post-processing-service.ts
git commit -m "feat(api): auto-generate personas on first crawl"
```

---

## Task 4: Auto-Generate Report (P1 — Backend)

**Files:**

- Create: `apps/api/src/services/auto-report-service.ts`
- Modify: `apps/api/src/services/post-processing-service.ts`

**Step 1: Create auto-report service**

Create `apps/api/src/services/auto-report-service.ts`:

```ts
import { createDb, projectQueries, userQueries } from "@llm-boost/db";
import { createReportService } from "./report-service";
import {
  createReportRepository,
  createProjectRepository,
  createUserRepository,
  createCrawlRepository,
} from "../repositories";
import { canGenerateReport } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";

export interface AutoReportInput {
  databaseUrl: string;
  projectId: string;
  crawlJobId: string;
  reportServiceUrl: string;
  sharedSecret: string;
}

export async function runAutoReportGeneration(
  input: AutoReportInput,
): Promise<void> {
  const log = createLogger({ context: "auto-report" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  // Only Pro+ can generate reports
  if (user.plan !== "pro" && user.plan !== "agency") return;

  const reportRepo = createReportRepository(db);
  const usedThisMonth = await reportRepo.countThisMonth(project.userId);
  if (!canGenerateReport(user.plan, usedThisMonth, "summary")) return;

  const service = createReportService({
    reports: reportRepo,
    projects: createProjectRepository(db),
    users: createUserRepository(db),
    crawls: createCrawlRepository(db),
  });

  try {
    await service.generate(
      project.userId,
      {
        projectId: input.projectId,
        crawlJobId: input.crawlJobId,
        type: "summary",
        format: "pdf",
      },
      {
        reportServiceUrl: input.reportServiceUrl,
        sharedSecret: input.sharedSecret,
      },
    );
    log.info("Auto-report queued", { crawlJobId: input.crawlJobId });
  } catch (err) {
    log.error("Auto-report generation failed", { error: String(err) });
  }
}
```

**Step 2: Wire into post-processing**

Add to `PostProcessingEnv`:

```ts
reportServiceUrl?: string;
```

```ts
import {
  runAutoReportGeneration,
  type AutoReportInput,
} from "./auto-report-service";
```

```ts
// Auto-generate summary report (fire-and-forget)
if (batch.is_final && env.reportServiceUrl) {
  args.executionCtx.waitUntil(
    runAutoReportGeneration({
      databaseUrl: env.databaseUrl,
      projectId,
      crawlJobId,
      reportServiceUrl: env.reportServiceUrl,
      sharedSecret: (env as any).sharedSecret ?? "",
    }).catch(() => {}),
  );
}
```

**Step 3: Pass `reportServiceUrl` and `sharedSecret` from ingest route**

In `BatchEnvironment` add `reportServiceUrl?: string` and `sharedSecret?: string`. In the ingest route, pass `REPORT_SERVICE_URL` and `SHARED_SECRET` from env bindings.

**Step 4: Commit**

```bash
git add apps/api/src/services/auto-report-service.ts apps/api/src/services/post-processing-service.ts apps/api/src/services/ingest-service.ts apps/api/src/routes/ingest.ts
git commit -m "feat(api): auto-generate summary report after crawl (Pro+)"
```

---

## Task 5: Post-Crawl Onboarding Checklist (P1 — Frontend)

**Files:**

- Create: `apps/web/src/components/post-crawl-checklist.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx`

**Step 1: Create the checklist component**

Create `apps/web/src/components/post-crawl-checklist.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, Circle, X, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

interface ChecklistStep {
  id: string;
  label: string;
  tab: string;
  checkFn: (data: ChecklistData) => boolean;
}

interface ChecklistData {
  visibilityCount: number;
  personaCount: number;
  reportCount: number;
  scheduleCount: number;
}

const STEPS: ChecklistStep[] = [
  {
    id: "score",
    label: "Review your AI readiness score",
    tab: "overview",
    checkFn: () => true,
  },
  {
    id: "visibility",
    label: "Run an AI visibility check",
    tab: "visibility",
    checkFn: (d) => d.visibilityCount > 0,
  },
  {
    id: "personas",
    label: "Discover audience personas",
    tab: "personas",
    checkFn: (d) => d.personaCount > 0,
  },
  {
    id: "report",
    label: "Generate your first report",
    tab: "reports",
    checkFn: (d) => d.reportCount > 0,
  },
  {
    id: "schedule",
    label: "Set up visibility monitoring",
    tab: "visibility",
    checkFn: (d) => d.scheduleCount > 0,
  },
];

export function PostCrawlChecklist({ projectId }: { projectId: string }) {
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash

  useEffect(() => {
    const key = `checklist-dismissed-${projectId}`;
    setDismissed(localStorage.getItem(key) === "true");
  }, [projectId]);

  const { data: checklistData } = useApiSWR<ChecklistData>(
    dismissed ? null : `checklist-${projectId}`,
    useCallback(() => api.projects.getChecklistStatus(projectId), [projectId]),
  );

  if (dismissed || !checklistData) return null;

  const completedCount = STEPS.filter((s) => s.checkFn(checklistData)).length;
  if (completedCount === STEPS.length) return null; // All done

  const handleDismiss = () => {
    localStorage.setItem(`checklist-dismissed-${projectId}`, "true");
    setDismissed(true);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Get Started — {completedCount}/{STEPS.length} complete
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {STEPS.map((step) => {
            const done = step.checkFn(checklistData);
            return (
              <li key={step.id} className="flex items-center gap-2 text-sm">
                {done ? (
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span
                  className={cn(done && "line-through text-muted-foreground")}
                >
                  {step.label}
                </span>
                {!done && (
                  <a
                    href={`?tab=${step.tab}`}
                    className="ml-auto text-primary text-xs flex items-center gap-0.5 hover:underline"
                  >
                    Go <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add the checklist API endpoint**

In `apps/api/src/routes/projects.ts`, add a `GET /:projectId/checklist-status` endpoint that returns `{ visibilityCount, personaCount, reportCount, scheduleCount }` by querying the respective tables.

**Step 3: Add the API client method**

In `apps/web/src/lib/api.ts`, add to the `projects` namespace:

```ts
getChecklistStatus: (projectId: string) =>
  get<ChecklistData>(`/api/projects/${projectId}/checklist-status`),
```

**Step 4: Mount checklist on project page**

In `apps/web/src/app/dashboard/projects/[id]/page.tsx`, import `PostCrawlChecklist` and add it above the tabs (after the project header, before `<Tabs>`):

```tsx
<PostCrawlChecklist projectId={projectId} />
```

**Step 5: Commit**

```bash
git add apps/web/src/components/post-crawl-checklist.tsx apps/api/src/routes/projects.ts apps/web/src/lib/api.ts apps/web/src/app/dashboard/projects/[id]/page.tsx
git commit -m "feat(web): add post-crawl onboarding checklist"
```

---

## Task 6: Auto-Discover Competitors (P2 — Backend)

**Files:**

- Create: `apps/api/src/services/auto-competitor-service.ts`
- Modify: `apps/api/src/services/post-processing-service.ts`

**Step 1: Create auto-competitor service**

Create `apps/api/src/services/auto-competitor-service.ts`:

````ts
import { createDb, projectQueries, userQueries } from "@llm-boost/db";
import { createCompetitorBenchmarkService } from "./competitor-benchmark-service";
import {
  createCompetitorRepository,
  createCompetitorBenchmarkRepository,
} from "../repositories";
import { PLAN_LIMITS } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";

export interface AutoCompetitorInput {
  databaseUrl: string;
  projectId: string;
  anthropicApiKey: string;
}

export async function runAutoCompetitorDiscovery(
  input: AutoCompetitorInput,
): Promise<void> {
  const log = createLogger({ context: "auto-competitor" });
  const db = createDb(input.databaseUrl);

  const project = await projectQueries(db).getById(input.projectId);
  if (!project) return;

  const user = await userQueries(db).getById(project.userId);
  if (!user) return;

  const limits = PLAN_LIMITS[user.plan];
  if ((limits.competitorsPerProject ?? 0) === 0) return;

  const competitorRepo = createCompetitorRepository(db);
  const existing = await competitorRepo.listByProject(input.projectId);
  if (existing.length > 0) {
    log.info("Auto-competitor skipped: competitors already exist", {
      projectId: input.projectId,
    });
    return;
  }

  // Use LLM to suggest competitors
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: input.anthropicApiKey });

  const prompt = `Given the website domain "${project.domain}" (named "${project.name}"), identify 3 direct competitor domains. Return ONLY a JSON array of domain strings (no http/https prefix), e.g. ["competitor1.com", "competitor2.com", "competitor3.com"]. Only include real, active websites.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "[]";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const domains: string[] = JSON.parse(cleaned);
    if (!Array.isArray(domains)) return;

    const benchmarkService = createCompetitorBenchmarkService({
      competitorBenchmarks: createCompetitorBenchmarkRepository(db),
      competitors: competitorRepo,
    });

    const maxCompetitors = Math.min(
      domains.length,
      limits.competitorsPerProject ?? 3,
    );
    for (const domain of domains.slice(0, maxCompetitors)) {
      try {
        await benchmarkService.benchmarkCompetitor({
          projectId: input.projectId,
          competitorDomain: domain,
          competitorLimit: limits.competitorsPerProject ?? 3,
        });
        log.info("Auto-competitor benchmarked", { domain });
      } catch (err) {
        log.error("Auto-competitor benchmark failed", {
          domain,
          error: String(err),
        });
      }
    }
  } catch (err) {
    log.error("Auto-competitor discovery failed", { error: String(err) });
  }
}
````

**Step 2: Wire into post-processing**

```ts
import {
  runAutoCompetitorDiscovery,
  type AutoCompetitorInput,
} from "./auto-competitor-service";
```

```ts
// Auto-discover competitors on first crawl (fire-and-forget)
if (batch.is_final && env.anthropicApiKey) {
  args.executionCtx.waitUntil(
    runAutoCompetitorDiscovery({
      databaseUrl: env.databaseUrl,
      projectId,
      anthropicApiKey: env.anthropicApiKey,
    }).catch(() => {}),
  );
}
```

**Step 3: Commit**

```bash
git add apps/api/src/services/auto-competitor-service.ts apps/api/src/services/post-processing-service.ts
git commit -m "feat(api): auto-discover competitors on first crawl (Pro+)"
```

---

## Task 7: Verify Bulk AI Fix Works (P2 — Verification Only)

**Files:**

- Read: `apps/api/src/routes/fixes.ts`
- Read: `apps/web/src/components/quick-wins-card.tsx`

**Step 1: Read and verify the batch fix endpoint exists**

Check `POST /api/fixes/generate-batch` handler in `apps/api/src/routes/fixes.ts`.

**Step 2: Read and verify the UI button exists**

Check `quick-wins-card.tsx` for the "Fix All" button and `api.fixes.generateBatch()` call.

**Step 3: Report findings**

If both exist and are wired, mark as complete. If not, create the missing pieces.

**Step 4: Commit (if changes made)**

Only if fixes were needed.

---

## Task 8: Auto-Schedule Visibility Checks Prompt (P2 — Frontend)

**Files:**

- Modify: `apps/web/src/components/tabs/visibility-tab.tsx`

**Step 1: Add auto-schedule suggestion**

After a visibility check completes successfully in the Visibility tab, check if any schedules exist. If not, show a dismissible banner suggesting a weekly schedule:

```tsx
// In visibility-tab.tsx, after the run-check form section
{
  checkCompleted && schedules.length === 0 && !scheduleDismissed && (
    <Card className="border-primary/20">
      <CardContent className="flex items-center justify-between py-3">
        <p className="text-sm">Track your visibility weekly?</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleCreateWeeklySchedule}>
            Enable Weekly
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setScheduleDismissed(true)}
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

Where `handleCreateWeeklySchedule` calls `api.visibility.createSchedule({ projectId, query: lastQuery, providers: lastProviders, frequency: "weekly" })`.

**Step 2: Commit**

```bash
git add apps/web/src/components/tabs/visibility-tab.tsx
git commit -m "feat(web): suggest weekly schedule after first visibility check"
```

---

## Task 9: Smart Keyword Expansion from Gaps (P3 — Frontend + API)

**Files:**

- Modify: `apps/web/src/components/tabs/ai-visibility-tab.tsx`
- Modify: `apps/api/src/routes/keywords.ts`

**Step 1: Add "Track as Keywords" button to Visibility Gaps section**

In `ai-visibility-tab.tsx`, in the Visibility Gaps card, add a button below the gaps list:

```tsx
{
  gaps && gaps.length > 0 && (
    <Button
      size="sm"
      variant="outline"
      onClick={handleTrackGapsAsKeywords}
      disabled={trackingGaps}
    >
      {trackingGaps
        ? "Saving..."
        : `Track ${gaps.length} gap queries as keywords`}
    </Button>
  );
}
```

Where `handleTrackGapsAsKeywords` calls `api.keywords.createBatch(projectId, gaps.map(g => g.query))`.

**Step 2: Add batch keyword creation endpoint**

In `apps/api/src/routes/keywords.ts`, add `POST /:projectId/batch`:

```ts
keywordRoutes.post("/:projectId/batch", async (c) => {
  // Validate ownership, check plan limits
  // Call savedKeywordQueries(db).createMany(rows)
  // Return created keywords
});
```

**Step 3: Commit**

```bash
git add apps/web/src/components/tabs/ai-visibility-tab.tsx apps/api/src/routes/keywords.ts apps/web/src/lib/api.ts
git commit -m "feat: track visibility gap queries as keywords"
```

---

## Task 10: Deduplicate Platform Readiness (P3 — Frontend)

**Files:**

- Create: `apps/web/src/components/platform-readiness-badges.tsx`
- Modify: `apps/web/src/components/tabs/overview-tab.tsx`

**Step 1: Create compact badges component**

Create `apps/web/src/components/platform-readiness-badges.tsx`:

```tsx
"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type PlatformReadinessResult } from "@/lib/api";

const PLATFORM_ICONS: Record<string, string> = {
  ChatGPT: "🤖",
  Claude: "🟠",
  Perplexity: "🔍",
  Gemini: "💎",
  "Gemini AI Mode": "✨",
  Copilot: "🔷",
  Grok: "⚡",
};

function gradeColor(grade: string) {
  if (grade === "A") return "text-success";
  if (grade === "B") return "text-success/80";
  if (grade === "C") return "text-warning";
  return "text-destructive";
}

export function PlatformReadinessBadges({ crawlId }: { crawlId: string }) {
  const { data: matrix } = useApiSWR(
    `platform-readiness-${crawlId}`,
    useCallback(() => api.platformReadiness.get(crawlId), [crawlId]),
  );

  if (!matrix || matrix.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {matrix.map((p) => (
        <div
          key={p.platform}
          className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
        >
          <span>{PLATFORM_ICONS[p.platform] ?? "🔹"}</span>
          <span className="font-medium">{p.platform}</span>
          <span className={cn("font-bold", gradeColor(p.grade))}>
            {p.grade}
          </span>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Replace full matrix in overview tab**

In `overview-tab.tsx`, replace the `<PlatformReadinessMatrix>` import with `<PlatformReadinessBadges>`. The full matrix stays in `visibility-tab.tsx`.

**Step 3: Commit**

```bash
git add apps/web/src/components/platform-readiness-badges.tsx apps/web/src/components/tabs/overview-tab.tsx
git commit -m "feat(web): replace full platform matrix with compact badges in overview"
```

---

## Task 11: Integration Connection Prompts (P3 — Frontend)

**Files:**

- Create: `apps/web/src/components/integration-prompt-banner.tsx`
- Modify: `apps/web/src/components/tabs/overview-tab.tsx`

**Step 1: Create integration prompt banner**

Create `apps/web/src/components/integration-prompt-banner.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Plug, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

export function IntegrationPromptBanner({ projectId }: { projectId: string }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(
      localStorage.getItem(`integration-prompt-${projectId}`) === "true",
    );
  }, [projectId]);

  const { data: integrations } = useApiSWR(
    dismissed ? null : `integrations-${projectId}`,
    useCallback(() => api.integrations.list(projectId), [projectId]),
  );

  if (dismissed || !integrations) return null;

  const connected = new Set(
    integrations.filter((i: any) => i.enabled).map((i: any) => i.provider),
  );
  const missing = ["psi", "clarity"].filter((p) => !connected.has(p));

  if (missing.length === 0) return null;

  const handleDismiss = () => {
    localStorage.setItem(`integration-prompt-${projectId}`, "true");
    setDismissed(true);
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
      <CardContent className="flex items-center gap-3 py-3">
        <Plug className="h-4 w-4 text-blue-600 shrink-0" />
        <p className="text-sm flex-1">
          Connect {missing.join(" and ")} for richer performance and UX data.
        </p>
        <a
          href={`?tab=integrations`}
          className="text-sm text-primary font-medium hover:underline"
        >
          Connect
        </a>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to overview tab**

In `overview-tab.tsx`, import and render `<IntegrationPromptBanner projectId={projectId} />` near the top.

**Step 3: Commit**

```bash
git add apps/web/src/components/integration-prompt-banner.tsx apps/web/src/components/tabs/overview-tab.tsx
git commit -m "feat(web): prompt users to connect missing integrations"
```

---

## Task 12: Final Typecheck, Test, and Cleanup

**Step 1: Typecheck all packages**

```bash
pnpm typecheck
```

**Step 2: Run all tests**

```bash
pnpm test
```

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: fix typecheck and test issues from post-crawl automation"
```
