"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PageScoreDetail } from "@/lib/api";
import { AiFixButton } from "@/components/ai-fix-button";

interface PageOptimizationWorkspaceProps {
  page: PageScoreDetail;
  projectId: string;
}

interface OptimizationTask {
  key: string;
  label: string;
  issueCode?: string;
  before: string;
  suggested: string;
  impactScore: number;
  rationale: string;
}

function impactBadge(score: number): "destructive" | "warning" | "secondary" {
  if (score >= 75) return "destructive";
  if (score >= 50) return "warning";
  return "secondary";
}

function toImpactScore(recommendation?: {
  estimatedImprovement?: number;
  priority?: string;
}) {
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

export function PageOptimizationWorkspace({
  page,
  projectId,
}: PageOptimizationWorkspaceProps) {
  const [userOverrides, setUserOverrides] = useState<Record<string, string>>(
    {},
  );
  const [implemented, setImplemented] = useState<Record<string, boolean>>({});
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

  const tasks = useMemo<OptimizationTask[]>(() => {
    const recByIssue = new Map(
      recommendations.map((recommendation) => [
        recommendation.issueCode,
        recommendation,
      ]),
    );

    const titleRec = recByIssue.get("MISSING_TITLE");
    const metaRec = recByIssue.get("MISSING_META_DESC");
    const h1Rec =
      recByIssue.get("BAD_HEADING_HIERARCHY") ?? recByIssue.get("MISSING_H1");
    const schemaRec = recByIssue.get("NO_STRUCTURED_DATA");
    const internalLinkRec =
      recByIssue.get("LOW_INTERNAL_LINKS") ??
      recByIssue.get("ORPHAN_PAGE") ??
      recByIssue.get("POOR_INTERNAL_LINKS");

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
  }, [
    internalLinks,
    issuesByCode,
    page.metaDesc,
    page.title,
    recommendations,
    h1,
  ]);

  const drafts = useMemo(() => {
    const base: Record<string, string> = {};
    for (const task of tasks) {
      base[task.key] = userOverrides[task.key] ?? task.suggested;
    }
    return base;
  }, [tasks, userOverrides]);

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card key={task.key}>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{task.label}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={impactBadge(task.impactScore)}>
                  Impact {Math.round(task.impactScore)}
                </Badge>
                {implemented[task.key] && (
                  <Badge variant="success">Implemented</Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{task.rationale}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Before
                </p>
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  {task.before}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested
                </p>
                <Textarea
                  value={drafts[task.key] ?? ""}
                  onChange={(event) =>
                    setUserOverrides((prev) => ({
                      ...prev,
                      [task.key]: event.target.value,
                    }))
                  }
                  rows={4}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {task.issueCode && (
                <AiFixButton
                  projectId={projectId}
                  pageId={page.id}
                  issueCode={task.issueCode}
                  issueTitle={task.label}
                />
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(drafts[task.key] ?? "")
                    .catch(() => {})
                }
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy Suggested
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  setImplemented((prev) => ({ ...prev, [task.key]: true }))
                }
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Mark Implemented
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
