# Meta & Social Visibility Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Meta & Social visibility layer with OG health scoring (5 new factors), Meta AI readiness scorecard (Claude-powered), and social entity consistency detection — surfaced in a new "Meta & Social" dashboard tab.

**Architecture:** OG health factors extend the existing `meta_tags` scoring dimension. Meta AI readiness + social consistency run as on-demand Claude Haiku analysis stored in a new `meta_ai_analyses` table. Social profile detection is a pure TypeScript utility scanning `external_links`. New API routes under `/api/meta-ai`. New "Meta & Social" tab on the project dashboard.

**Tech Stack:** TypeScript, Drizzle ORM (Neon PG), Hono Workers API, Claude Haiku (Anthropic SDK), Next.js (React), Zod schemas

---

### Task 1: Add OG Health Issue Definitions

**Files:**

- Modify: `packages/shared/src/constants/issues.ts`

**Step 1: Add 5 new issue definitions**

After the existing `MISSING_OG_TAGS` block (around line 173), add:

```typescript
  OG_TITLE_MISMATCH: {
    code: "OG_TITLE_MISMATCH",
    category: "technical",
    severity: "info",
    scoreImpact: -3,
    message: "og:title significantly differs from the page <title> tag",
    recommendation:
      "Align og:title with your page title. Small differences are fine (e.g. adding brand name), but the core topic should match.",
    effortLevel: "low",
    dimension: "meta_tags",
  },
  OG_DESC_TOO_SHORT: {
    code: "OG_DESC_TOO_SHORT",
    category: "technical",
    severity: "info",
    scoreImpact: -2,
    message: "og:description is too short (<55 chars) or too long (>200 chars)",
    recommendation:
      "Write an og:description between 55-200 characters that compels clicks when shared on social platforms.",
    effortLevel: "low",
    dimension: "meta_tags",
  },
  OG_IMAGE_MISSING_OR_BROKEN: {
    code: "OG_IMAGE_MISSING_OR_BROKEN",
    category: "technical",
    severity: "warning",
    scoreImpact: -5,
    message: "og:image URL is broken or the image is too small (<200x200px)",
    recommendation:
      "Provide an og:image of at least 1200x630px (1.91:1 ratio) that returns a 200 status. This is critical for social sharing.",
    effortLevel: "medium",
    dimension: "meta_tags",
  },
  OG_IMAGE_BAD_RATIO: {
    code: "OG_IMAGE_BAD_RATIO",
    category: "technical",
    severity: "info",
    scoreImpact: -2,
    message: "og:image aspect ratio is not the recommended 1.91:1 (1200x630)",
    recommendation:
      "Resize your og:image to 1200x630px (1.91:1 aspect ratio) for optimal display on Facebook, LinkedIn, and other platforms.",
    effortLevel: "low",
    dimension: "meta_tags",
  },
  OG_URL_MISMATCH: {
    code: "OG_URL_MISMATCH",
    category: "technical",
    severity: "warning",
    scoreImpact: -3,
    message: "og:url does not match the canonical URL",
    recommendation:
      "Set og:url to match your canonical URL. Mismatches can cause share counts to split between URLs.",
    effortLevel: "low",
    dimension: "meta_tags",
  },
```

**Step 2: Verify the shared package builds**

Run: `pnpm --filter @llm-boost/shared build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add packages/shared/src/constants/issues.ts
git commit -m "feat(shared): add 5 OG health issue definitions for Meta social scoring"
```

---

### Task 2: Add OG Health Scoring Factors

**Files:**

- Modify: `packages/scoring/src/dimensions/meta-tags.ts`
- Modify: `packages/scoring/src/thresholds.ts`

**Step 1: Add OG thresholds**

In `packages/scoring/src/thresholds.ts`, add after `altTextMaxPenalty` (around line 9):

```typescript
  ogDescMin: 55,
  ogDescMax: 200,
  ogImageMinWidth: 200,
  ogImageMinHeight: 200,
  ogImageIdealRatio: 1.91,
  ogImageRatioTolerance: 0.15,
  ogTitleMaxLevenshteinRatio: 0.6,
```

**Step 2: Enhance `scoreMetaTags` to check new factors**

Replace the entire `scoreMetaTags` function in `packages/scoring/src/dimensions/meta-tags.ts`:

```typescript
import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";
import { THRESHOLDS } from "../thresholds";

export function scoreMetaTags(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // MISSING_TITLE
  if (
    !page.title ||
    page.title.length < THRESHOLDS.title.min ||
    page.title.length > THRESHOLDS.title.max
  ) {
    deduct(s, "MISSING_TITLE", { titleLength: page.title?.length ?? 0 });
  }

  // MISSING_META_DESC
  if (
    !page.metaDescription ||
    page.metaDescription.length < THRESHOLDS.metaDesc.min ||
    page.metaDescription.length > THRESHOLDS.metaDesc.max
  ) {
    deduct(s, "MISSING_META_DESC", {
      descLength: page.metaDescription?.length ?? 0,
    });
  }

  // MISSING_OG_TAGS
  const ogTags = page.extracted.og_tags ?? {};
  if (!ogTags["og:title"] || !ogTags["og:description"] || !ogTags["og:image"]) {
    deduct(s, "MISSING_OG_TAGS");
  }

  // OG_TITLE_MISMATCH — og:title vs <title> significantly different
  if (ogTags["og:title"] && page.title) {
    const ratio = levenshteinRatio(ogTags["og:title"], page.title);
    if (ratio > THRESHOLDS.ogTitleMaxLevenshteinRatio) {
      deduct(s, "OG_TITLE_MISMATCH", {
        ogTitle: ogTags["og:title"],
        pageTitle: page.title,
        differenceRatio: Math.round(ratio * 100),
      });
    }
  }

  // OG_DESC_TOO_SHORT
  const ogDesc = ogTags["og:description"];
  if (
    ogDesc &&
    (ogDesc.length < THRESHOLDS.ogDescMin ||
      ogDesc.length > THRESHOLDS.ogDescMax)
  ) {
    deduct(s, "OG_DESC_TOO_SHORT", { ogDescLength: ogDesc.length });
  }

  // OG_IMAGE_MISSING_OR_BROKEN — check og_image_meta if available
  const ogImageMeta = (page.extracted as any).og_image_meta as
    | { width: number; height: number; status_code: number }
    | undefined;
  if (ogTags["og:image"] && ogImageMeta) {
    if (
      ogImageMeta.status_code >= 400 ||
      ogImageMeta.width < THRESHOLDS.ogImageMinWidth ||
      ogImageMeta.height < THRESHOLDS.ogImageMinHeight
    ) {
      deduct(s, "OG_IMAGE_MISSING_OR_BROKEN", {
        statusCode: ogImageMeta.status_code,
        width: ogImageMeta.width,
        height: ogImageMeta.height,
      });
    } else {
      // OG_IMAGE_BAD_RATIO — only check if image is otherwise valid
      const ratio = ogImageMeta.width / ogImageMeta.height;
      if (
        Math.abs(ratio - THRESHOLDS.ogImageIdealRatio) >
        THRESHOLDS.ogImageRatioTolerance
      ) {
        deduct(s, "OG_IMAGE_BAD_RATIO", {
          actualRatio: Math.round(ratio * 100) / 100,
          idealRatio: THRESHOLDS.ogImageIdealRatio,
        });
      }
    }
  }

  // OG_URL_MISMATCH
  const ogUrl = ogTags["og:url"];
  if (ogUrl && page.canonicalUrl) {
    const normalizedOg = ogUrl.replace(/\/+$/, "").toLowerCase();
    const normalizedCanonical = page.canonicalUrl
      .replace(/\/+$/, "")
      .toLowerCase();
    if (normalizedOg !== normalizedCanonical) {
      deduct(s, "OG_URL_MISMATCH", {
        ogUrl,
        canonicalUrl: page.canonicalUrl,
      });
    }
  }

  // MISSING_CANONICAL
  if (!page.canonicalUrl) {
    deduct(s, "MISSING_CANONICAL");
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}

/** Levenshtein distance ratio (0 = identical, 1 = completely different) */
function levenshteinRatio(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 0;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= la.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lb.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= la.length; i++) {
    for (let j = 1; j <= lb.length; j++) {
      const cost = la[i - 1] === lb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[la.length][lb.length] / maxLen;
}
```

**Step 3: Run scoring tests**

Run: `pnpm --filter @llm-boost/scoring test`
Expected: All existing tests pass. The new factors only trigger when OG data is present.

**Step 4: Commit**

```bash
git add packages/scoring/src/dimensions/meta-tags.ts packages/scoring/src/thresholds.ts
git commit -m "feat(scoring): add 5 OG health scoring factors (title mismatch, desc length, image validation, URL mismatch)"
```

---

### Task 3: Add OG Health Scoring Tests

**Files:**

- Create: `packages/scoring/src/__tests__/og-health.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { scoreMetaTags } from "../dimensions/meta-tags";
import type { PageData } from "../types";

function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/page",
    statusCode: 200,
    title: "Example Page Title Here For Testing",
    metaDescription:
      "A valid meta description that is between 120 and 160 characters long, providing enough context for search engines to display.",
    canonicalUrl: "https://example.com/page",
    wordCount: 500,
    contentHash: "abc123",
    extracted: {
      h1: ["Main Heading"],
      h2: [],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: [],
      internal_links: [],
      external_links: [],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {
        "og:title": "Example Page Title Here For Testing",
        "og:description":
          "A compelling social description for this page that drives clicks and engagement.",
        "og:image": "https://example.com/image.jpg",
        "og:url": "https://example.com/page",
      },
      ...overrides.extracted,
    },
    lighthouse: null,
    llmScores: null,
    ...overrides,
  };
}

describe("OG Health Scoring", () => {
  it("scores 100 when all OG tags are correct", () => {
    const result = scoreMetaTags(makePage());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("flags OG_TITLE_MISMATCH when og:title is very different from title", () => {
    const page = makePage({
      title: "SEO Best Practices Guide",
      extracted: {
        ...makePage().extracted,
        og_tags: {
          "og:title": "Buy Our Product Now - Amazing Deals",
          "og:description": "Valid description for social sharing clicks.",
          "og:image": "https://example.com/image.jpg",
          "og:url": "https://example.com/page",
        },
      },
    });
    const result = scoreMetaTags(page);
    const issue = result.issues.find((i) => i.code === "OG_TITLE_MISMATCH");
    expect(issue).toBeDefined();
  });

  it("does not flag OG_TITLE_MISMATCH when titles are similar", () => {
    const page = makePage({
      title: "SEO Best Practices Guide",
      extracted: {
        ...makePage().extracted,
        og_tags: {
          "og:title": "SEO Best Practices Guide | LLM Boost",
          "og:description": "Valid description for social sharing clicks.",
          "og:image": "https://example.com/image.jpg",
          "og:url": "https://example.com/page",
        },
      },
    });
    const result = scoreMetaTags(page);
    const issue = result.issues.find((i) => i.code === "OG_TITLE_MISMATCH");
    expect(issue).toBeUndefined();
  });

  it("flags OG_DESC_TOO_SHORT when under 55 chars", () => {
    const page = makePage({
      extracted: {
        ...makePage().extracted,
        og_tags: {
          "og:title": "Example Page Title Here For Testing",
          "og:description": "Too short",
          "og:image": "https://example.com/image.jpg",
          "og:url": "https://example.com/page",
        },
      },
    });
    const result = scoreMetaTags(page);
    expect(
      result.issues.find((i) => i.code === "OG_DESC_TOO_SHORT"),
    ).toBeDefined();
  });

  it("flags OG_URL_MISMATCH when og:url differs from canonical", () => {
    const page = makePage({
      canonicalUrl: "https://example.com/page",
      extracted: {
        ...makePage().extracted,
        og_tags: {
          "og:title": "Example Page Title Here For Testing",
          "og:description": "Valid description for social sharing clicks.",
          "og:image": "https://example.com/image.jpg",
          "og:url": "https://example.com/different-page",
        },
      },
    });
    const result = scoreMetaTags(page);
    expect(
      result.issues.find((i) => i.code === "OG_URL_MISMATCH"),
    ).toBeDefined();
  });

  it("flags OG_IMAGE_MISSING_OR_BROKEN when image status is 404", () => {
    const page = makePage({
      extracted: {
        ...makePage().extracted,
        og_tags: {
          "og:title": "Example Page Title Here For Testing",
          "og:description": "Valid description for social sharing clicks.",
          "og:image": "https://example.com/missing.jpg",
          "og:url": "https://example.com/page",
        },
        og_image_meta: {
          width: 0,
          height: 0,
          status_code: 404,
          content_type: "",
        },
      } as any,
    });
    const result = scoreMetaTags(page);
    expect(
      result.issues.find((i) => i.code === "OG_IMAGE_MISSING_OR_BROKEN"),
    ).toBeDefined();
  });

  it("flags OG_IMAGE_BAD_RATIO when aspect ratio is wrong", () => {
    const page = makePage({
      extracted: {
        ...makePage().extracted,
        og_tags: {
          "og:title": "Example Page Title Here For Testing",
          "og:description": "Valid description for social sharing clicks.",
          "og:image": "https://example.com/square.jpg",
          "og:url": "https://example.com/page",
        },
        og_image_meta: {
          width: 500,
          height: 500,
          status_code: 200,
          content_type: "image/jpeg",
        },
      } as any,
    });
    const result = scoreMetaTags(page);
    expect(
      result.issues.find((i) => i.code === "OG_IMAGE_BAD_RATIO"),
    ).toBeDefined();
  });
});
```

**Step 2: Run the test**

Run: `pnpm --filter @llm-boost/scoring test -- --grep "OG Health"`
Expected: All 7 tests pass.

**Step 3: Commit**

```bash
git add packages/scoring/src/__tests__/og-health.test.ts
git commit -m "test(scoring): add OG health scoring tests (7 cases)"
```

---

### Task 4: Add `meta_ai_analyses` DB Table + Queries

**Files:**

- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/queries/meta-ai-analyses.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Add table to schema**

After `discoveredLinks` table (around line 512) in `packages/db/src/schema.ts`, add:

```typescript
// ---------------------------------------------------------------------------
// Meta AI Analyses (project-level readiness scorecard)
// ---------------------------------------------------------------------------

export const metaAiAnalyses = pgTable(
  "meta_ai_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    overallScore: integer("overall_score").notNull(),
    grade: varchar("grade", { length: 2 }).notNull(),
    dimensionScores: jsonb("dimension_scores").notNull(),
    recommendations: jsonb("recommendations").notNull(),
    socialProfiles: jsonb("social_profiles").notNull(),
    consistencyAnalysis: jsonb("consistency_analysis"),
    analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
  },
  (t) => [index("idx_meta_ai_analyses_project").on(t.projectId, t.analyzedAt)],
);
```

**Step 2: Create query builders**

Create `packages/db/src/queries/meta-ai-analyses.ts`:

```typescript
import { eq, desc } from "drizzle-orm";
import { metaAiAnalyses } from "../schema";
import type { Database } from "../client";

export interface MetaAiAnalysisInsert {
  projectId: string;
  overallScore: number;
  grade: string;
  dimensionScores: Record<string, number>;
  recommendations: Array<{
    title: string;
    description: string;
    priority: string;
  }>;
  socialProfiles: Array<{ platform: string; url: string; handle: string }>;
  consistencyAnalysis?: {
    score: number;
    mismatches: string[];
    recommendedCopy: Record<string, string>;
  } | null;
}

export function metaAiAnalysisQueries(db: Database) {
  return {
    async insert(data: MetaAiAnalysisInsert) {
      const [row] = await db.insert(metaAiAnalyses).values(data).returning();
      return row;
    },

    async getLatest(projectId: string) {
      const [row] = await db
        .select()
        .from(metaAiAnalyses)
        .where(eq(metaAiAnalyses.projectId, projectId))
        .orderBy(desc(metaAiAnalyses.analyzedAt))
        .limit(1);
      return row ?? null;
    },
  };
}
```

**Step 3: Export from `packages/db/src/index.ts`**

Add after the `discoveredLinkQueries` export:

```typescript
export {
  metaAiAnalysisQueries,
  type MetaAiAnalysisInsert,
} from "./queries/meta-ai-analyses";
```

**Step 4: Push schema to dev database**

Run: `cd packages/db && npx drizzle-kit push`
Expected: Schema pushed with new `meta_ai_analyses` table.

**Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/queries/meta-ai-analyses.ts packages/db/src/index.ts
git commit -m "feat(db): add meta_ai_analyses table and query builders"
```

---

### Task 5: Add Social Profile Detection Utility

**Files:**

- Create: `packages/scoring/src/social-profiles.ts`
- Create: `packages/scoring/src/__tests__/social-profiles.test.ts`

**Step 1: Create the detection utility**

Create `packages/scoring/src/social-profiles.ts`:

```typescript
export interface SocialProfile {
  platform: string;
  url: string;
  handle: string;
}

const SOCIAL_PATTERNS: Array<{
  platform: string;
  patterns: RegExp[];
  extractHandle: (url: URL) => string;
}> = [
  {
    platform: "facebook",
    patterns: [/^(www\.)?facebook\.com$/i, /^(www\.)?fb\.com$/i],
    extractHandle: (url) => url.pathname.replace(/^\//, "").split("/")[0] || "",
  },
  {
    platform: "instagram",
    patterns: [/^(www\.)?instagram\.com$/i],
    extractHandle: (url) => url.pathname.replace(/^\//, "").split("/")[0] || "",
  },
  {
    platform: "twitter",
    patterns: [/^(www\.)?twitter\.com$/i, /^(www\.)?x\.com$/i],
    extractHandle: (url) => url.pathname.replace(/^\//, "").split("/")[0] || "",
  },
  {
    platform: "linkedin",
    patterns: [/^(www\.)?linkedin\.com$/i],
    extractHandle: (url) => {
      const parts = url.pathname.replace(/^\//, "").split("/");
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0] || "";
    },
  },
  {
    platform: "youtube",
    patterns: [/^(www\.)?youtube\.com$/i],
    extractHandle: (url) => {
      const path = url.pathname.replace(/^\//, "");
      if (path.startsWith("@")) return path.split("/")[0];
      if (path.startsWith("channel/") || path.startsWith("c/"))
        return path.split("/").slice(0, 2).join("/");
      return path.split("/")[0] || "";
    },
  },
  {
    platform: "tiktok",
    patterns: [/^(www\.)?tiktok\.com$/i],
    extractHandle: (url) => url.pathname.replace(/^\//, "").split("/")[0] || "",
  },
];

/**
 * Detect social media profiles from a list of external link URLs.
 * Deduplicates by platform + handle.
 */
export function detectSocialProfiles(externalLinks: string[]): SocialProfile[] {
  const seen = new Set<string>();
  const profiles: SocialProfile[] = [];

  for (const link of externalLinks) {
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      continue;
    }

    for (const { platform, patterns, extractHandle } of SOCIAL_PATTERNS) {
      if (patterns.some((p) => p.test(parsed.hostname))) {
        const handle = extractHandle(parsed);
        // Skip non-profile URLs (e.g., facebook.com/sharer, login pages)
        if (
          !handle ||
          handle === "sharer" ||
          handle === "login" ||
          handle === "share" ||
          handle === "intent"
        ) {
          continue;
        }
        const key = `${platform}:${handle.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          profiles.push({ platform, url: link, handle });
        }
        break;
      }
    }
  }

  return profiles;
}

/** Check which major platforms are missing from detected profiles. */
export function findMissingSocialPlatforms(
  profiles: SocialProfile[],
): string[] {
  const detected = new Set(profiles.map((p) => p.platform));
  const important = ["facebook", "instagram", "linkedin"];
  return important.filter((p) => !detected.has(p));
}
```

**Step 2: Write tests**

Create `packages/scoring/src/__tests__/social-profiles.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  detectSocialProfiles,
  findMissingSocialPlatforms,
} from "../social-profiles";

describe("detectSocialProfiles", () => {
  it("detects Facebook, Instagram, Twitter profiles", () => {
    const links = [
      "https://facebook.com/mybrand",
      "https://www.instagram.com/mybrand",
      "https://x.com/mybrand",
      "https://example.com/unrelated",
    ];
    const profiles = detectSocialProfiles(links);
    expect(profiles).toHaveLength(3);
    expect(profiles.map((p) => p.platform)).toEqual([
      "facebook",
      "instagram",
      "twitter",
    ]);
  });

  it("deduplicates same platform + handle", () => {
    const links = [
      "https://facebook.com/mybrand",
      "https://www.facebook.com/mybrand",
      "https://fb.com/mybrand",
    ];
    const profiles = detectSocialProfiles(links);
    expect(profiles).toHaveLength(1);
  });

  it("skips sharer/login/share URLs", () => {
    const links = [
      "https://facebook.com/sharer",
      "https://twitter.com/intent",
      "https://facebook.com/share",
    ];
    const profiles = detectSocialProfiles(links);
    expect(profiles).toHaveLength(0);
  });

  it("extracts LinkedIn company slugs", () => {
    const links = ["https://linkedin.com/company/mybrand"];
    const profiles = detectSocialProfiles(links);
    expect(profiles[0].handle).toBe("company/mybrand");
  });

  it("extracts YouTube @ handles", () => {
    const links = ["https://youtube.com/@mybrand"];
    const profiles = detectSocialProfiles(links);
    expect(profiles[0].handle).toBe("@mybrand");
  });
});

describe("findMissingSocialPlatforms", () => {
  it("reports missing Facebook and LinkedIn", () => {
    const profiles = [{ platform: "instagram", url: "", handle: "me" }];
    const missing = findMissingSocialPlatforms(profiles);
    expect(missing).toContain("facebook");
    expect(missing).toContain("linkedin");
    expect(missing).not.toContain("instagram");
  });
});
```

**Step 3: Run tests**

Run: `pnpm --filter @llm-boost/scoring test -- --grep "social"`
Expected: All 6 tests pass.

**Step 4: Export from index**

Add to `packages/scoring/src/index.ts`:

```typescript
export {
  detectSocialProfiles,
  findMissingSocialPlatforms,
  type SocialProfile,
} from "./social-profiles";
```

**Step 5: Commit**

```bash
git add packages/scoring/src/social-profiles.ts packages/scoring/src/__tests__/social-profiles.test.ts packages/scoring/src/index.ts
git commit -m "feat(scoring): add social profile detection utility with 6 tests"
```

---

### Task 6: Add Meta AI Readiness LLM Prompt

**Files:**

- Create: `packages/llm/src/meta-ai-scorer.ts`
- Modify: `packages/llm/src/index.ts`

**Step 1: Create the scorer**

Create `packages/llm/src/meta-ai-scorer.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { LLM_MODELS } from "./llm-config";

export interface MetaAiScorecardInput {
  domain: string;
  /** Condensed site data: titles, descriptions, H1s, schema types, external links */
  pages: Array<{
    url: string;
    title: string | null;
    metaDescription: string | null;
    h1: string[];
    schemaTypes: string[];
  }>;
  schemaTypesAcrossSite: string[];
  socialProfiles: Array<{ platform: string; handle: string }>;
  brandName: string | null;
  brandDescription: string | null;
}

export interface MetaAiScorecardResult {
  topicalClarity: number;
  entityDefinition: number;
  faqContent: number;
  citeability: number;
  socialSignals: number;
  recommendations: Array<{
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }>;
  consistencyAnalysis: {
    score: number;
    mismatches: string[];
    recommendedCopy: Record<string, string>;
  };
}

export async function analyzeMetaAiReadiness(
  apiKey: string,
  input: MetaAiScorecardInput,
): Promise<MetaAiScorecardResult> {
  const client = new Anthropic({ apiKey });

  const pageSummary = input.pages
    .slice(0, 50)
    .map(
      (p) =>
        `- ${p.url}: title="${p.title ?? "none"}", h1=[${p.h1.join(", ")}], schema=[${p.schemaTypes.join(", ")}]`,
    )
    .join("\n");

  const socialSummary =
    input.socialProfiles.length > 0
      ? input.socialProfiles.map((p) => `${p.platform}: ${p.handle}`).join(", ")
      : "No social profiles detected on the site";

  const prompt = `You are an AI visibility analyst evaluating a website's readiness for Meta AI (Facebook/Instagram AI features).

Domain: ${input.domain}
Brand Name: ${input.brandName ?? "Not detected"}
Brand Description: ${input.brandDescription ?? "Not detected"}
Schema types found: ${input.schemaTypesAcrossSite.join(", ") || "none"}
Social profiles linked: ${socialSummary}

Page-level data (up to 50 pages):
${pageSummary}

Evaluate these 5 dimensions (score each 0-100):

1. **Topical Clarity** — Does the site have a clear, focused topic? Or scattered across unrelated subjects?
2. **Entity Definition** — Is the brand/business clearly defined (name, category, location, services) via schema and content?
3. **FAQ & Q&A Content** — Does the site have question-answer structured content? Look for FAQPage schema, H1/H2 headings starting with What/How/Why/When.
4. **Content Citeability** — Is content structured for AI citation? Clear claims, authoritative tone, well-organized headings.
5. **Social Presence Signals** — Are Facebook/Instagram profiles present and linked? Are other major platforms covered?

Also evaluate messaging consistency: does the brand name, description, and positioning on the website align well enough that social profile bios should mirror it?

Return ONLY valid JSON (no markdown, no explanation) matching this structure:
{
  "topicalClarity": <0-100>,
  "entityDefinition": <0-100>,
  "faqContent": <0-100>,
  "citeability": <0-100>,
  "socialSignals": <0-100>,
  "recommendations": [
    { "title": "short title", "description": "actionable recommendation", "priority": "high|medium|low" }
  ],
  "consistencyAnalysis": {
    "score": <0-100>,
    "mismatches": ["description of each mismatch"],
    "recommendedCopy": { "facebook": "recommended bio text", "instagram": "recommended bio text" }
  }
}`;

  const message = await client.messages.create({
    model: LLM_MODELS.scoring,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in response");
    const parsed = JSON.parse(match[0]) as MetaAiScorecardResult;

    // Clamp all scores to 0-100
    const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));
    return {
      topicalClarity: clamp(parsed.topicalClarity),
      entityDefinition: clamp(parsed.entityDefinition),
      faqContent: clamp(parsed.faqContent),
      citeability: clamp(parsed.citeability),
      socialSignals: clamp(parsed.socialSignals),
      recommendations: (parsed.recommendations ?? []).slice(0, 10),
      consistencyAnalysis: parsed.consistencyAnalysis ?? {
        score: 0,
        mismatches: [],
        recommendedCopy: {},
      },
    };
  } catch {
    // Return zeroed scorecard on parse failure
    return {
      topicalClarity: 0,
      entityDefinition: 0,
      faqContent: 0,
      citeability: 0,
      socialSignals: 0,
      recommendations: [
        {
          title: "Analysis failed",
          description: "Could not parse AI response. Please retry.",
          priority: "high",
        },
      ],
      consistencyAnalysis: { score: 0, mismatches: [], recommendedCopy: {} },
    };
  }
}
```

**Step 2: Export from `packages/llm/src/index.ts`**

Add:

```typescript
export {
  analyzeMetaAiReadiness,
  type MetaAiScorecardInput,
  type MetaAiScorecardResult,
} from "./meta-ai-scorer";
```

**Step 3: Verify it builds**

Run: `pnpm --filter @llm-boost/llm build`
Expected: Clean build (or if no build step, `pnpm --filter @llm-boost/llm typecheck` or just move on).

**Step 4: Commit**

```bash
git add packages/llm/src/meta-ai-scorer.ts packages/llm/src/index.ts
git commit -m "feat(llm): add Meta AI readiness scorer (Claude Haiku prompt)"
```

---

### Task 7: Add Meta AI API Routes

**Files:**

- Create: `apps/api/src/routes/meta-ai.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create the route file**

Create `apps/api/src/routes/meta-ai.ts`:

```typescript
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import {
  projectQueries,
  pageQueries,
  scoreQueries,
  metaAiAnalysisQueries,
} from "@llm-boost/db";
import {
  detectSocialProfiles,
  findMissingSocialPlatforms,
} from "@llm-boost/scoring";
import { analyzeMetaAiReadiness } from "@llm-boost/llm";
import { ServiceError } from "../services/errors";

export const metaAiRoutes = new Hono<AppEnv>();

metaAiRoutes.use("/*", authMiddleware);

// ---------------------------------------------------------------------------
// POST /:projectId/analyze — Trigger Meta AI readiness analysis
// ---------------------------------------------------------------------------

metaAiRoutes.post("/:projectId/analyze", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    throw new ServiceError("NOT_FOUND", 404, "Project not found");
  }

  // Get latest crawl pages with scores
  const latestCrawl = await projectQueries(db).getLatestCrawl(projectId);
  if (!latestCrawl) {
    throw new ServiceError(
      "NO_DATA",
      400,
      "No crawl data available. Run a crawl first.",
    );
  }

  const pagesWithScores = await scoreQueries(db).listByJob(latestCrawl.id);

  // Gather page-level data for the prompt
  const pageData = pagesWithScores.slice(0, 50).map((p: any) => ({
    url: p.url ?? "",
    title: p.title ?? null,
    metaDescription: p.metaDesc ?? null,
    h1: p.detail?.extracted?.h1 ?? [],
    schemaTypes: p.detail?.extracted?.schema_types ?? [],
  }));

  // Collect all external links across pages for social detection
  const allExternalLinks: string[] = [];
  for (const p of pagesWithScores) {
    const detail = (p as any).detail;
    if (detail?.extracted?.external_links) {
      allExternalLinks.push(...detail.extracted.external_links);
    }
  }

  const socialProfiles = detectSocialProfiles(allExternalLinks);

  // Infer brand name from og:site_name or schema Organization
  let brandName: string | null = null;
  let brandDescription: string | null = null;
  for (const p of pagesWithScores) {
    const detail = (p as any).detail;
    const ogTags = detail?.extracted?.og_tags;
    if (ogTags?.["og:site_name"] && !brandName) {
      brandName = ogTags["og:site_name"];
    }
    const schemas = detail?.extracted?.structured_data ?? [];
    for (const schema of schemas) {
      if (typeof schema === "object" && schema !== null) {
        const s = schema as Record<string, unknown>;
        if (
          (s["@type"] === "Organization" || s["@type"] === "LocalBusiness") &&
          s["name"]
        ) {
          brandName = brandName ?? String(s["name"]);
          if (s["description"]) brandDescription = String(s["description"]);
        }
      }
    }
  }

  // Collect schema types across site
  const schemaTypesAcrossSite = [
    ...new Set(pageData.flatMap((p) => p.schemaTypes)),
  ];

  // Run Claude analysis
  const scorecard = await analyzeMetaAiReadiness(c.env.ANTHROPIC_API_KEY, {
    domain: project.domain,
    pages: pageData,
    schemaTypesAcrossSite,
    socialProfiles: socialProfiles.map((p) => ({
      platform: p.platform,
      handle: p.handle,
    })),
    brandName,
    brandDescription,
  });

  // Compute overall score
  const overall = Math.round(
    (scorecard.topicalClarity +
      scorecard.entityDefinition +
      scorecard.faqContent +
      scorecard.citeability +
      scorecard.socialSignals) /
      5,
  );
  const grade =
    overall >= 90
      ? "A"
      : overall >= 80
        ? "B"
        : overall >= 70
          ? "C"
          : overall >= 60
            ? "D"
            : "F";

  // Store result
  const queries = metaAiAnalysisQueries(db);
  const analysis = await queries.insert({
    projectId,
    overallScore: overall,
    grade,
    dimensionScores: {
      topicalClarity: scorecard.topicalClarity,
      entityDefinition: scorecard.entityDefinition,
      faqContent: scorecard.faqContent,
      citeability: scorecard.citeability,
      socialSignals: scorecard.socialSignals,
    },
    recommendations: scorecard.recommendations,
    socialProfiles,
    consistencyAnalysis: scorecard.consistencyAnalysis,
  });

  return c.json({ data: analysis });
});

// ---------------------------------------------------------------------------
// GET /:projectId/latest — Return latest analysis
// ---------------------------------------------------------------------------

metaAiRoutes.get("/:projectId/latest", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    throw new ServiceError("NOT_FOUND", 404, "Project not found");
  }

  const queries = metaAiAnalysisQueries(db);
  const analysis = await queries.getLatest(projectId);

  return c.json({ data: analysis });
});

// ---------------------------------------------------------------------------
// GET /:projectId/og-issues — Aggregate OG issues from latest crawl
// ---------------------------------------------------------------------------

metaAiRoutes.get("/:projectId/og-issues", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("projectId");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    throw new ServiceError("NOT_FOUND", 404, "Project not found");
  }

  const latestCrawl = await projectQueries(db).getLatestCrawl(projectId);
  if (!latestCrawl) {
    return c.json({
      data: { issues: [], totalPages: 0, pagesWithOgIssues: 0 },
    });
  }

  // Fetch issues for this crawl that are OG-related
  const { issueQueries } = await import("@llm-boost/db");
  const allIssues = await issueQueries(db).listByJob(latestCrawl.id);

  const ogCodes = [
    "MISSING_OG_TAGS",
    "OG_TITLE_MISMATCH",
    "OG_DESC_TOO_SHORT",
    "OG_IMAGE_MISSING_OR_BROKEN",
    "OG_IMAGE_BAD_RATIO",
    "OG_URL_MISMATCH",
  ];

  const ogIssues = allIssues.filter((i: any) => ogCodes.includes(i.code));
  const pagesWithOgIssues = new Set(ogIssues.map((i: any) => i.pageId)).size;

  return c.json({
    data: {
      issues: ogIssues.slice(0, 100),
      totalPages: latestCrawl.pagesCrawled ?? 0,
      pagesWithOgIssues,
    },
  });
});
```

**Step 2: Mount routes in `apps/api/src/index.ts`**

Add import:

```typescript
import { metaAiRoutes } from "./routes/meta-ai";
```

Mount (near the backlinks route mounting):

```typescript
app.route("/api/meta-ai", metaAiRoutes);
```

**Step 3: Verify API builds**

Run: `pnpm --filter api typecheck`
Expected: Clean (may need to adjust types based on actual query return shapes).

**Step 4: Commit**

```bash
git add apps/api/src/routes/meta-ai.ts apps/api/src/index.ts
git commit -m "feat(api): add Meta AI analysis routes (analyze, latest, og-issues)"
```

---

### Task 8: Add API Client Methods

**Files:**

- Modify: `apps/web/src/lib/api.ts`

**Step 1: Add Meta AI types and client methods**

At the end of the `api` object, before the closing `}`, add a `metaAi` namespace:

```typescript
  metaAi: {
    async analyze(projectId: string) {
      const res = await fetchApi<{
        data: {
          id: string;
          overallScore: number;
          grade: string;
          dimensionScores: Record<string, number>;
          recommendations: Array<{ title: string; description: string; priority: string }>;
          socialProfiles: Array<{ platform: string; url: string; handle: string }>;
          consistencyAnalysis: {
            score: number;
            mismatches: string[];
            recommendedCopy: Record<string, string>;
          } | null;
          analyzedAt: string;
        };
      }>(`/api/meta-ai/${projectId}/analyze`, { method: "POST" });
      return res.data;
    },

    async getLatest(projectId: string) {
      const res = await fetchApi<{
        data: {
          id: string;
          overallScore: number;
          grade: string;
          dimensionScores: Record<string, number>;
          recommendations: Array<{ title: string; description: string; priority: string }>;
          socialProfiles: Array<{ platform: string; url: string; handle: string }>;
          consistencyAnalysis: {
            score: number;
            mismatches: string[];
            recommendedCopy: Record<string, string>;
          } | null;
          analyzedAt: string;
        } | null;
      }>(`/api/meta-ai/${projectId}/latest`);
      return res.data;
    },

    async getOgIssues(projectId: string) {
      const res = await fetchApi<{
        data: {
          issues: Array<{
            id: string;
            code: string;
            severity: string;
            message: string;
            recommendation: string;
            data: Record<string, unknown>;
            pageId: string;
          }>;
          totalPages: number;
          pagesWithOgIssues: number;
        };
      }>(`/api/meta-ai/${projectId}/og-issues`);
      return res.data;
    },
  },
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add Meta AI API client methods"
```

---

### Task 9: Build Meta & Social Tab UI

**Files:**

- Create: `apps/web/src/components/tabs/meta-social-tab.tsx`
- Modify: `apps/web/src/app/dashboard/projects/[id]/page.tsx`

**Step 1: Create the tab component**

Create `apps/web/src/components/tabs/meta-social-tab.tsx`:

```typescript
"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";
import {
  Share2,
  ExternalLink,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-500/10 text-green-700 border-green-500/20",
  B: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  C: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  D: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  F: "bg-red-500/10 text-red-700 border-red-500/20",
};

const DIMENSION_LABELS: Record<string, string> = {
  topicalClarity: "Topical Clarity",
  entityDefinition: "Entity Definition",
  faqContent: "FAQ & Q&A Content",
  citeability: "Content Citeability",
  socialSignals: "Social Presence Signals",
};

const PLATFORM_ICONS: Record<string, string> = {
  facebook: "FB",
  instagram: "IG",
  twitter: "X",
  linkedin: "LI",
  youtube: "YT",
  tiktok: "TT",
};

export default function MetaSocialTab({ projectId }: { projectId: string }) {
  const { withAuth } = useApi();
  const [analyzing, setAnalyzing] = useState(false);

  const {
    data: analysis,
    isLoading: analysisLoading,
    mutate: mutateAnalysis,
  } = useApiSWR(
    `meta-ai-${projectId}`,
    useCallback(() => api.metaAi.getLatest(projectId), [projectId]),
  );

  const { data: ogIssues, isLoading: ogLoading } = useApiSWR(
    `og-issues-${projectId}`,
    useCallback(() => api.metaAi.getOgIssues(projectId), [projectId]),
  );

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      await withAuth(async () => {
        const result = await api.metaAi.analyze(projectId);
        mutateAnalysis(result);
      });
    } catch {
      // Error handled by withAuth toast
    } finally {
      setAnalyzing(false);
    }
  }

  const ogPassRate =
    ogIssues && ogIssues.totalPages > 0
      ? Math.round(
          ((ogIssues.totalPages - ogIssues.pagesWithOgIssues) /
            ogIssues.totalPages) *
            100,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Row 1: Score + OG Summary + Social Profiles */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Meta AI Readiness Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-4 w-4" />
              Meta AI Readiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysisLoading ? (
              <div className="h-20 animate-pulse rounded bg-muted" />
            ) : analysis ? (
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary/20">
                    <span className="text-xl font-bold">
                      {analysis.overallScore}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={GRADE_COLORS[analysis.grade] ?? ""}
                  >
                    Grade {analysis.grade}
                  </Badge>
                </div>
                <div className="flex-1 text-sm text-muted-foreground">
                  <p>
                    Analyzed{" "}
                    {new Date(analysis.analyzedAt).toLocaleDateString()}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                  >
                    {analyzing ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3" />
                    )}
                    Re-analyze
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Run an analysis to see your Meta AI readiness score.
                </p>
                <Button
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {analyzing ? "Analyzing..." : "Analyze Readiness"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OG Health Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">OG Health</CardTitle>
          </CardHeader>
          <CardContent>
            {ogLoading ? (
              <div className="h-12 animate-pulse rounded bg-muted" />
            ) : ogIssues ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{ogPassRate}%</span>
                  <span className="text-sm text-muted-foreground">
                    pages pass
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ogIssues.pagesWithOgIssues} of {ogIssues.totalPages} pages
                  have OG issues
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Run a crawl to check OG tag health.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Social Profiles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Social Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            {analysis ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {analysis.socialProfiles.map((p) => (
                    <Badge key={`${p.platform}-${p.handle}`} variant="default" className="text-xs">
                      <Check className="mr-1 h-3 w-3" />
                      {PLATFORM_ICONS[p.platform] ?? p.platform}
                    </Badge>
                  ))}
                </div>
                {analysis.socialProfiles.length === 0 && (
                  <p className="text-sm text-amber-600">
                    No social profiles detected on your site. Add links to
                    Facebook, Instagram, and LinkedIn in your footer.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Run analysis to detect social profiles.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: OG Issues Table + Entity Consistency */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* OG Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">OG Issues</CardTitle>
          </CardHeader>
          <CardContent>
            {!ogIssues || ogIssues.issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No OG tag issues found. Your social sharing metadata looks
                good.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ogIssues.issues.slice(0, 15).map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell className="text-sm">
                        {issue.message}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            issue.severity === "warning"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {issue.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent((issue.data as any)?.url ?? "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Test in Meta
                          <ExternalLink className="ml-1 inline h-3 w-3" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Entity Consistency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Entity Consistency
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!analysis?.consistencyAnalysis ? (
              <p className="text-sm text-muted-foreground">
                Run analysis to check entity consistency.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">
                    {analysis.consistencyAnalysis.score}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    / 100 consistency
                  </span>
                </div>
                {analysis.consistencyAnalysis.mismatches.length > 0 && (
                  <div className="space-y-1.5">
                    {analysis.consistencyAnalysis.mismatches.map(
                      (m, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50/50 p-2 text-xs dark:border-amber-900 dark:bg-amber-950/20"
                        >
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                          {m}
                        </div>
                      ),
                    )}
                  </div>
                )}
                {Object.keys(
                  analysis.consistencyAnalysis.recommendedCopy,
                ).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      Recommended Bios
                    </h4>
                    {Object.entries(
                      analysis.consistencyAnalysis.recommendedCopy,
                    ).map(([platform, copy]) => (
                      <div key={platform} className="rounded border p-2">
                        <p className="text-xs font-medium capitalize">
                          {platform}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {copy}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Readiness Breakdown */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Meta AI Readiness Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Dimension bars */}
              <div className="space-y-3">
                {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
                  const value =
                    (analysis.dimensionScores as Record<string, number>)[
                      key
                    ] ?? 0;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}/100</span>
                      </div>
                      <Progress value={value} className="h-1.5" />
                    </div>
                  );
                })}
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recommendations</h4>
                {analysis.recommendations.slice(0, 6).map((rec, i) => (
                  <div
                    key={i}
                    className="rounded border p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          rec.priority === "high"
                            ? "destructive"
                            : rec.priority === "medium"
                              ? "default"
                              : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {rec.priority}
                      </Badge>
                      <span className="text-sm font-medium">{rec.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rec.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Register the tab in the dashboard**

In `apps/web/src/app/dashboard/projects/[id]/page.tsx`:

Add `Share2` to the lucide-react imports (line 22):

```typescript
import {
  ArrowLeft,
  Play,
  BarChart3,
  FileText,
  Bug,
  History,
  Eye,
  Plug,
  Compass,
  Trophy,
  Settings,
  Download,
  AlertTriangle,
  Radar,
  Share2,
} from "lucide-react";
```

Add the dynamic import (after `AIVisibilityTab`, around line 134):

```typescript
const MetaSocialTab = dynamic(
  () => import("@/components/tabs/meta-social-tab"),
  {
    loading: () => <TabLoadingSkeleton />,
  },
);
```

Add the TabsTrigger (after "AI Visibility", around line 289):

```typescript
          <TabsTrigger value="meta-social">
            <Share2 className="mr-1.5 h-4 w-4" />
            Meta & Social
          </TabsTrigger>
```

Add the TabsContent (after the ai-visibility content, around line 354):

```typescript
        <TabsContent value="meta-social" className="space-y-6 pt-4">
          <TabErrorBoundary>
            <MetaSocialTab projectId={project.id} />
          </TabErrorBoundary>
        </TabsContent>
```

**Step 3: Verify it builds**

Run: `pnpm --filter web typecheck`
Expected: Clean (or fixable type issues).

**Step 4: Commit**

```bash
git add apps/web/src/components/tabs/meta-social-tab.tsx apps/web/src/app/dashboard/projects/[id]/page.tsx
git commit -m "feat(web): add Meta & Social tab with readiness score, OG health, social profiles, and entity consistency"
```

---

### Task 10: Add "Test in Meta" Button to Page Detail

**Files:**

- Modify: `apps/web/src/components/page-detail/page-link-graph-section.tsx`

**Step 1: Add a "Test in Meta" button next to the OG Tags card**

In the Open Graph Tags card (around line 49-66), add a button inside the CardHeader:

```typescript
<CardHeader className="flex flex-row items-center justify-between">
  <CardTitle className="text-sm font-medium">Open Graph Tags</CardTitle>
  {pageUrl && (
    <a
      href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(pageUrl)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-primary hover:underline"
    >
      Test in Meta <ExternalLink className="ml-1 inline h-3 w-3" />
    </a>
  )}
</CardHeader>
```

You'll need to pass `pageUrl` as a prop or extract it from the component's existing props. Check the component's props to wire it correctly.

**Step 2: Commit**

```bash
git add apps/web/src/components/page-detail/page-link-graph-section.tsx
git commit -m "feat(web): add 'Test in Meta' debugger link to OG Tags card"
```

---

### Task 11: Typecheck + Full Test Suite

**Files:** None (verification only)

**Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: No new errors (pre-existing `reports.test.ts` error is acceptable).

**Step 2: Run all tests**

Run: `pnpm --filter @llm-boost/shared test && pnpm --filter @llm-boost/scoring test && pnpm --filter api test`
Expected: All new tests pass, no regressions.

**Step 3: Fix any issues found, then commit**

```bash
git add -A && git commit -m "fix: resolve any typecheck or test issues from Meta & Social feature"
```
