import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionItem, PageScoreDetail } from "@/lib/api";
import {
  buildActionItemIndex,
  buildOptimizationTasks,
  defaultDueAtIsoBySeverity,
  getActionItemForCode,
  impactBadge,
  toDateInput,
} from "./page-optimization-workspace-helpers";

const page: PageScoreDetail = {
  id: "page-1",
  jobId: "job-1",
  url: "https://example.com/page",
  canonicalUrl: null,
  statusCode: 200,
  title: null,
  metaDesc: null,
  wordCount: 500,
  contentHash: null,
  crawledAt: null,
  score: {
    overallScore: 81,
    technicalScore: 80,
    contentScore: 82,
    aiReadinessScore: 79,
    lighthousePerf: 85,
    lighthouseSeo: 88,
    letterGrade: "B",
    detail: {
      extracted: {
        h1: ["Original H1"],
        internal_links: [{ href: "/a" }, { href: "/b" }],
      },
    },
    platformScores: null,
    recommendations: [
      {
        issueCode: "MISSING_TITLE",
        title: "Add a title",
        description: "Write a concise title",
        priority: "high",
        effort: "low",
        impact: "high",
        estimatedImprovement: 82,
        affectedPlatforms: ["chatgpt"],
        example: { before: "", after: "Better page title" },
      },
      {
        issueCode: "BAD_HEADING_HIERARCHY",
        title: "Fix headings",
        description: "Use one clear H1",
        priority: "medium",
        effort: "low",
        impact: "medium",
        estimatedImprovement: 58,
        affectedPlatforms: ["claude"],
      },
      {
        issueCode: "NO_STRUCTURED_DATA",
        title: "Add schema",
        description: "Add JSON-LD",
        priority: "high",
        effort: "medium",
        impact: "high",
        estimatedImprovement: 77,
        affectedPlatforms: ["gemini"],
      },
      {
        issueCode: "LOW_INTERNAL_LINKS",
        title: "Add internal links",
        description: "Link from related pages",
        priority: "medium",
        effort: "medium",
        impact: "medium",
        estimatedImprovement: 52,
        affectedPlatforms: ["perplexity"],
      },
    ],
  },
  issues: [
    {
      code: "MISSING_TITLE",
      category: "content",
      severity: "critical",
      message: "Title missing",
      recommendation: "Add a title",
    },
    {
      code: "NO_STRUCTURED_DATA",
      category: "ai_readiness",
      severity: "warning",
      message: "Schema missing",
      recommendation: "Add schema",
    },
  ],
};

function makeActionItem(
  overrides: Partial<ActionItem> &
    Pick<ActionItem, "id" | "issueCode" | "status">,
): ActionItem {
  return {
    id: overrides.id,
    projectId: "proj-1",
    pageId: null,
    issueCode: overrides.issueCode,
    status: overrides.status,
    severity: "warning",
    category: "content",
    scoreImpact: 50,
    title: "Task",
    description: null,
    assigneeId: null,
    dueAt: null,
    verifiedAt: null,
    verifiedByCrawlId: null,
    createdAt: "2026-03-09T00:00:00.000Z",
    updatedAt: "2026-03-09T00:00:00.000Z",
    ...overrides,
  };
}

describe("page optimization workspace helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds optimization tasks from page recommendations and extracted detail", () => {
    const tasks = buildOptimizationTasks(page);

    expect(tasks.map((task) => task.key)).toEqual([
      "title",
      "meta",
      "h1",
      "schema",
      "internal_links",
    ]);
    expect(tasks[0]).toMatchObject({
      issueCode: "MISSING_TITLE",
      before: "Missing title",
      suggested: "Better page title",
      impactScore: 82,
    });
    expect(tasks[2]).toMatchObject({
      issueCode: "BAD_HEADING_HIERARCHY",
      before: "Original H1",
      suggested: "Use one clear H1",
    });
    expect(tasks[3]?.before).toBe("Structured data missing.");
    expect(tasks[4]).toMatchObject({
      issueCode: "LOW_INTERNAL_LINKS",
      before: "2 internal links detected.",
    });
  });

  it("prefers page-scoped action items and only falls back to legacy unscoped items", () => {
    const index = buildActionItemIndex([
      makeActionItem({
        id: "scoped-title",
        issueCode: "MISSING_TITLE",
        status: "pending",
        pageId: "page-1",
      }),
      makeActionItem({
        id: "legacy-meta",
        issueCode: "MISSING_META_DESC",
        status: "pending",
      }),
      makeActionItem({
        id: "other-page-h1",
        issueCode: "BAD_HEADING_HIERARCHY",
        status: "in_progress",
        pageId: "page-2",
      }),
    ]);

    expect(getActionItemForCode(index, "MISSING_TITLE", "page-1")?.id).toBe(
      "scoped-title",
    );
    expect(getActionItemForCode(index, "MISSING_META_DESC", "page-1")?.id).toBe(
      "legacy-meta",
    );
    expect(
      getActionItemForCode(index, "BAD_HEADING_HIERARCHY", "page-1"),
    ).toBeUndefined();
  });

  it("formats date inputs, impact badges, and severity-based due dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T10:00:00.000Z"));

    expect(toDateInput("2026-03-18T12:00:00.000Z")).toBe("2026-03-18");
    expect(impactBadge(82)).toBe("destructive");
    expect(impactBadge(55)).toBe("warning");
    expect(impactBadge(20)).toBe("secondary");
    expect(defaultDueAtIsoBySeverity("critical")).toBe(
      "2026-03-12T12:00:00.000Z",
    );
  });
});
