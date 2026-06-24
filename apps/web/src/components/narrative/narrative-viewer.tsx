"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, ApiError, type BillingInfo } from "@/lib/api";
import { useProject } from "@/hooks/use-project";
import { useCrawl } from "@/hooks/use-crawl";
import { Brain, Settings2, Sparkles } from "lucide-react";

const NarrativeSectionEditor = dynamic(
  () =>
    import("./narrative-section-editor").then((m) => ({
      default: m.NarrativeSectionEditor,
    })),
  { loading: () => <Skeleton className="h-32 w-full" /> },
);
import type { NarrativeSection } from "@llm-boost/shared";

type NarrativeTone = "technical" | "business";

interface Props {
  crawlJobId: string;
  projectId: string;
}

type AccountMe = {
  isAdmin: boolean;
};

export function NarrativeViewer({ crawlJobId, projectId }: Props) {
  const [tone, setTone] = useState<NarrativeTone>("technical");
  const { toast } = useToast();

  const { data: billing } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );
  const { data: account } = useApiSWR<AccountMe>(
    "account-me",
    useCallback(() => api.account.getMe(), []),
  );
  const { data: project } = useProject(projectId);
  const { data: crawl } = useCrawl(crawlJobId);

  const plan = billing?.plan ?? "free";
  const isAgency = plan === "agency";
  const isPro = plan === "pro" || isAgency;
  const isAdmin = account?.isAdmin ?? false;

  const {
    data: narrative,
    isLoading,
    mutate,
  } = useApiSWR(
    isPro ? `narrative-${crawlJobId}-${tone}` : null,
    useCallback(() => api.narratives.get(crawlJobId, tone), [crawlJobId, tone]),
  );

  const [isGenerating, setIsGenerating] = useState(false);

  const contextBadges = useMemo(() => {
    const siteContext = crawl?.summaryData?.siteContext;
    const blocked = siteContext?.aiCrawlersBlocked ?? [];

    return [
      project?.industry
        ? {
            label: `Industry: ${project.industry}`,
            variant: "secondary" as const,
          }
        : null,
      project?.businessGoal
        ? {
            label: `Goal: ${project.businessGoal.replaceAll("_", " ")}`,
            variant: "secondary" as const,
          }
        : null,
      typeof crawl?.summaryData?.pagesScored === "number"
        ? {
            label: `${crawl.summaryData.pagesScored} pages scored`,
            variant: "outline" as const,
          }
        : null,
      Array.isArray(crawl?.summaryData?.quickWins)
        ? {
            label: `${crawl.summaryData.quickWins.length} quick wins`,
            variant: "outline" as const,
          }
        : null,
      siteContext
        ? {
            label: siteContext.hasLlmsTxt
              ? "LLMs.txt found"
              : "LLMs.txt missing",
            variant: siteContext.hasLlmsTxt
              ? ("default" as const)
              : ("secondary" as const),
          }
        : null,
      siteContext
        ? {
            label: siteContext.hasSitemap ? "Sitemap found" : "Sitemap missing",
            variant: siteContext.hasSitemap
              ? ("default" as const)
              : ("secondary" as const),
          }
        : null,
      blocked.length > 0
        ? {
            label: `${blocked.length} AI crawler blocks`,
            variant: "secondary" as const,
          }
        : null,
    ].filter(Boolean) as Array<{
      label: string;
      variant: "default" | "secondary" | "outline";
    }>;
  }, [crawl, project]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const generated = await api.narratives.generate(crawlJobId, tone);
      await mutate(generated, false);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Failed to generate AI analysis.";
      toast({
        title: "AI analysis failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [crawlJobId, mutate, toast, tone]);

  const handleSectionUpdate = useCallback(
    (updated: NarrativeSection) => {
      if (!narrative) return;
      const newSections = (narrative.sections as NarrativeSection[]).map((s) =>
        s.id === updated.id ? updated : s,
      );
      mutate({ ...narrative, sections: newSections }, false);
    },
    [narrative, mutate],
  );

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border border-dashed p-12 text-center">
        <Brain className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-semibold">AI Analysis requires Pro or Agency</p>
          <p className="text-sm text-muted-foreground">
            Upgrade your plan to unlock AI-generated narrative reports
          </p>
        </div>
        <Button asChild>
          <a href="/dashboard/billing">Upgrade Plan</a>
        </Button>
      </div>
    );
  }

  const sections = (narrative?.sections as NarrativeSection[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Report Context</p>
            </div>
            <p className="text-sm text-muted-foreground">
              AI analysis uses crawl scores, issue inventory, quick wins,
              per-page scoring, crawl site context, previous crawl comparison,
              and saved project context to build the report.
            </p>
            {project?.siteDescription && (
              <p className="text-sm text-muted-foreground">
                {project.siteDescription}
              </p>
            )}
            {contextBadges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {contextBadges.map((badge) => (
                  <Badge key={badge.label} variant={badge.variant}>
                    {badge.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/admin/prompts?category=narrative">
                <Settings2 className="mr-1.5 h-4 w-4" />
                Manage Narrative Prompts
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={tone === "technical" ? "default" : "outline"}
            size="sm"
            onClick={() => setTone("technical")}
          >
            Technical
          </Button>
          <Button
            variant={tone === "business" ? "default" : "outline"}
            size="sm"
            onClick={() => setTone("business")}
          >
            Business
          </Button>
        </div>
        {isAgency && (
          <p className="text-xs text-muted-foreground">
            Agency plan — click any section to edit
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <div className="space-y-4 py-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            No AI analysis generated yet for the{" "}
            <span className="font-medium">{tone}</span> tone.
          </p>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate AI Analysis"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <NarrativeSectionEditor
              key={section.id}
              section={section}
              crawlJobId={crawlJobId}
              tone={tone}
              editable={isAgency}
              onSectionUpdate={handleSectionUpdate}
            />
          ))}
        </div>
      )}

      {narrative && (
        <p className="text-xs text-muted-foreground">
          Generated by {narrative.generatedBy} · v{narrative.version} ·{" "}
          {new Date(narrative.createdAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
