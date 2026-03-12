import { useState } from "react";
import { normalizeDomain } from "@llm-boost/shared";
import { api, type Project } from "@/lib/api";
import { buildAnomalySmartFix } from "@/lib/anomaly-smart-fixes";
import type { AnomalyFilter, HealthFilter, SortBy } from "../projects-page-config";

export function useProjectsPageBulkActions({
  anomalyFilter,
  currentUserId,
  deleteTarget,
  mutate,
  mutatePortfolioSnapshot,
  selectedIds,
  selectedPipelineDisabledProjects,
  selectedProjects,
  setDeleteTarget,
  setSearchInput,
  setSelectedIds,
  toast,
  updateParams,
}: {
  anomalyFilter: AnomalyFilter;
  currentUserId: string | null;
  deleteTarget: { id: string; name: string } | null;
  mutate: () => Promise<unknown>;
  mutatePortfolioSnapshot: () => Promise<unknown>;
  selectedIds: Set<string>;
  selectedPipelineDisabledProjects: Project[];
  selectedProjects: Project[];
  setDeleteTarget: (value: { id: string; name: string } | null) => void;
  setSearchInput: (value: string) => void;
  setSelectedIds: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  toast: (options: {
    title: string;
    description?: string;
    variant?: "default" | "destructive" | "warning";
  }) => void;
  updateParams: (changes: {
    page?: number;
    q?: string | undefined;
    health?: HealthFilter;
    sort?: SortBy;
    anomaly?: AnomalyFilter;
  }) => void;
}) {
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCrawlPreflightOpen, setBulkCrawlPreflightOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkCrawling, setBulkCrawling] = useState(false);
  const [bulkEnablingPipeline, setBulkEnablingPipeline] = useState(false);
  const [bulkPlanningSmartFixes, setBulkPlanningSmartFixes] = useState(false);

  async function deleteProjects(projectIds: string[]) {
    let success = 0;
    let failed = 0;

    for (const projectId of projectIds) {
      try {
        await api.projects.delete(projectId);
        success += 1;
      } catch {
        failed += 1;
      }
    }

    return { success, failed };
  }

  async function handleDeleteProject() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { success, failed } = await deleteProjects([deleteTarget.id]);
      setDeleteTarget(null);

      if (success === 1 && failed === 0) {
        toast({
          title: "Project deleted",
          description: `"${deleteTarget.name}" has been removed.`,
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.id);
          return next;
        });
        await mutate();
        return;
      }

      toast({
        title: "Failed to delete project",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkDeleteProjects() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = [...selectedIds];
      const { success, failed } = await deleteProjects(ids);
      if (success > 0) {
        setSelectedIds(new Set());
        await mutate();
      }

      if (failed === 0) {
        toast({
          title: "Projects deleted",
          description: `${success} project${success === 1 ? "" : "s"} removed.`,
        });
      } else if (success > 0) {
        toast({
          title: "Bulk delete partially completed",
          description: `${success} deleted, ${failed} failed.`,
          variant: "warning",
        });
      } else {
        toast({
          title: "Bulk delete failed",
          variant: "destructive",
        });
      }
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleting(false);
    }
  }

  async function executeBulkRunCrawls(projectIds: string[]) {
    if (projectIds.length === 0) {
      toast({
        title: "No eligible projects selected",
        description: "All selected projects already have a crawl in progress.",
        variant: "warning",
      });
      return;
    }

    setBulkCrawlPreflightOpen(false);
    setBulkCrawling(true);
    try {
      let success = 0;
      let failed = 0;
      for (const projectId of projectIds) {
        try {
          await api.crawls.start(projectId);
          success += 1;
        } catch {
          failed += 1;
        }
      }

      if (failed === 0) {
        toast({
          title: "Crawls started",
          description: `${success} crawl${success === 1 ? "" : "s"} started.`,
        });
      } else if (success > 0) {
        toast({
          title: "Bulk crawl partially completed",
          description: `${success} started, ${failed} failed.`,
          variant: "warning",
        });
      } else {
        toast({
          title: "Bulk crawl failed",
          description: "Please try again or reduce batch size.",
          variant: "destructive",
        });
      }

      if (success > 0) await mutate();
    } finally {
      setBulkCrawling(false);
    }
  }

  function openBulkCrawlPreflight() {
    if (selectedIds.size === 0) return;
    setBulkCrawlPreflightOpen(true);
  }

  async function handleEnablePipelineDefaults() {
    if (selectedPipelineDisabledProjects.length === 0) {
      toast({
        title: "No pipeline updates needed",
        description:
          "Selected projects already have post-crawl pipeline auto-run enabled.",
        variant: "warning",
      });
      return;
    }

    setBulkEnablingPipeline(true);
    try {
      let success = 0;
      let failed = 0;
      for (const project of selectedPipelineDisabledProjects) {
        try {
          await api.pipeline.updateSettings(project.id, {
            autoRunOnCrawl: true,
          });
          success += 1;
        } catch {
          failed += 1;
        }
      }

      if (failed === 0) {
        toast({
          title: "Pipeline defaults enabled",
          description: `${success} project${success === 1 ? "" : "s"} updated.`,
        });
      } else if (success > 0) {
        toast({
          title: "Pipeline update partially completed",
          description: `${success} updated, ${failed} failed.`,
          variant: "warning",
        });
      } else {
        toast({
          title: "Pipeline update failed",
          description: "Please try again.",
          variant: "destructive",
        });
      }

      if (success > 0) {
        await Promise.all([mutate(), mutatePortfolioSnapshot()]);
      }
    } finally {
      setBulkEnablingPipeline(false);
    }
  }

  async function handlePlanSmartFixes() {
    if (anomalyFilter === "all" || selectedProjects.length === 0) return;

    setBulkPlanningSmartFixes(true);
    try {
      let success = 0;
      let failed = 0;
      let created = 0;
      let updated = 0;

      for (const project of selectedProjects) {
        const draft = buildAnomalySmartFix({
          anomaly: anomalyFilter,
          projectName: project.name,
          domain: normalizeDomain(project.domain),
          assigneeId: currentUserId,
        });

        try {
          const result = await api.actionItems.bulkCreate({
            projectId: project.id,
            items: [draft],
          });
          success += 1;
          created += result.created;
          updated += result.updated;
        } catch {
          failed += 1;
        }
      }

      if (failed === 0) {
        toast({
          title: "Smart fixes planned",
          description: `Created ${created}, updated ${updated} across ${success} project${success === 1 ? "" : "s"}.`,
        });
      } else if (success > 0) {
        toast({
          title: "Smart fixes partially planned",
          description: `Created ${created}, updated ${updated}. ${failed} project${failed === 1 ? "" : "s"} failed.`,
          variant: "warning",
        });
      } else {
        toast({
          title: "Could not plan smart fixes",
          description: "Please retry or reduce selection size.",
          variant: "destructive",
        });
      }
    } finally {
      setBulkPlanningSmartFixes(false);
    }
  }

  function resetFilters() {
    setSearchInput("");
    setSelectedIds(new Set());
    updateParams({
      page: 1,
      q: undefined,
      health: "all",
      sort: "activity_desc",
      anomaly: "all",
    });
  }

  return {
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkCrawlPreflightOpen,
    setBulkCrawlPreflightOpen,
    deleting,
    bulkDeleting,
    bulkCrawling,
    bulkEnablingPipeline,
    bulkPlanningSmartFixes,
    handleDeleteProject,
    handleBulkDeleteProjects,
    executeBulkRunCrawls,
    openBulkCrawlPreflight,
    handleEnablePipelineDefaults,
    handlePlanSmartFixes,
    resetFilters,
  };
}



