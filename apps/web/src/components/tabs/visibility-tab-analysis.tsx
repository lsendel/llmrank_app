import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { PlatformReadinessMatrix } from "@/components/platform-readiness-matrix";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { BrandPerformanceDashboard } from "@/components/visibility/brand-performance-dashboard";
import { BrandSentimentCard } from "@/components/visibility/brand-sentiment-card";
import { CitedPagesTable } from "@/components/visibility/cited-pages-table";
import { CompetitorComparison } from "@/components/visibility/competitor-comparison";
import { PromptResearchPanel } from "@/components/visibility/prompt-research-panel";
import { RecommendationsCard } from "@/components/visibility/recommendations-card";
import { SourceOpportunitiesTable } from "@/components/visibility/source-opportunities-table";
import { AIVisibilityScoreHeader } from "@/components/visibility/ai-visibility-score-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApi } from "@/lib/use-api";
import {
  api,
  type ScheduledQuery,
  type VisibilityCheck,
  type VisibilityGap,
} from "@/lib/api";
import { AlertTriangle } from "lucide-react";

const ShareOfVoiceChart = dynamic(
  () =>
    import("@/components/share-of-voice-chart").then((module) => ({
      default: module.ShareOfVoiceChart,
    })),
  { ssr: false },
);

const BrandPerceptionChart = dynamic(
  () =>
    import("@/components/visibility/brand-perception-chart").then((module) => ({
      default: module.BrandPerceptionChart,
    })),
  { ssr: false },
);

const EMPTY_SUB = () => () => {};

export function VisibilityAnalyzeGapsSection({
  projectId,
  latestCrawlId,
  filters,
  isFree,
  history,
  competitorDomains,
  gaps,
}: {
  projectId: string;
  latestCrawlId?: string;
  filters: { region: string; language: string } | undefined;
  isFree: boolean;
  history: VisibilityCheck[];
  competitorDomains?: string[];
  gaps?: VisibilityGap[];
}) {
  return (
    <>
      <AIVisibilityScoreHeader projectId={projectId} filters={filters} />

      {!isFree && (
        <BrandPerformanceDashboard projectId={projectId} filters={filters} />
      )}

      {isFree && (
        <UpgradePrompt
          feature="AI Visibility Tracking"
          description="Track how LLMs mention your brand across 25+ queries with scheduled monitoring."
          nextTier="Starter ($79/mo)"
          nextTierUnlocks="25 visibility checks, 5 scheduled queries, keyword discovery"
        />
      )}

      <RecommendationsCard projectId={projectId} filters={filters} />

      {latestCrawlId && <PlatformReadinessMatrix crawlId={latestCrawlId} />}

      <ShareOfVoiceChart projectId={projectId} filters={filters} />
      <CitedPagesTable projectId={projectId} filters={filters} />

      {!isFree && (
        <BrandSentimentCard projectId={projectId} filters={filters} />
      )}

      {!isFree && (
        <BrandPerceptionChart projectId={projectId} filters={filters} />
      )}

      {history.length > 0 && competitorDomains && (
        <CompetitorComparison
          projectId={projectId}
          results={history}
          competitorDomains={competitorDomains}
        />
      )}

      <VisibilityContentGapsSection gaps={gaps} />

      <PromptResearchPanel projectId={projectId} filters={filters} />
      <SourceOpportunitiesTable projectId={projectId} filters={filters} />
    </>
  );
}

export function VisibilityContentGapsSection({ gaps }: { gaps?: VisibilityGap[] }) {
  if (!gaps || gaps.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Content Gaps
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {gaps.map((gap) => (
          <div
            key={gap.query}
            className="rounded-lg border border-warning/20 bg-warning/5 p-4"
          >
            <p className="text-sm font-medium">&ldquo;{gap.query}&rdquo;</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Your status: Not mentioned</span>
              <span>&bull;</span>
              <span>
                Competitors cited: {gap.competitorsCited.map((item) => item.domain).join(", ")}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Create content targeting this query to close the gap.
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ScheduleSuggestionBanner({
  projectId,
  lastQuery,
  lastProviders,
  onCreated,
}: {
  projectId: string;
  lastQuery: string;
  lastProviders: string[];
  onCreated: (schedule: ScheduledQuery) => void;
}) {
  const { withAuth } = useApi();
  const [creating, setCreating] = useState(false);
  const storageKey = `schedule-suggestion-dismissed-${projectId}`;
  const isDismissedFromStorage = useSyncExternalStore(
    EMPTY_SUB,
    () => localStorage.getItem(storageKey) === "true",
    () => true,
  );
  const [manuallyDismissed, setManuallyDismissed] = useState(false);

  if (isDismissedFromStorage || manuallyDismissed || !lastQuery) return null;

  async function handleCreateWeeklySchedule() {
    setCreating(true);
    try {
      await withAuth(async () => {
        const created = await api.visibility.schedules.create({
          projectId,
          query: lastQuery,
          providers: lastProviders,
          frequency: "weekly",
        });
        onCreated(created);
      });
    } catch {
      // Error handled by withAuth toast
    } finally {
      setCreating(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(storageKey, "true");
    setManuallyDismissed(true);
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="flex items-center justify-between py-3">
        <p className="text-sm">Track your visibility weekly?</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleCreateWeeklySchedule} disabled={creating}>
            {creating ? "Creating..." : "Enable Weekly"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function VisibilityResultCard({ check }: { check: VisibilityCheck }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base capitalize">{check.llmProvider}</CardTitle>
          <div className="flex gap-2">
            <Badge variant={check.brandMentioned ? "success" : "destructive"}>
              {check.brandMentioned ? "Mentioned" : "Not Mentioned"}
            </Badge>
            <Badge variant={check.urlCited ? "success" : "destructive"}>
              {check.urlCited ? "Cited" : "Not Cited"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {check.citationPosition != null && (
          <p className="text-sm text-muted-foreground">
            Position: <span className="font-medium text-foreground">#{check.citationPosition}</span>
          </p>
        )}
        {check.responseText && (
          <div className="max-h-40 overflow-y-auto rounded-md bg-muted p-3 text-xs">
            {check.responseText.slice(0, 500)}
            {check.responseText.length > 500 && "..."}
          </div>
        )}
        {check.competitorMentions &&
          (check.competitorMentions as { domain: string; mentioned: boolean }[]).length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Competitors</p>
              <div className="flex flex-wrap gap-1">
                {(
                  check.competitorMentions as {
                    domain: string;
                    mentioned: boolean;
                    position: number | null;
                  }[]
                ).map((competitor) => (
                  <Badge
                    key={competitor.domain}
                    variant={competitor.mentioned ? "warning" : "secondary"}
                  >
                    {competitor.domain}:{" "}
                    {competitor.mentioned
                      ? `Found (#${competitor.position ?? "?"})`
                      : "Not found"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
