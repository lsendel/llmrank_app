import { Loader2, Play, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ProjectsSelectionBar({
  selectedCount,
  anomalyFilter,
  bulkEnablingPipeline,
  selectedPipelineDisabledCount,
  onEnablePipelineDefaults,
  bulkPlanningSmartFixes,
  onPlanSmartFixes,
  bulkCrawling,
  onRunCrawl,
  bulkDeleting,
  onDelete,
  onClearSelection,
}: {
  selectedCount: number;
  anomalyFilter: string;
  bulkEnablingPipeline: boolean;
  selectedPipelineDisabledCount: number;
  onEnablePipelineDefaults: () => void;
  bulkPlanningSmartFixes: boolean;
  onPlanSmartFixes: () => void;
  bulkCrawling: boolean;
  onRunCrawl: () => void;
  bulkDeleting: boolean;
  onDelete: () => void;
  onClearSelection: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm font-medium">{selectedCount} selected</p>
        <div className="flex flex-wrap items-center gap-2">
          {anomalyFilter === "pipeline_disabled" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onEnablePipelineDefaults}
              disabled={
                bulkEnablingPipeline || selectedPipelineDisabledCount === 0
              }
            >
              {bulkEnablingPipeline ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Enable Pipeline Defaults
            </Button>
          )}
          {anomalyFilter !== "all" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onPlanSmartFixes}
              disabled={bulkPlanningSmartFixes}
            >
              {bulkPlanningSmartFixes ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Plan Smart Fixes
            </Button>
          )}
          <Button size="sm" onClick={onRunCrawl} disabled={bulkCrawling}>
            {bulkCrawling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run Crawl
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onDelete}
            disabled={bulkDeleting}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button size="sm" variant="outline" onClick={onClearSelection}>
            Clear Selection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
