import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { STALE_CRAWL_THRESHOLD_DAYS } from "../projects-page-utils";

type SinceLastVisitSummary = {
  total: number;
  completed: number;
  failed: number;
  running: number;
};

type AnomalySummary = {
  failed: number;
  stale: number;
  noCrawl: number;
  inProgress: number;
  lowScore: number;
  manualSchedule: number;
  pipelineDisabled: number;
};

export function ProjectsPortfolioOverview({
  effectiveLastVisitedAt,
  sinceLastVisitSummary,
  anomalySummary,
  analyzedPortfolioCount,
  totalPortfolioProjects,
  anomalyFilter,
  onSelectAnomaly,
}: {
  effectiveLastVisitedAt: string | null;
  sinceLastVisitSummary: SinceLastVisitSummary;
  anomalySummary: AnomalySummary;
  analyzedPortfolioCount: number;
  totalPortfolioProjects: number | null;
  anomalyFilter: string;
  onSelectAnomaly: (anomaly: string) => void;
}) {
  return (
    <Card>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-semibold">Since Last Visit</p>
          {!effectiveLastVisitedAt ? (
            <p className="text-xs text-muted-foreground">
              First portfolio visit in this browser.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Since {new Date(effectiveLastVisitedAt).toLocaleString()}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">
                  {sinceLastVisitSummary.total} new activities
                </Badge>
                <Badge variant="success">
                  {sinceLastVisitSummary.completed} completed
                </Badge>
                <Badge variant="destructive">
                  {sinceLastVisitSummary.failed} failed
                </Badge>
                <Badge variant="info">
                  {sinceLastVisitSummary.running} in progress
                </Badge>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-semibold">Portfolio Anomaly Board</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="destructive">
              {anomalySummary.failed} failed crawls
            </Badge>
            <Badge variant="warning">
              {anomalySummary.stale} stale ({STALE_CRAWL_THRESHOLD_DAYS}d+)
            </Badge>
            <Badge variant="secondary">
              {anomalySummary.noCrawl} no crawl yet
            </Badge>
            <Badge variant="info">
              {anomalySummary.inProgress} in progress
            </Badge>
            <Badge variant="warning">
              {anomalySummary.lowScore} low score (&lt;60)
            </Badge>
            <Badge variant="secondary">
              {anomalySummary.manualSchedule} manual crawl schedule
            </Badge>
            <Badge variant="secondary">
              {anomalySummary.pipelineDisabled} pipeline disabled
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Analyzed {analyzedPortfolioCount}
            {totalPortfolioProjects != null
              ? ` of ${totalPortfolioProjects}`
              : ""}{" "}
            projects.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              ["failed", "Failed"],
              ["stale", "Stale"],
              ["no_crawl", "No Crawl"],
              ["in_progress", "In Progress"],
              ["low_score", "Low Score"],
              ["manual_schedule", "Manual Schedule"],
              ["pipeline_disabled", "Pipeline Disabled"],
              ["all", "All"],
            ].map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={anomalyFilter === value ? "default" : "outline"}
                onClick={() => onSelectAnomaly(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
