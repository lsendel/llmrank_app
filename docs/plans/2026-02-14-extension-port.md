# Extension Component Port Implementation Plan (v2 — revised)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the 6 most valuable components from the LLMRank Chrome Extension (`/Users/lsendel/Projects/llm`) into the SaaS platform, enriching scoring with per-platform breakdowns, actionable recommendations, content-type awareness, and a strengths summary.

**Architecture:** We add new modules to `packages/scoring` (platforms, recommendations, content-type) and new types/constants to `packages/shared`. The existing 4-category scoring engine (`engine.ts`) stays intact — platform scores are computed as a second pass over the existing category scores. DB gets 2 new jsonb columns + 1 text column via Drizzle migration. `performanceScore` is NOT added as a separate column — it already lives in `detail` jsonb.

**Tech Stack:** TypeScript, Drizzle ORM (Neon PG), Zod schemas, Vitest

**Source project:** `/Users/lsendel/Projects/llm/llmrank/` (read-only reference)

**Changes from v1 (gap analysis fixes):**

1. Recommendation engine covers ALL 48 issue codes (was 20)
2. Added `generateStrengths()` — highlights what's working well
3. Content-type detection runs BEFORE scoring, included in batch insert (not N updates)
4. `performanceScore` column dropped — stays in `detail` jsonb to avoid redundancy
5. `ScoreCreateData` in `packages/db` updated with new fields
6. Frontend types in `apps/web/src/lib/api.ts` explicitly updated
7. Sorting improved: priority → impact → estimatedImprovement (3-tier)
8. Recommendations capped at 10 (max)
9. Specific ingest test assertions added

---

### Task 1: Add Platform Types and Constants to `packages/shared`

**Files:**

- Create: `packages/shared/src/constants/platforms.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/__tests__/domain/platforms.test.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/__tests__/domain/platforms.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  LLM_PLATFORMS,
  LLM_PLATFORM_NAMES,
  PLATFORM_WEIGHTS,
  type LLMPlatformId,
} from "@llm-boost/shared";

describe("platform constants", () => {
  it("exports 5 platform IDs", () => {
    expect(LLM_PLATFORMS).toHaveLength(5);
    expect(LLM_PLATFORMS).toContain("chatgpt");
    expect(LLM_PLATFORMS).toContain("perplexity");
    expect(LLM_PLATFORMS).toContain("claude");
    expect(LLM_PLATFORMS).toContain("gemini");
    expect(LLM_PLATFORMS).toContain("grok");
  });

  it("has display names for all platforms", () => {
    for (const id of LLM_PLATFORMS) {
      expect(LLM_PLATFORM_NAMES[id]).toBeDefined();
      expect(typeof LLM_PLATFORM_NAMES[id]).toBe("string");
    }
  });

  it("has weights for all platforms summing to ~1.0", () => {
    for (const id of LLM_PLATFORMS) {
      const weights = PLATFORM_WEIGHTS[id];
      expect(weights).toBeDefined();
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it("weights reference valid scoring categories", () => {
    const validCategories = [
      "technical",
      "content",
      "ai_readiness",
      "performance",
    ];
    for (const id of LLM_PLATFORMS) {
      for (const key of Object.keys(PLATFORM_WEIGHTS[id])) {
        expect(validCategories).toContain(key);
      }
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter @llm-boost/shared test -- --run platforms`
Expected: FAIL — cannot import `LLM_PLATFORMS`

**Step 3: Write the implementation**

Create `packages/shared/src/constants/platforms.ts`:

```ts
/**
 * LLM platform identifiers and research-validated scoring weights.
 *
 * Platform weights map the SaaS's 4 scoring categories to per-platform
 * importance. Derived from 680M+ citation analysis (2025-2026).
 *
 * Source: LLMRank Extension platforms.ts
 * @see https://www.tryprofound.com/blog/ai-platform-citation-patterns
 * @see https://augurian.com/blog/llm-visibility-comparison/
 */

export const LLM_PLATFORMS = [
  "chatgpt",
  "perplexity",
  "claude",
  "gemini",
  "grok",
] as const;

export type LLMPlatformId = (typeof LLM_PLATFORMS)[number];

export const LLM_PLATFORM_NAMES: Record<LLMPlatformId, string> = {
  chatgpt: "ChatGPT (OpenAI)",
  perplexity: "Perplexity",
  claude: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
  grok: "Grok (xAI)",
};

export type PlatformCategoryWeights = Record<
  "technical" | "content" | "ai_readiness" | "performance",
  number
>;

export const PLATFORM_WEIGHTS: Record<LLMPlatformId, PlatformCategoryWeights> =
  {
    chatgpt: {
      technical: 0.1,
      content: 0.3,
      ai_readiness: 0.5,
      performance: 0.1,
    },
    perplexity: {
      technical: 0.25,
      content: 0.35,
      ai_readiness: 0.25,
      performance: 0.15,
    },
    claude: {
      technical: 0.18,
      content: 0.4,
      ai_readiness: 0.3,
      performance: 0.12,
    },
    gemini: {
      technical: 0.3,
      content: 0.25,
      ai_readiness: 0.3,
      performance: 0.15,
    },
    grok: {
      technical: 0.15,
      content: 0.4,
      ai_readiness: 0.25,
      performance: 0.2,
    },
  };

export const PLATFORM_TIPS: Record<LLMPlatformId, string[]> = {
  chatgpt: [
    "Use clear hierarchical heading structure (H1→H2→H3)",
    "Create comprehensive, in-depth content (2000+ words optimal)",
    "Include statistical facts and direct quotations (+22-37% citation boost)",
    "Build brand recognition and establish entity status",
  ],
  perplexity: [
    "Include visible publication and update dates (critical)",
    "Add current-year statistics and real-time data",
    "Implement schema markup (Article, FAQ) for AI trust",
    "Use answer-first formatting for quick extraction",
  ],
  claude: [
    "Use strong heading hierarchy with self-contained sections",
    "Maximize factual density with statistical facts",
    "Implement comprehensive schema chains (Article→Author→Organization)",
    "Break content into clear, scannable sections",
  ],
  gemini: [
    "Implement comprehensive JSON-LD schema (Article, FAQ, HowTo)",
    "Create Author→Organization schema chain for trust",
    "Use strong hierarchical structure with semantic HTML",
    "Include E-E-A-T signals with schema validation",
  ],
  grok: [
    "Reference current events and trending topics",
    "Include statistical facts and quotable statements",
    "Use accessible language with Flesch Reading Ease 55-70",
    "Implement schema markup for technical credibility",
  ],
};
```

**Step 4: Add export to `packages/shared/src/index.ts`**

```ts
export * from "./constants/platforms";
```

**Step 5: Run test to verify it passes**

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm --filter @llm-boost/shared test -- --run platforms`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/shared/src/constants/platforms.ts packages/shared/src/__tests__/domain/platforms.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add LLM platform types, weights, and tips

Port research-validated platform weights (680M+ citation analysis) from
the LLMRank Extension. Maps extension's 7-category weights to SaaS's
4-category scoring system for ChatGPT, Perplexity, Claude, Gemini, Grok."
```

---

### Task 2: Add Platform Scoring to `packages/scoring`

**Files:**

- Create: `packages/scoring/src/platforms.ts`
- Modify: `packages/scoring/src/types.ts`
- Modify: `packages/scoring/src/engine.ts`
- Modify: `packages/scoring/src/index.ts`
- Test: `packages/scoring/src/__tests__/platforms.test.ts`

**Step 1: Write the failing test**

Create `packages/scoring/src/__tests__/platforms.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculatePlatformScores } from "../platforms";

describe("calculatePlatformScores", () => {
  it("returns scores for all 5 platforms", () => {
    const result = calculatePlatformScores({
      technicalScore: 80,
      contentScore: 70,
      aiReadinessScore: 90,
      performanceScore: 60,
    });
    expect(Object.keys(result)).toHaveLength(5);
    for (const id of [
      "chatgpt",
      "perplexity",
      "claude",
      "gemini",
      "grok",
    ] as const) {
      expect(result[id]).toBeDefined();
    }
  });

  it("each platform has score, grade, and tips", () => {
    const result = calculatePlatformScores({
      technicalScore: 80,
      contentScore: 70,
      aiReadinessScore: 90,
      performanceScore: 60,
    });
    for (const platform of Object.values(result)) {
      expect(platform.score).toBeGreaterThanOrEqual(0);
      expect(platform.score).toBeLessThanOrEqual(100);
      expect(["A", "B", "C", "D", "F"]).toContain(platform.grade);
      expect(platform.tips.length).toBeGreaterThan(0);
    }
  });

  it("ChatGPT weights ai_readiness highest", () => {
    const result = calculatePlatformScores({
      technicalScore: 50,
      contentScore: 50,
      aiReadinessScore: 100,
      performanceScore: 50,
    });
    expect(result.chatgpt.score).toBeGreaterThan(result.gemini.score);
  });

  it("Gemini weights technical highest", () => {
    const result = calculatePlatformScores({
      technicalScore: 100,
      contentScore: 50,
      aiReadinessScore: 50,
      performanceScore: 50,
    });
    expect(result.gemini.score).toBeGreaterThanOrEqual(result.chatgpt.score);
    expect(result.gemini.score).toBeGreaterThanOrEqual(result.claude.score);
  });

  it("all perfect scores yield all A grades", () => {
    const result = calculatePlatformScores({
      technicalScore: 100,
      contentScore: 100,
      aiReadinessScore: 100,
      performanceScore: 100,
    });
    for (const p of Object.values(result)) {
      expect(p.score).toBe(100);
      expect(p.grade).toBe("A");
    }
  });

  it("all zero scores yield all F grades", () => {
    const result = calculatePlatformScores({
      technicalScore: 0,
      contentScore: 0,
      aiReadinessScore: 0,
      performanceScore: 0,
    });
    for (const p of Object.values(result)) {
      expect(p.score).toBe(0);
      expect(p.grade).toBe("F");
    }
  });
});
```

**Step 2:** Run test → FAIL

**Step 3: Write the implementation**

Create `packages/scoring/src/platforms.ts`:

```ts
import {
  LLM_PLATFORMS,
  PLATFORM_WEIGHTS,
  PLATFORM_TIPS,
  type LLMPlatformId,
} from "@llm-boost/shared";

export interface PlatformScoreResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  tips: string[];
}

export type PlatformScores = Record<LLMPlatformId, PlatformScoreResult>;

interface CategoryScores {
  technicalScore: number;
  contentScore: number;
  aiReadinessScore: number;
  performanceScore: number;
}

function getLetterGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function calculatePlatformScores(
  categories: CategoryScores,
): PlatformScores {
  const result: Partial<PlatformScores> = {};
  for (const platform of LLM_PLATFORMS) {
    const w = PLATFORM_WEIGHTS[platform];
    const score = Math.round(
      categories.technicalScore * w.technical +
        categories.contentScore * w.content +
        categories.aiReadinessScore * w.ai_readiness +
        categories.performanceScore * w.performance,
    );
    result[platform] = {
      score: Math.max(0, Math.min(100, score)),
      grade: getLetterGrade(score),
      tips: PLATFORM_TIPS[platform],
    };
  }
  return result as PlatformScores;
}
```

**Step 4:** Update `packages/scoring/src/types.ts` — add `platformScores` to `ScoringResult`:

```ts
import type { LLMPlatformId } from "@llm-boost/shared";
import type { PlatformScoreResult } from "./platforms";

// Add to ScoringResult interface:
platformScores: Record<LLMPlatformId, PlatformScoreResult>;
```

**Step 5:** Update `packages/scoring/src/engine.ts`:

```ts
import { calculatePlatformScores } from "./platforms";

// After line 48 (after performance = scorePerformanceFactors(page)):
const platformScores = calculatePlatformScores({
  technicalScore: technical.score,
  contentScore: content.score,
  aiReadinessScore: aiReadiness.score,
  performanceScore: performance.score,
});

// Add platformScores to the return object
```

**Step 6:** Update `packages/scoring/src/index.ts`:

```ts
export {
  calculatePlatformScores,
  type PlatformScores,
  type PlatformScoreResult,
} from "./platforms";
```

**Step 7:** Run all scoring tests → PASS

**Step 8:** Commit

---

### Task 3: Add Content-Type Detection to `packages/scoring`

Same as v1 — no changes needed. Content-type detection is a pure function that takes `(url, schemaTypes)`, both available in PageData.

**Files:**

- Create: `packages/scoring/src/domain/content-type.ts`
- Test: `packages/scoring/src/__tests__/content-type.test.ts`
- Modify: `packages/scoring/src/index.ts`

(See v1 for full code — unchanged.)

---

### Task 4: Add Recommendation Engine to `packages/scoring` (REVISED — full coverage)

**Files:**

- Create: `packages/scoring/src/recommendations.ts`
- Test: `packages/scoring/src/__tests__/recommendations.test.ts`
- Modify: `packages/scoring/src/index.ts`

**Key improvements over v1:**

1. **All 48 issue codes** mapped (was 20)
2. **`generateStrengths()`** function added — identifies top 5 things done right
3. **3-tier sorting**: priority → impact → estimatedImprovement
4. **Capped at 10** recommendations (configurable)
5. **`Strength` type** exported alongside `Recommendation`

**Step 1: Write the failing test**

Create `packages/scoring/src/__tests__/recommendations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  generateRecommendations,
  generateStrengths,
  RECOMMENDATION_TEMPLATES,
  type Recommendation,
} from "../recommendations";
import type { Issue } from "@llm-boost/shared";
import { ISSUE_DEFINITIONS } from "@llm-boost/shared";

const makeIssue = (
  code: string,
  severity: "critical" | "warning" | "info" = "warning",
  category:
    | "technical"
    | "content"
    | "ai_readiness"
    | "performance" = "technical",
): Issue => ({
  code,
  category,
  severity,
  message: `Issue: ${code}`,
  recommendation: `Fix ${code}`,
});

describe("generateRecommendations", () => {
  it("returns empty array for no issues", () => {
    expect(generateRecommendations([], 90)).toEqual([]);
  });

  it("generates rich recommendations for known issue codes", () => {
    const issues = [makeIssue("MISSING_H1"), makeIssue("MISSING_META_DESC")];
    const result = generateRecommendations(issues, 70);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].title).toBeDefined();
    expect(result[0].effort).toBeDefined();
    expect(result[0].impact).toBeDefined();
    expect(result[0].affectedPlatforms.length).toBeGreaterThan(0);
  });

  it("sorts by priority > impact > estimatedImprovement", () => {
    const issues = [
      makeIssue("MISSING_OG_TAGS"), // low priority
      makeIssue("MISSING_LLMS_TXT", "critical", "ai_readiness"), // high priority
      makeIssue("MISSING_H1"), // high priority
    ];
    const result = generateRecommendations(issues, 60);
    // High priority items come first
    expect(result[0].priority).toBe("high");
    expect(result[result.length - 1].priority).not.toBe("high");
  });

  it("includes steps and examples when available", () => {
    const issues = [makeIssue("MISSING_H1")];
    const result = generateRecommendations(issues, 60);
    const rec = result.find((r) => r.issueCode === "MISSING_H1");
    expect(rec?.steps).toBeDefined();
    expect(rec?.steps!.length).toBeGreaterThan(0);
    expect(rec?.example).toBeDefined();
  });

  it("caps at maxRecommendations (default 10)", () => {
    // Create many issues
    const codes = Object.keys(ISSUE_DEFINITIONS).slice(0, 20);
    const issues = codes.map((c) => makeIssue(c));
    const result = generateRecommendations(issues, 40);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("respects custom maxRecommendations", () => {
    const codes = Object.keys(ISSUE_DEFINITIONS).slice(0, 20);
    const issues = codes.map((c) => makeIssue(c));
    const result = generateRecommendations(issues, 40, 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("deduplicates issues with same code", () => {
    const issues = [makeIssue("MISSING_H1"), makeIssue("MISSING_H1")];
    const result = generateRecommendations(issues, 60);
    expect(result.filter((r) => r.issueCode === "MISSING_H1")).toHaveLength(1);
  });

  it("each recommendation has estimatedImprovement > 0", () => {
    const issues = [
      makeIssue("MISSING_H1"),
      makeIssue("MISSING_LLMS_TXT", "critical", "ai_readiness"),
    ];
    const result = generateRecommendations(issues, 60);
    for (const rec of result) {
      expect(rec.estimatedImprovement).toBeGreaterThan(0);
    }
  });

  it("covers every issue code in ISSUE_DEFINITIONS", () => {
    const allCodes = Object.keys(ISSUE_DEFINITIONS);
    const templateCodes = Object.keys(RECOMMENDATION_TEMPLATES);
    for (const code of allCodes) {
      expect(templateCodes).toContain(code);
    }
  });
});

describe("generateStrengths", () => {
  it("returns empty array when no category scores are high", () => {
    const scores = {
      technical: 50,
      content: 50,
      aiReadiness: 50,
      performance: 50,
    };
    const result = generateStrengths(scores, []);
    expect(result).toEqual([]);
  });

  it("returns strengths for high-scoring categories", () => {
    const scores = {
      technical: 95,
      content: 92,
      aiReadiness: 88,
      performance: 40,
    };
    const result = generateStrengths(scores, []);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].category).toBeDefined();
    expect(result[0].title).toBeDefined();
  });

  it("caps at 5 strengths", () => {
    const scores = {
      technical: 95,
      content: 95,
      aiReadiness: 95,
      performance: 95,
    };
    const result = generateStrengths(scores, []);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("excludes categories that have critical issues", () => {
    const scores = {
      technical: 95,
      content: 50,
      aiReadiness: 50,
      performance: 50,
    };
    const issues = [makeIssue("NOINDEX_SET", "critical")];
    const result = generateStrengths(scores, issues);
    const techStrength = result.find((s) => s.category === "technical");
    expect(techStrength).toBeUndefined();
  });
});
```

**Step 2:** Run test → FAIL

**Step 3: Write the implementation**

Create `packages/scoring/src/recommendations.ts`:

```ts
/**
 * Recommendation engine — generates actionable, prioritized recommendations
 * and strength highlights from scoring results.
 *
 * Ported and expanded from LLMRank Extension recommendations.ts.
 * Covers all 48 SaaS issue codes with rich templates.
 */

import type { Issue, LLMPlatformId } from "@llm-boost/shared";
import { LLM_PLATFORMS } from "@llm-boost/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationEffort = "quick" | "moderate" | "significant";
export type RecommendationImpact = "high" | "medium" | "low";

export interface Recommendation {
  issueCode: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  effort: RecommendationEffort;
  impact: RecommendationImpact;
  estimatedImprovement: number;
  affectedPlatforms: LLMPlatformId[];
  steps?: string[];
  example?: { before: string; after: string };
}

export interface Strength {
  category: "technical" | "content" | "ai_readiness" | "performance";
  title: string;
  description: string;
}

interface RecommendationTemplate {
  title: string;
  description: string;
  priority: RecommendationPriority;
  effort: RecommendationEffort;
  impact: RecommendationImpact;
  estimatedImprovement: number;
  affectedPlatforms: LLMPlatformId[];
  steps?: string[];
  example?: { before: string; after: string };
}

const ALL = [...LLM_PLATFORMS] as LLMPlatformId[];

// ---------------------------------------------------------------------------
// Templates — ALL 48 issue codes
// ---------------------------------------------------------------------------

export const RECOMMENDATION_TEMPLATES: Record<string, RecommendationTemplate> =
  {
    // === TECHNICAL (19 codes) ===
    MISSING_TITLE: {
      title: "Add a Descriptive Title Tag",
      description:
        "Title tags are one of the strongest signals LLMs use to understand page content.",
      priority: "high",
      effort: "quick",
      impact: "high",
      estimatedImprovement: 15,
      affectedPlatforms: ALL,
      steps: [
        "Write a unique title between 30-60 characters",
        "Include the page's primary topic keyword",
        "Add your brand name after a separator (e.g., ' — Brand')",
      ],
      example: {
        before: "<title>Page</title>",
        after: "<title>Complete Guide to Content Marketing — Brand</title>",
      },
    },
    MISSING_META_DESC: {
      title: "Write a Compelling Meta Description",
      description:
        "Meta descriptions help LLMs understand your page's purpose and relevance to queries.",
      priority: "medium",
      effort: "quick",
      impact: "medium",
      estimatedImprovement: 10,
      affectedPlatforms: ALL,
      steps: [
        "Write 120-160 characters summarizing the page's key value",
        "Include your primary topic keyword naturally",
        "Make it compelling — this is your 'elevator pitch' to AI",
      ],
    },
    MISSING_H1: {
      title: "Add a Single H1 Heading",
      description:
        "Every page should have exactly one H1 heading as the main title. LLMs use H1 to identify the page's primary topic.",
      priority: "high",
      effort: "quick",
      impact: "high",
      estimatedImprovement: 8,
      affectedPlatforms: ALL,
      steps: [
        "Identify the main topic of your content",
        "Create a clear, descriptive H1 heading",
        "Place it at the very beginning of your content",
        "Ensure no other H1 headings exist on the page",
      ],
      example: {
        before: "<h2>Guide to Content Marketing</h2>",
        after: "<h1>The Complete Guide to Content Marketing</h1>",
      },
    },
    MULTIPLE_H1: {
      title: "Use Only One H1 Heading",
      description:
        "Multiple H1 headings confuse both search engines and LLMs about the page's primary topic.",
      priority: "medium",
      effort: "quick",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: ["chatgpt", "gemini", "claude"],
    },
    HEADING_HIERARCHY: {
      title: "Fix Heading Level Jumps",
      description:
        "Headings should follow a logical hierarchy without skipping levels (H1→H2→H3). Skipped levels confuse AI content parsers.",
      priority: "medium",
      effort: "quick",
      impact: "medium",
      estimatedImprovement: 3,
      affectedPlatforms: ["chatgpt", "claude", "gemini"],
      steps: [
        "Review your heading structure for skipped levels (e.g., H1 directly to H3)",
        "Insert missing intermediate heading levels",
        "Ensure each subsection properly nests under its parent",
      ],
    },
    BROKEN_LINKS: {
      title: "Fix Broken Internal Links",
      description:
        "Broken links signal poor maintenance to AI crawlers and reduce your site's crawlability.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: ["gemini", "perplexity", "chatgpt"],
      steps: [
        "Identify the broken link destinations from the issue data",
        "Update URLs to point to valid pages or remove dead links",
        "Set up redirects for moved content",
      ],
    },
    MISSING_CANONICAL: {
      title: "Set a Canonical URL",
      description:
        "Canonical URLs prevent duplicate content confusion for AI crawlers scanning your site.",
      priority: "medium",
      effort: "quick",
      impact: "medium",
      estimatedImprovement: 8,
      affectedPlatforms: ALL,
      example: {
        before: "<!-- no canonical -->",
        after:
          '<link rel="canonical" href="https://example.com/preferred-url" />',
      },
    },
    NOINDEX_SET: {
      title: "Remove noindex Directive",
      description:
        "The noindex directive prevents ALL AI crawlers from indexing this page. Your content will never appear in AI responses.",
      priority: "high",
      effort: "quick",
      impact: "high",
      estimatedImprovement: 20,
      affectedPlatforms: ALL,
      steps: [
        "Verify this page should be indexed (not a staging/admin page)",
        'Remove the <meta name="robots" content="noindex"> tag',
        "Check robots.txt for conflicting Disallow rules",
      ],
    },
    MISSING_ALT_TEXT: {
      title: "Add Alt Text to Images",
      description:
        "Descriptive alt text helps LLMs understand image context and improves accessibility scoring (important for Gemini).",
      priority: "medium",
      effort: "quick",
      impact: "low",
      estimatedImprovement: 5,
      affectedPlatforms: ["gemini", "grok"],
      steps: [
        "Review all images on the page",
        "Write descriptive alt text (under 125 characters)",
        "Include relevant keywords naturally, not as keyword stuffing",
      ],
    },
    HTTP_STATUS: {
      title: "Fix Server Error (4xx/5xx)",
      description:
        "Pages returning error status codes get a score of 0. AI crawlers will skip these entirely.",
      priority: "high",
      effort: "significant",
      impact: "high",
      estimatedImprovement: 25,
      affectedPlatforms: ALL,
      steps: [
        "Check server logs for the root cause of the error",
        "For 404: restore the page or set up a redirect",
        "For 500: fix the server-side error in your application",
      ],
    },
    MISSING_OG_TAGS: {
      title: "Add Open Graph Tags",
      description:
        "OG tags help AI systems understand your content when it's shared or referenced in responses.",
      priority: "low",
      effort: "quick",
      impact: "low",
      estimatedImprovement: 5,
      affectedPlatforms: ["chatgpt", "perplexity"],
    },
    SLOW_RESPONSE: {
      title: "Reduce Server Response Time",
      description:
        "Response time over 2s causes AI crawlers to deprioritize your content or time out entirely.",
      priority: "medium",
      effort: "significant",
      impact: "medium",
      estimatedImprovement: 10,
      affectedPlatforms: ["perplexity", "gemini", "grok"],
      steps: [
        "Enable server-side caching (Redis, CDN edge cache)",
        "Optimize database queries (add indexes, reduce N+1)",
        "Consider upgrading hosting or using a CDN",
      ],
    },
    MISSING_SITEMAP: {
      title: "Add an XML Sitemap",
      description:
        "Sitemaps help AI crawlers discover and prioritize your content for indexing.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: ["gemini", "perplexity"],
    },
    SITEMAP_INVALID_FORMAT: {
      title: "Fix Sitemap XML Format",
      description:
        "Your sitemap has XML parsing errors. AI crawlers will ignore malformed sitemaps.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 8,
      affectedPlatforms: ["gemini", "perplexity"],
      steps: [
        "Validate your sitemap.xml at xml-sitemaps.com",
        "Ensure it follows the sitemaps.org/schemas/sitemap/0.9 standard",
        "Check for encoding issues or unclosed tags",
      ],
    },
    SITEMAP_STALE_URLS: {
      title: "Update Stale Sitemap Dates",
      description:
        "Sitemap lastmod dates older than 12 months signal abandoned content to AI crawlers.",
      priority: "low",
      effort: "quick",
      impact: "low",
      estimatedImprovement: 3,
      affectedPlatforms: ["perplexity", "grok"],
    },
    SITEMAP_LOW_COVERAGE: {
      title: "Add Missing Pages to Sitemap",
      description:
        "Your sitemap lists fewer than 50% of discovered pages. AI crawlers may miss important content.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: ["gemini", "perplexity"],
    },
    REDIRECT_CHAIN: {
      title: "Simplify Redirect Chain",
      description:
        "3+ redirect hops add latency and may cause AI crawlers to abandon the request.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 8,
      affectedPlatforms: ["gemini", "perplexity", "chatgpt"],
      steps: [
        "Identify the redirect chain from the issue data",
        "Update the original link to point directly to the final destination",
        "Remove intermediate redirects from your server config",
      ],
    },
    CORS_MIXED_CONTENT: {
      title: "Fix Mixed Content (HTTP on HTTPS)",
      description:
        "HTTPS pages loading HTTP resources are penalized by browsers and AI crawlers alike.",
      priority: "low",
      effort: "quick",
      impact: "low",
      estimatedImprovement: 5,
      affectedPlatforms: ["gemini"],
    },
    CORS_UNSAFE_LINKS: {
      title: "Add rel=noopener to External Links",
      description:
        'External links with target="_blank" missing rel="noopener" are a minor security and trust signal.',
      priority: "low",
      effort: "quick",
      impact: "low",
      estimatedImprovement: 3,
      affectedPlatforms: ["gemini"],
    },

    // === CONTENT (15 codes) ===
    THIN_CONTENT: {
      title: "Expand Content Depth",
      description:
        "Content under 500 words is rarely cited by LLMs. Research shows 2000+ words optimal for AI citations.",
      priority: "high",
      effort: "significant",
      impact: "high",
      estimatedImprovement: 15,
      affectedPlatforms: ALL,
      steps: [
        "Identify subtopics that need deeper coverage",
        "Add supporting data, examples, or case studies",
        "Include a FAQ section addressing common questions",
        "Target 2000+ words for comprehensive coverage",
      ],
    },
    CONTENT_DEPTH: {
      title: "Deepen Topic Coverage",
      description:
        "LLM analysis found shallow topic coverage. Add expert analysis, data, and supporting arguments.",
      priority: "medium",
      effort: "significant",
      impact: "high",
      estimatedImprovement: 10,
      affectedPlatforms: ["chatgpt", "claude", "perplexity"],
      steps: [
        "Expand each major section with supporting evidence",
        "Add original data, charts, or case studies",
        "Cover edge cases and common objections",
      ],
    },
    CONTENT_CLARITY: {
      title: "Improve Content Clarity",
      description:
        "LLM analysis flagged unclear writing. Use shorter paragraphs, subheadings, and plain language.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 8,
      affectedPlatforms: ["claude", "chatgpt", "grok"],
      steps: [
        "Break long paragraphs into 2-4 sentences each",
        "Add subheadings every 200-400 words",
        "Lead each section with the key takeaway",
      ],
    },
    CONTENT_AUTHORITY: {
      title: "Boost Content Authority Signals",
      description:
        "Content lacks citations, expert language, and authoritative sources that LLMs look for.",
      priority: "medium",
      effort: "moderate",
      impact: "high",
      estimatedImprovement: 10,
      affectedPlatforms: ["chatgpt", "claude", "gemini"],
      steps: [
        "Add 3+ citations to authoritative sources (.gov, .edu, research papers)",
        "Include specific statistics with sources",
        "Reference expert opinions or industry standards",
      ],
    },
    DUPLICATE_CONTENT: {
      title: "Resolve Duplicate Content",
      description:
        "This page has identical content to another page on your site. LLMs will pick one and skip the other.",
      priority: "high",
      effort: "significant",
      impact: "high",
      estimatedImprovement: 15,
      affectedPlatforms: ALL,
      steps: [
        "Decide which page is the canonical version",
        "Add a canonical tag pointing to the preferred page",
        "Consider merging content or differentiating the pages",
      ],
    },
    STALE_CONTENT: {
      title: "Refresh Outdated Content",
      description:
        "Content appears over 12 months old. Perplexity and Grok heavily penalize stale content.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: ["perplexity", "grok", "chatgpt"],
      steps: [
        "Update statistics and data to current year",
        "Add a visible 'Last Updated' date",
        "Review and refresh any outdated recommendations",
      ],
    },
    NO_INTERNAL_LINKS: {
      title: "Add Internal Links",
      description:
        "Internal linking helps LLMs understand your site structure and discover related content.",
      priority: "medium",
      effort: "quick",
      impact: "medium",
      estimatedImprovement: 8,
      affectedPlatforms: ALL,
    },
    EXCESSIVE_LINKS: {
      title: "Balance Internal vs External Links",
      description:
        "External links exceed internal links by 3:1. This makes your site look like a link directory rather than an authority.",
      priority: "low",
      effort: "quick",
      impact: "low",
      estimatedImprovement: 3,
      affectedPlatforms: ["gemini", "chatgpt"],
    },
    MISSING_FAQ_STRUCTURE: {
      title: "Add FAQ Schema for Q&A Content",
      description:
        "Your content has question-style headings but no FAQ schema. FAQPage schema helps LLMs extract Q&A pairs directly.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: ["chatgpt", "perplexity", "gemini"],
      steps: [
        "Identify question/answer pairs in your content",
        "Add FAQPage JSON-LD schema with mainEntity array",
        "Validate with Google's Rich Results Test",
      ],
    },
    POOR_READABILITY: {
      title: "Improve Content Readability",
      description:
        "LLMs cite content with Flesch Reading Ease 55-70 most frequently. Simplify complex sentences.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 10,
      affectedPlatforms: ALL,
      steps: [
        "Break long sentences into shorter ones (target 15-20 words)",
        "Replace jargon with simpler alternatives where possible",
        "Use active voice instead of passive voice",
      ],
      example: {
        before:
          "Utilize comprehensive methodologies to facilitate optimization.",
        after: "Use proven methods to improve your results.",
      },
    },
    LOW_TEXT_HTML_RATIO: {
      title: "Increase Visible Text Content",
      description:
        "Page is code-heavy with little visible text. AI crawlers extract text, not markup — your content may appear empty to them.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 8,
      affectedPlatforms: ["chatgpt", "claude", "perplexity"],
    },
    AI_ASSISTANT_SPEAK: {
      title: "Remove AI-Generated Language Patterns",
      description:
        "Overuse of 'moreover', 'furthermore', 'it is important to note' signals AI-generated content. LLMs may deprioritize it.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 10,
      affectedPlatforms: ALL,
      steps: [
        "Search for flagged transition words in your content",
        "Replace with more natural, varied phrasing",
        "Read sections aloud — if it sounds robotic, rewrite it",
      ],
    },
    UNIFORM_SENTENCE_LENGTH: {
      title: "Vary Your Sentence Length",
      description:
        "Uniform sentence lengths look machine-generated. Natural writing has 'burstiness' — mix short and long sentences.",
      priority: "low",
      effort: "moderate",
      impact: "low",
      estimatedImprovement: 5,
      affectedPlatforms: ["chatgpt", "claude"],
      example: {
        before:
          "This topic is important. The data shows clear trends. We should act on these findings. The results are significant.",
        after:
          "This matters. The data reveals a clear trend — and the implications are significant for anyone building content strategies in 2026.",
      },
    },
    LOW_EEAT_SCORE: {
      title: "Add Experience & Expertise Signals (E-E-A-T)",
      description:
        "Content lacks first-person experience markers. ChatGPT especially rewards content demonstrating real expertise.",
      priority: "medium",
      effort: "moderate",
      impact: "high",
      estimatedImprovement: 15,
      affectedPlatforms: ALL,
      steps: [
        "Add author byline with credentials or professional role",
        "Include first-person experience ('I tested', 'we found', 'in our analysis')",
        "Reference original data, case studies, or research",
        "Add Person + Organization schema markup for the author",
      ],
    },
    MISSING_AUTHORITATIVE_CITATIONS: {
      title: "Cite Authoritative Sources",
      description:
        "No links to .gov, .edu, or major research sites. Authoritative citations boost trust signals across all platforms.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: ["gemini", "perplexity", "chatgpt", "claude"],
      steps: [
        "Identify claims that would benefit from authoritative backing",
        "Link to .gov, .edu, or peer-reviewed sources",
        "Use descriptive anchor text (not 'click here')",
      ],
    },

    // === AI READINESS (13 codes) ===
    MISSING_LLMS_TXT: {
      title: "Add an llms.txt File",
      description:
        "llms.txt tells AI crawlers how to interact with your content. Sites with llms.txt get preferential treatment.",
      priority: "high",
      effort: "moderate",
      impact: "high",
      estimatedImprovement: 20,
      affectedPlatforms: ALL,
      steps: [
        "Create an llms.txt file in your site root",
        "Define your organization info and AI policy",
        "List key pages AI should prioritize",
        "Deploy to your-domain.com/llms.txt",
      ],
    },
    AI_CRAWLER_BLOCKED: {
      title: "Unblock AI Crawlers in robots.txt",
      description:
        "Your robots.txt blocks AI crawlers (GPTBot, ClaudeBot, PerplexityBot). Your content is invisible to AI search.",
      priority: "high",
      effort: "quick",
      impact: "high",
      estimatedImprovement: 25,
      affectedPlatforms: ALL,
      steps: [
        "Open your robots.txt file",
        "Remove or modify User-agent rules blocking GPTBot, ClaudeBot, PerplexityBot",
        "Test with a robots.txt validator",
      ],
    },
    NO_STRUCTURED_DATA: {
      title: "Add Schema Markup (JSON-LD)",
      description:
        "Structured data helps LLMs understand your content type, authorship, and facts. Critical for Gemini.",
      priority: "high",
      effort: "moderate",
      impact: "high",
      estimatedImprovement: 15,
      affectedPlatforms: ALL,
      steps: [
        "Choose the right schema type (Article, FAQPage, Product, etc.)",
        "Include required properties (headline, author, datePublished)",
        "Add JSON-LD script to your page's <head>",
        "Validate with Google's Rich Results Test",
      ],
    },
    INCOMPLETE_SCHEMA: {
      title: "Complete Schema Markup Properties",
      description:
        "Your structured data exists but is missing required properties. Incomplete schema is worse than none — it signals carelessness.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 8,
      affectedPlatforms: ["gemini", "chatgpt", "claude"],
      steps: [
        "Check the issue data for which properties are missing",
        "Add all required properties for your schema type (e.g., Article needs headline, author, datePublished)",
        "Validate with Google's Rich Results Test",
      ],
    },
    CITATION_WORTHINESS: {
      title: "Increase Citation Worthiness",
      description:
        "LLM analysis rated this content low on citation worthiness — it lacks the unique data, definitions, or quotes that AI wants to cite.",
      priority: "high",
      effort: "significant",
      impact: "high",
      estimatedImprovement: 12,
      affectedPlatforms: ALL,
      steps: [
        "Add unique data points, original research, or proprietary metrics",
        "Write clear, quotable definitions for key terms",
        "Include specific statistics with sources",
        "Make confident statements (avoid hedging like 'might' or 'perhaps')",
      ],
      example: {
        before:
          "Content marketing might possibly help improve your results somewhat.",
        after:
          "Content marketing increases organic traffic by 67% on average (HubSpot, 2025).",
      },
    },
    NO_DIRECT_ANSWERS: {
      title: "Add Direct Answer Patterns",
      description:
        "Content has question headings but doesn't lead with concise answers. AI extracts the first 1-2 sentences after a question.",
      priority: "medium",
      effort: "moderate",
      impact: "high",
      estimatedImprovement: 10,
      affectedPlatforms: ["perplexity", "chatgpt", "claude"],
      steps: [
        "After each question heading, add a 1-2 sentence direct answer",
        "Follow with supporting details and context",
        "Consider adding FAQPage schema for these Q&A pairs",
      ],
      example: {
        before:
          "## What is Content Marketing?\nContent marketing has evolved significantly...",
        after:
          "## What is Content Marketing?\nContent marketing is a strategy that creates valuable content to attract and retain customers. It drives 3x more leads than traditional marketing...",
      },
    },
    MISSING_ENTITY_MARKUP: {
      title: "Add Entity Schema Markup",
      description:
        "Key entities (people, organizations, products) aren't marked up in schema. This helps LLMs connect your content to their knowledge graph.",
      priority: "low",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: ["gemini", "chatgpt", "claude"],
    },
    NO_SUMMARY_SECTION: {
      title: "Add a Key Takeaways Section",
      description:
        "Pages with TL;DR or Key Takeaways sections are more likely to be cited — AI can extract the summary directly.",
      priority: "medium",
      effort: "quick",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: ALL,
      steps: [
        "Add a 'Key Takeaways' or 'TL;DR' heading near the top or bottom",
        "List 3-5 main points as a bulleted list",
        "Keep each point to 1-2 sentences",
      ],
    },
    POOR_QUESTION_COVERAGE: {
      title: "Address Common Questions About This Topic",
      description:
        "LLM analysis found the content doesn't adequately address likely search queries for this topic.",
      priority: "medium",
      effort: "significant",
      impact: "high",
      estimatedImprovement: 10,
      affectedPlatforms: ["chatgpt", "perplexity", "claude"],
      steps: [
        "Research 'People Also Ask' questions for your topic",
        "Add sections addressing the top 5-10 related questions",
        "Use question-style H2/H3 headings followed by direct answers",
      ],
    },
    INVALID_SCHEMA: {
      title: "Fix JSON-LD Schema Errors",
      description:
        "Your structured data has parsing errors. Broken schema is worse than no schema — fix or remove it.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 8,
      affectedPlatforms: ["gemini", "chatgpt"],
      steps: [
        "Validate your JSON-LD at schema.org or Google Rich Results Test",
        "Check for missing quotes, commas, or unclosed brackets",
        "Ensure all @type values are valid schema.org types",
      ],
    },
    HAS_PDF_CONTENT: {
      title: "Create HTML Versions of PDF Content",
      description:
        "This page links to PDFs. AI crawlers struggle with PDF extraction — provide HTML alternatives for best citation coverage.",
      priority: "low",
      effort: "significant",
      impact: "medium",
      estimatedImprovement: 3,
      affectedPlatforms: ["chatgpt", "claude", "perplexity"],
    },
    PDF_ONLY_CONTENT: {
      title: "Replace PDF-Only Content with HTML",
      description:
        "This page primarily links to PDFs with little HTML content. AI crawlers can't effectively index PDF-only pages.",
      priority: "medium",
      effort: "significant",
      impact: "medium",
      estimatedImprovement: 5,
      affectedPlatforms: ALL,
      steps: [
        "Extract key content from PDFs into HTML on this page",
        "Add summaries of each linked PDF",
        "Keep PDFs as supplementary downloads, not primary content",
      ],
    },
    AI_CONTENT_EXTRACTABLE: {
      title: "Content Structure is AI-Ready",
      description:
        "No action needed — your content structure is well-optimized for AI extraction.",
      priority: "low",
      effort: "quick",
      impact: "low",
      estimatedImprovement: 1,
      affectedPlatforms: ALL,
    },

    // === PERFORMANCE (5 codes) ===
    LH_PERF_LOW: {
      title: "Improve Page Performance",
      description:
        "Lighthouse Performance score is below threshold. Slow pages are deprioritized by AI crawlers.",
      priority: "medium",
      effort: "significant",
      impact: "medium",
      estimatedImprovement: 10,
      affectedPlatforms: ["perplexity", "gemini", "grok"],
      steps: [
        "Optimize and compress images (WebP format, lazy loading)",
        "Minimize render-blocking JavaScript and CSS",
        "Enable server-side caching and CDN",
        "Run Lighthouse for specific audit recommendations",
      ],
    },
    LH_SEO_LOW: {
      title: "Fix Lighthouse SEO Issues",
      description:
        "Lighthouse SEO audit found issues that affect how AI crawlers index your content.",
      priority: "medium",
      effort: "moderate",
      impact: "medium",
      estimatedImprovement: 8,
      affectedPlatforms: ["gemini", "perplexity"],
      steps: [
        "Run Lighthouse and review the SEO audit section",
        "Ensure all links are crawlable (no JavaScript-only links)",
        "Add valid hreflang tags if serving multiple languages",
      ],
    },
    LH_A11Y_LOW: {
      title: "Improve Accessibility Score",
      description:
        "Low accessibility scores correlate with poor AI readability. Semantic HTML benefits both humans and AI.",
      priority: "low",
      effort: "moderate",
      impact: "low",
      estimatedImprovement: 3,
      affectedPlatforms: ["gemini", "grok"],
    },
    LH_BP_LOW: {
      title: "Address Best Practice Issues",
      description:
        "Lighthouse flagged best-practice violations (deprecated APIs, console errors, etc.).",
      priority: "low",
      effort: "moderate",
      impact: "low",
      estimatedImprovement: 3,
      affectedPlatforms: ["gemini"],
    },
    LARGE_PAGE_SIZE: {
      title: "Reduce Page Size Below 3MB",
      description:
        "Pages over 3MB may cause AI crawlers to time out or truncate content extraction.",
      priority: "medium",
      effort: "significant",
      impact: "medium",
      estimatedImprovement: 10,
      affectedPlatforms: ["perplexity", "grok", "gemini"],
      steps: [
        "Compress images (target WebP, reduce dimensions)",
        "Minify CSS and JavaScript bundles",
        "Lazy-load below-the-fold content and images",
        "Remove unused CSS/JS libraries",
      ],
    },
  };

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
const IMPACT_ORDER: Record<RecommendationImpact, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function sortRecommendations(a: Recommendation, b: Recommendation): number {
  const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (pDiff !== 0) return pDiff;
  const iDiff = IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact];
  if (iDiff !== 0) return iDiff;
  return b.estimatedImprovement - a.estimatedImprovement;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate actionable recommendations from scoring issues.
 * Returns up to maxRecommendations (default 10), sorted by priority > impact > improvement.
 */
export function generateRecommendations(
  issues: Issue[],
  overallScore: number,
  maxRecommendations = 10,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const seen = new Set<string>();

  for (const issue of issues) {
    if (seen.has(issue.code)) continue;
    const template = RECOMMENDATION_TEMPLATES[issue.code];
    if (!template) continue;

    // Skip the "no action needed" informational codes
    if (template.estimatedImprovement <= 1) continue;

    seen.add(issue.code);
    recommendations.push({ issueCode: issue.code, ...template });
  }

  recommendations.sort(sortRecommendations);
  return recommendations.slice(0, maxRecommendations);
}

// ---------------------------------------------------------------------------
// Strengths
// ---------------------------------------------------------------------------

interface CategoryScoresForStrengths {
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
}

const STRENGTH_DEFINITIONS: {
  category: Strength["category"];
  key: keyof CategoryScoresForStrengths;
  threshold: number;
  title: string;
  description: string;
}[] = [
  {
    category: "technical",
    key: "technical",
    threshold: 85,
    title: "Strong Technical SEO",
    description:
      "Page has proper title, headings, meta tags, canonical URL, and structured data.",
  },
  {
    category: "content",
    key: "content",
    threshold: 85,
    title: "High-Quality Content",
    description:
      "Content demonstrates depth, clarity, readability, and natural writing style.",
  },
  {
    category: "ai_readiness",
    key: "aiReadiness",
    threshold: 85,
    title: "AI-Ready Content",
    description:
      "Content is well-structured for AI extraction with schema markup, llms.txt, and citation-worthy information.",
  },
  {
    category: "performance",
    key: "performance",
    threshold: 85,
    title: "Fast Page Performance",
    description:
      "Page loads quickly with good Lighthouse scores across performance, SEO, and accessibility.",
  },
];

/**
 * Identify top strengths — what the page is doing well.
 * Returns up to 5 strengths, excluding categories with critical issues.
 */
export function generateStrengths(
  categoryScores: CategoryScoresForStrengths,
  issues: Issue[],
): Strength[] {
  const criticalCategories = new Set(
    issues.filter((i) => i.severity === "critical").map((i) => i.category),
  );

  const strengths: Strength[] = [];
  for (const def of STRENGTH_DEFINITIONS) {
    if (
      categoryScores[def.key] >= def.threshold &&
      !criticalCategories.has(def.category)
    ) {
      strengths.push({
        category: def.category,
        title: def.title,
        description: def.description,
      });
    }
  }

  return strengths.slice(0, 5);
}
```

**Step 4: Add exports to `packages/scoring/src/index.ts`**

```ts
export {
  generateRecommendations,
  generateStrengths,
  RECOMMENDATION_TEMPLATES,
  type Recommendation,
  type Strength,
  type RecommendationPriority,
  type RecommendationEffort,
  type RecommendationImpact,
} from "./recommendations";
```

**Step 5:** Run test → PASS

**Step 6:** Commit

```bash
git commit -m "feat(scoring): add recommendation engine (all 48 codes) + strengths

Complete recommendation coverage for all issue codes with priority,
effort, impact, steps, and examples. 3-tier sorting, capped at 10.
generateStrengths() highlights what pages do well."
```

---

### Task 5: Database Migration — Add platform_scores, recommendations, content_type

**Files:**

- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/queries/scores.ts`
- Generate: migration via `drizzle-kit generate`

**Step 1: Update the `pages` table schema**

In `packages/db/src/schema.ts`, add to the `pages` table (after `wordCount`):

```ts
contentType: text("content_type").default("unknown"),
```

**Step 2: Update the `pageScores` table schema**

Add to the `pageScores` table (after `detail`):

```ts
platformScores: jsonb("platform_scores"),
recommendations: jsonb("recommendations"),
```

**NOTE:** We do NOT add a `performanceScore` column. It already exists inside `detail` jsonb and there's no reason to duplicate it.

**Step 3: Update `ScoreCreateData` in `packages/db/src/queries/scores.ts`**

Add to the `ScoreCreateData` interface:

```ts
platformScores?: unknown;
recommendations?: unknown;
```

**Step 4: Generate and verify migration**

Run: `cd /Users/lsendel/Projects/LLMRank_app/packages/db && npx drizzle-kit generate`

Verify the SQL adds:

- `content_type TEXT DEFAULT 'unknown'` on `pages`
- `platform_scores JSONB` on `page_scores`
- `recommendations JSONB` on `page_scores`

**Step 5: Push to dev database**

Run: `cd /Users/lsendel/Projects/LLMRank_app/packages/db && npx drizzle-kit push`

**Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/queries/scores.ts packages/db/migrations/
git commit -m "feat(db): add platform_scores, recommendations, content_type columns"
```

---

### Task 6: Update Ingest Service to Store New Scoring Data

**Files:**

- Modify: `apps/api/src/services/ingest-service.ts`
- Test: `apps/api/src/__tests__/services/ingest-service.test.ts`

**Step 1: Add imports**

At the top of `ingest-service.ts`, add:

```ts
import {
  scorePage,
  detectContentType,
  generateRecommendations,
  type PageData,
} from "@llm-boost/scoring";
```

**Step 2: Compute content type BEFORE page insert (line ~83)**

In the `pageRows` map function (line 83-96), add content type detection:

```ts
const pageRows = batch.pages.map((p: CrawlPageResult) => {
  const ct = detectContentType(p.url, p.extracted.schema_types);
  return {
    jobId: batch.job_id,
    projectId: crawlJob.projectId,
    url: p.url,
    canonicalUrl: p.canonical_url,
    statusCode: p.status_code,
    title: p.title,
    metaDesc: p.meta_description,
    contentHash: p.content_hash,
    wordCount: p.word_count,
    r2RawKey: p.html_r2_key,
    r2LhKey: p.lighthouse?.lh_r2_key ?? null,
    crawledAt: new Date(),
    contentType: ct.type, // NEW
  };
});
```

**Step 3: Store platform scores and recommendations in scoreRows (line ~123)**

Update the score row construction:

```ts
scoreRows.push({
  pageId: insertedPage.id,
  jobId: batch.job_id,
  overallScore: result.overallScore,
  technicalScore: result.technicalScore,
  contentScore: result.contentScore,
  aiReadinessScore: result.aiReadinessScore,
  lighthousePerf: crawlPageResult.lighthouse?.performance ?? null,
  lighthouseSeo: crawlPageResult.lighthouse?.seo ?? null,
  detail: {
    performanceScore: result.performanceScore,
    letterGrade: result.letterGrade,
    extracted: crawlPageResult.extracted,
    lighthouse: crawlPageResult.lighthouse ?? null,
  },
  platformScores: result.platformScores, // NEW
  recommendations: generateRecommendations(result.issues, result.overallScore), // NEW
});
```

**Step 4: Update ingest service test**

In `apps/api/src/__tests__/services/ingest-service.test.ts`, add assertions:

```ts
// After verifying scores.createBatch was called, check the row shape:
const scoreRow = mockScores.createBatch.mock.calls[0][0][0];
expect(scoreRow.platformScores).toBeDefined();
expect(Object.keys(scoreRow.platformScores)).toHaveLength(5);
expect(scoreRow.recommendations).toBeDefined();
expect(Array.isArray(scoreRow.recommendations)).toBe(true);

// Verify contentType was included in page insert:
const pageRow = mockPages.createBatch.mock.calls[0][0][0];
expect(pageRow.contentType).toBeDefined();
expect(typeof pageRow.contentType).toBe("string");
```

**Step 5:** Run tests → PASS

**Step 6:** Commit

```bash
git add apps/api/src/services/ingest-service.ts apps/api/src/__tests__/services/ingest-service.test.ts
git commit -m "feat(api): store platform scores, recommendations, content type on ingest

Compute content type in batch map (no extra queries), generate
recommendations from issues, and store platform scores — all in
the existing insert flow."
```

---

### Task 7: Update API Responses and Frontend Types

**Files:**

- Modify: `packages/shared/src/schemas/scoring.ts`
- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add Zod schemas to existing `packages/shared/src/schemas/scoring.ts`**

Add AFTER the existing `LLMContentScoresSchema`:

```ts
export const PlatformScoreSchema = z.object({
  score: z.number().min(0).max(100),
  grade: z.enum(["A", "B", "C", "D", "F"]),
  tips: z.array(z.string()),
});

export const RecommendationSchema = z.object({
  issueCode: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  effort: z.enum(["quick", "moderate", "significant"]),
  impact: z.enum(["high", "medium", "low"]),
  estimatedImprovement: z.number(),
  affectedPlatforms: z.array(z.string()),
  steps: z.array(z.string()).optional(),
  example: z.object({ before: z.string(), after: z.string() }).optional(),
});

export const StrengthSchema = z.object({
  category: z.string(),
  title: z.string(),
  description: z.string(),
});

export type PlatformScoreDetail = z.infer<typeof PlatformScoreSchema>;
export type RecommendationDetail = z.infer<typeof RecommendationSchema>;
export type StrengthDetail = z.infer<typeof StrengthSchema>;
```

**Step 2: Update frontend types in `apps/web/src/lib/api.ts`**

Update the `PageScoreDetail` interface's `score` field to include the new columns:

```ts
score: {
  overallScore: number;
  technicalScore: number | null;
  contentScore: number | null;
  aiReadinessScore: number | null;
  lighthousePerf: number | null;
  lighthouseSeo: number | null;
  letterGrade: string;
  detail: Record<string, unknown>;
  platformScores: Record<string, {
    score: number;
    grade: string;
    tips: string[];
  }> | null;        // NEW
  recommendations: Array<{
    issueCode: string;
    title: string;
    description: string;
    priority: string;
    effort: string;
    impact: string;
    estimatedImprovement: number;
    affectedPlatforms: string[];
    steps?: string[];
    example?: { before: string; after: string };
  }> | null;        // NEW
} | null;
```

**Step 3:** Run typecheck

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm typecheck`
Expected: PASS

**Step 4:** Commit

```bash
git add packages/shared/src/schemas/scoring.ts apps/web/src/lib/api.ts
git commit -m "feat: add platform scores and recommendations to API types

Update Zod schemas in shared package and frontend TypeScript types
to include platformScores, recommendations, and strengths."
```

---

### Task 8: Full Typecheck and Test Suite

**Step 1:** Run full typecheck

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm typecheck`
Expected: PASS with no errors

**Step 2:** Run full test suite

Run: `cd /Users/lsendel/Projects/LLMRank_app && pnpm test`
Expected: ALL PASS

**Step 3:** Fix any issues, then commit if needed.

---

### Summary of Deliverables (v2)

| Task | What                                            | Files                                         | Tests     |
| ---- | ----------------------------------------------- | --------------------------------------------- | --------- |
| 1    | Platform types + weights + tips                 | `packages/shared/src/constants/platforms.ts`  | 4         |
| 2    | Platform scoring engine                         | `packages/scoring/src/platforms.ts`           | 6         |
| 3    | Content-type detection                          | `packages/scoring/src/domain/content-type.ts` | 8         |
| 4    | Recommendation engine (48 codes) + strengths    | `packages/scoring/src/recommendations.ts`     | 10        |
| 5    | DB migration (2 jsonb + 1 text column)          | Drizzle migration                             | —         |
| 6    | Ingest service (batch insert, no extra queries) | Modified `ingest-service.ts`                  | Updated   |
| 7    | API + frontend types                            | Modified `scoring.ts` + `api.ts`              | —         |
| 8    | Full typecheck + test pass                      | —                                             | All green |

**Not included (future tasks):**

- Frontend platform score cards UI
- Frontend recommendation tab UI
- LLMs.txt generator API endpoint
- Content-type adaptive scoring weights (adjust factor deductions by content type)
