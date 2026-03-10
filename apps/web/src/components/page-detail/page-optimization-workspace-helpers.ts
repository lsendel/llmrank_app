import type { ActionItem, PageIssue, PageScoreDetail } from "@/lib/api";

type Recommendation = NonNullable<
  NonNullable<PageScoreDetail["score"]>["recommendations"]
>[number];

export interface OptimizationTask {
  key: string;
  label: string;
  issueCode?: string;
  before: string;
  suggested: string;
  impactScore: number;
  rationale: string;
}

export type ActionItemIndex = {
  byIssuePage: Map<string, ActionItem>;
  legacyByIssue: Map<string, ActionItem>;
  scopedIssueCodes: Set<string>;
};

export type OptimizationTaskItem = {
  task: OptimizationTask;
  actionItem?: ActionItem;
};

export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function impactBadge(
  score: number,
): "destructive" | "warning" | "secondary" {
  if (score >= 75) return "destructive";
  if (score >= 50) return "warning";
  return "secondary";
}

export function defaultDueAtIsoBySeverity(
  severity: "critical" | "warning" | "info",
): string {
  const daysToAdd =
    severity === "critical" ? 3 : severity === "warning" ? 7 : 14;
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + daysToAdd);
  due.setUTCHours(12, 0, 0, 0);
  return due.toISOString();
}

export function actionItemIdentityKey(
  issueCode: string,
  pageId?: string | null,
) {
  return `${issueCode}::${pageId ?? ""}`;
}

export function buildActionItemIndex(
  actionItems: ActionItem[] | undefined,
): ActionItemIndex {
  const byIssuePage = new Map<string, ActionItem>();
  const legacyByIssue = new Map<string, ActionItem>();
  const scopedIssueCodes = new Set<string>();

  for (const item of actionItems ?? []) {
    if (item.pageId) {
      const key = actionItemIdentityKey(item.issueCode, item.pageId);
      if (!byIssuePage.has(key)) {
        byIssuePage.set(key, item);
      }
      scopedIssueCodes.add(item.issueCode);
      continue;
    }

    if (!legacyByIssue.has(item.issueCode)) {
      legacyByIssue.set(item.issueCode, item);
    }
  }

  return { byIssuePage, legacyByIssue, scopedIssueCodes };
}

export function getActionItemForCode(
  actionItemIndex: ActionItemIndex,
  issueCode: string,
  pageId: string,
): ActionItem | undefined {
  const scoped = actionItemIndex.byIssuePage.get(
    actionItemIdentityKey(issueCode, pageId),
  );
  if (scoped) return scoped;

  if (actionItemIndex.scopedIssueCodes.has(issueCode)) {
    return undefined;
  }

  return actionItemIndex.legacyByIssue.get(issueCode);
}

export function buildPageIssueByCode(
  issues: PageIssue[],
): Map<string, PageIssue> {
  const map = new Map<string, PageIssue>();
  for (const issue of issues) {
    if (!map.has(issue.code)) map.set(issue.code, issue);
  }
  return map;
}

function toImpactScore(recommendation?: Recommendation) {
  if (typeof recommendation?.estimatedImprovement === "number") {
    return Math.max(10, Math.min(95, recommendation.estimatedImprovement));
  }
  if (recommendation?.priority === "high") return 70;
  if (recommendation?.priority === "medium") return 50;
  return 35;
}

function toText(value: unknown, fallback = "Not available"): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return fallback;
}

function pickRecommendation(
  recommendations: Recommendation[],
  issueCodes: string[],
): Recommendation | undefined {
  return recommendations.find((recommendation) =>
    issueCodes.includes(recommendation.issueCode),
  );
}

export function buildOptimizationTasks(
  page: PageScoreDetail,
): OptimizationTask[] {
  const recommendations = page.score?.recommendations ?? [];
  const issuesByCode = new Set(page.issues.map((issue) => issue.code));
  const detail = (page.score?.detail ?? {}) as Record<string, unknown>;
  const extracted = (detail.extracted ?? {}) as Record<string, unknown>;
  const h1 = Array.isArray(extracted.h1)
    ? (extracted.h1[0] as string | undefined)
    : undefined;
  const internalLinks = Array.isArray(extracted.internal_links)
    ? extracted.internal_links.length
    : null;

  const titleRec = pickRecommendation(recommendations, ["MISSING_TITLE"]);
  const metaRec = pickRecommendation(recommendations, ["MISSING_META_DESC"]);
  const h1Rec = pickRecommendation(recommendations, [
    "BAD_HEADING_HIERARCHY",
    "MISSING_H1",
  ]);
  const schemaRec = pickRecommendation(recommendations, ["NO_STRUCTURED_DATA"]);
  const internalLinkRec = pickRecommendation(recommendations, [
    "LOW_INTERNAL_LINKS",
    "ORPHAN_PAGE",
    "POOR_INTERNAL_LINKS",
  ]);

  return [
    {
      key: "title",
      label: "Title Tag",
      issueCode: titleRec ? "MISSING_TITLE" : undefined,
      before: toText(page.title, "Missing title"),
      suggested: toText(
        titleRec?.example?.after ?? titleRec?.description,
        "Keep title under 60 chars and include primary intent phrase.",
      ),
      impactScore: toImpactScore(titleRec),
      rationale: issuesByCode.has("MISSING_TITLE")
        ? "Missing titles reduce click-through and model understanding."
        : "Optimized titles improve discoverability and topic clarity.",
    },
    {
      key: "meta",
      label: "Meta Description",
      issueCode: metaRec ? "MISSING_META_DESC" : undefined,
      before: toText(page.metaDesc, "Missing meta description"),
      suggested: toText(
        metaRec?.example?.after ?? metaRec?.description,
        "Write a 140-160 character summary with a clear value proposition.",
      ),
      impactScore: toImpactScore(metaRec),
      rationale: issuesByCode.has("MISSING_META_DESC")
        ? "Missing descriptions reduce SERP relevance signals."
        : "Stronger descriptions improve click intent matching.",
    },
    {
      key: "h1",
      label: "H1 Structure",
      issueCode: h1Rec?.issueCode,
      before: toText(h1, "No H1 extracted"),
      suggested: toText(
        h1Rec?.example?.after ?? h1Rec?.description,
        "Use one clear H1 that matches page intent and key entity.",
      ),
      impactScore: toImpactScore(h1Rec),
      rationale:
        "Heading hierarchy helps both search engines and LLMs parse page intent.",
    },
    {
      key: "schema",
      label: "Schema Markup",
      issueCode: schemaRec ? "NO_STRUCTURED_DATA" : undefined,
      before: issuesByCode.has("NO_STRUCTURED_DATA")
        ? "Structured data missing."
        : "Structured data detected.",
      suggested: toText(
        schemaRec?.example?.after ?? schemaRec?.description,
        "Add JSON-LD with Organization, WebPage, and relevant content entities.",
      ),
      impactScore: toImpactScore(schemaRec),
      rationale:
        "Schema improves entity comprehension and citation confidence in AI results.",
    },
    {
      key: "internal_links",
      label: "Internal Linking",
      issueCode: internalLinkRec?.issueCode,
      before:
        internalLinks == null
          ? "Internal link count unavailable."
          : `${internalLinks} internal links detected.`,
      suggested: toText(
        internalLinkRec?.example?.after ?? internalLinkRec?.description,
        "Add contextual links from high-authority pages using descriptive anchor text.",
      ),
      impactScore: toImpactScore(internalLinkRec),
      rationale:
        "Internal links distribute topical authority and improve crawl/LLM context paths.",
    },
  ];
}

export function buildOptimizationDrafts(
  tasks: OptimizationTask[],
  userOverrides: Record<string, string>,
): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const task of tasks) {
    drafts[task.key] = userOverrides[task.key] ?? task.suggested;
  }
  return drafts;
}

export function buildOptimizationTaskItems(
  tasks: OptimizationTask[],
  pageId: string,
  actionItemIndex: ActionItemIndex,
): OptimizationTaskItem[] {
  return tasks.map((task) => ({
    task,
    actionItem: task.issueCode
      ? getActionItemForCode(actionItemIndex, task.issueCode, pageId)
      : undefined,
  }));
}
