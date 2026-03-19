"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StateMessage } from "@/components/ui/state";
import { ProjectGrid } from "./_components/project-grid";
import { ProjectsFiltersCard } from "./_components/projects-filters-card";
import { ProjectsPortfolioOverview } from "./_components/projects-portfolio-overview";
import { ProjectsSelectionBar } from "./_components/projects-selection-bar";

export function ProjectsTabContent(props: any) {
  const {
    effectiveLastVisitedAt,
    sinceLastVisitSummary,
    anomalySummary,
    analyzedPortfolioCount,
    totalPortfolioProjects,
    anomalyFilter,
    updateParams,
    loading,
    projects,
    totalFiltered,
    searchInput,
    setSearchInput,
    healthFilter,
    sortBy,
    resetFilters,
    presetButtons,
    applyPreset,
    activePreset,
    savingDefaultPreset,
    handleSaveDefaultPreset,
    usingAnomalyView,
    pageSummary,
    activeAnomalyShortcut,
    anomalyShortcutLinks,
    additionalAnomalyMatchCount,
    selectedCount,
    bulkEnablingPipeline,
    selectedPipelineDisabledProjects,
    handleEnablePipelineDefaults,
    bulkPlanningSmartFixes,
    handlePlanSmartFixes,
    bulkCrawling,
    openBulkCrawlPreflight,
    bulkDeleting,
    setBulkDeleteOpen,
    setSelectedIds,
    currentPage,
    PROJECTS_PER_PAGE,
    anomalyMatchingIds,
    toggleMatchingSelection,
    allMatchingSelected,
    toggleVisibleSelection,
    allVisibleSelected,
    selectedIds,
    toggleProjectSelection,
    setDeleteTarget,
    totalPages,
  } = props;

  return (
    <>
      <ProjectsPortfolioOverview
        effectiveLastVisitedAt={effectiveLastVisitedAt}
        sinceLastVisitSummary={sinceLastVisitSummary}
        anomalySummary={anomalySummary}
        analyzedPortfolioCount={analyzedPortfolioCount}
        totalPortfolioProjects={totalPortfolioProjects}
        anomalyFilter={anomalyFilter}
        onSelectAnomaly={(value) =>
          updateParams({ anomaly: value as any, page: 1 })
        }
      />

      {loading ? (
        <StateMessage
          variant="loading"
          title="Loading projects"
          description="Fetching portfolio health, score trends, and anomaly signals."
          className="py-16"
        />
      ) : analyzedPortfolioCount === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">No projects yet.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/projects/new">
                <Plus className="h-4 w-4" />
                Create your first project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div id="filters" />
          <ProjectsFiltersCard
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            healthFilter={healthFilter}
            onHealthChange={(value) =>
              updateParams({
                health: value as any,
                page: 1,
                anomaly: "all",
              })
            }
            sortBy={sortBy}
            onSortChange={(value) =>
              updateParams({ sort: value as any, page: 1 })
            }
            onReset={resetFilters}
            presetButtons={presetButtons}
            onApplyPreset={(preset) => applyPreset(preset as any)}
            canSaveDefaultPreset={Boolean(activePreset)}
            savingDefaultPreset={savingDefaultPreset}
            onSaveDefaultPreset={() => void handleSaveDefaultPreset()}
            usingAnomalyView={usingAnomalyView}
            anomalyFilter={anomalyFilter}
            totalFiltered={totalFiltered}
            pageSummary={pageSummary}
            activeAnomalyShortcut={activeAnomalyShortcut}
            anomalyShortcutTargets={anomalyShortcutLinks}
            additionalAnomalyMatchCount={additionalAnomalyMatchCount}
          />

          {selectedCount > 0 && (
            <ProjectsSelectionBar
              selectedCount={selectedCount}
              anomalyFilter={anomalyFilter}
              bulkEnablingPipeline={bulkEnablingPipeline}
              selectedPipelineDisabledCount={
                selectedPipelineDisabledProjects.length
              }
              onEnablePipelineDefaults={() =>
                void handleEnablePipelineDefaults()
              }
              bulkPlanningSmartFixes={bulkPlanningSmartFixes}
              onPlanSmartFixes={() => void handlePlanSmartFixes()}
              bulkCrawling={bulkCrawling}
              onRunCrawl={openBulkCrawlPreflight}
              bulkDeleting={bulkDeleting}
              onDelete={() => setBulkDeleteOpen(true)}
              onClearSelection={() => setSelectedIds(new Set())}
            />
          )}

          {projects.length > 0 ? (
            <>
              <div id="select-projects" />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  {totalFiltered === 0
                    ? 0
                    : (currentPage - 1) * PROJECTS_PER_PAGE + 1}
                  –{Math.min(currentPage * PROJECTS_PER_PAGE, totalFiltered)}{" "}
                  of {totalFiltered}
                </p>
                <div className="flex items-center gap-2">
                  {usingAnomalyView && anomalyMatchingIds.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleMatchingSelection}
                    >
                      {allMatchingSelected
                        ? "Unselect Matching"
                        : `Select Matching (${anomalyMatchingIds.length})`}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleVisibleSelection}
                    disabled={projects.length === 0}
                  >
                    {allVisibleSelected ? "Unselect Page" : "Select Page"}
                  </Button>
                </div>
              </div>

              <ProjectGrid
                projects={projects}
                selectedIds={selectedIds}
                onToggleProjectSelection={toggleProjectSelection}
                onRequestDelete={(target) => setDeleteTarget(target)}
              />

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() =>
                        updateParams({ page: Math.max(1, currentPage - 1) })
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() =>
                        updateParams({
                          page: Math.min(totalPages, currentPage + 1),
                        })
                      }
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Filter className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="font-medium">No projects match current filters</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {healthFilter !== "all" && (
                    <span>Health: <strong>{healthFilter.replace("_", " ")}</strong></span>
                  )}
                  {healthFilter !== "all" && anomalyFilter !== "all" && " · "}
                  {anomalyFilter !== "all" && (
                    <span>Anomaly: <strong>{anomalyFilter.replace("_", " ")}</strong></span>
                  )}
                  {healthFilter === "all" && anomalyFilter === "all" && searchInput && (
                    <span>Search: <strong>&quot;{searchInput}&quot;</strong></span>
                  )}
                </p>
                <div className="flex items-center gap-3 mt-5">
                  <Button variant="outline" onClick={resetFilters}>
                    Clear all filters
                  </Button>
                  <Button asChild>
                    <Link href="/dashboard/projects/new">
                      <Plus className="h-4 w-4" />
                      New Project
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}

export function ProjectsPageDialogs(props: any) {
  const {
    deleteTarget,
    setDeleteTarget,
    deleting,
    handleDeleteProject,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    selectedCount,
    handleBulkDeleteProjects,
    bulkDeleting,
    bulkCrawlPreflightOpen,
    setBulkCrawlPreflightOpen,
    selectedRunnableProjects,
    selectedRunningProjects,
    estimatedCreditsUsed,
    creditsRemaining,
    estimatedCreditsAfterRun,
    estimatedOverLimit,
    bulkCrawling,
    executeBulkRunCrawls,
  } = props;

  return (
    <>
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold">{deleteTarget?.name}</span> and
              all its crawl data, scores, and reports.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Project"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Projects?</DialogTitle>
            <DialogDescription>
              You are about to permanently remove {selectedCount} project
              {selectedCount === 1 ? "" : "s"} and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDeleteProjects}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Selected"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkCrawlPreflightOpen}
        onOpenChange={setBulkCrawlPreflightOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Crawl Preflight</DialogTitle>
            <DialogDescription>
              Review estimated credit impact before starting selected crawls.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">{selectedCount} selected</Badge>
              <Badge variant="info">
                {selectedRunnableProjects.length} eligible
              </Badge>
              <Badge variant="warning">
                {selectedRunningProjects.length} already running
              </Badge>
            </div>

            <div className="rounded-lg border p-3 text-sm">
              <p>
                Estimated credits used:{" "}
                <span className="font-semibold">{estimatedCreditsUsed}</span>
              </p>
              {creditsRemaining != null ? (
                <>
                  <p className="mt-1">
                    Credits remaining now:{" "}
                    <span className="font-semibold">{creditsRemaining}</span>
                  </p>
                  <p className="mt-1">
                    Estimated credits after run:{" "}
                    <span className="font-semibold">
                      {estimatedCreditsAfterRun}
                    </span>
                  </p>
                </>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  Credit usage data is unavailable right now.
                </p>
              )}
            </div>

            {selectedRunningProjects.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                {selectedRunningProjects.length} selected project
                {selectedRunningProjects.length === 1 ? " is" : "s are"} already
                in progress and will be skipped.
              </div>
            )}

            {estimatedOverLimit && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">
                  Estimated usage exceeds remaining credits. Some crawl starts
                  may fail.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkCrawlPreflightOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                void executeBulkRunCrawls(
                  selectedRunnableProjects.map((project: any) => project.id),
                )
              }
              disabled={bulkCrawling || selectedRunnableProjects.length === 0}
            >
              {bulkCrawling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Crawls"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
