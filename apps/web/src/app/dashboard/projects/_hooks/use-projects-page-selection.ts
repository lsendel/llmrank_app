import { useMemo } from "react";
import type { Project } from "@/lib/api";
import { isInProgress } from "../projects-page-utils";

export function useProjectsPageSelection({
  anomalyFilteredProjects,
  projects,
  selectedIds,
  setSelectedIds,
  usingAnomalyView,
}: {
  anomalyFilteredProjects: Project[];
  projects: Project[];
  selectedIds: Set<string>;
  setSelectedIds: (
    value: Set<string> | ((prev: Set<string>) => Set<string>),
  ) => void;
  usingAnomalyView: boolean;
}) {
  const visibleIds = projects.map((project) => project.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const anomalyMatchingIds = useMemo(
    () => anomalyFilteredProjects.map((project) => project.id),
    [anomalyFilteredProjects],
  );

  const allMatchingSelected =
    usingAnomalyView &&
    anomalyMatchingIds.length > 0 &&
    anomalyMatchingIds.every((id) => selectedIds.has(id));

  const selectedCount = selectedIds.size;
  const selectionScopeProjects = useMemo(
    () => (usingAnomalyView ? anomalyFilteredProjects : projects),
    [usingAnomalyView, anomalyFilteredProjects, projects],
  );
  const selectedProjects = useMemo(
    () =>
      selectionScopeProjects.filter((project) => selectedIds.has(project.id)),
    [selectionScopeProjects, selectedIds],
  );
  const selectedRunningProjects = useMemo(
    () => selectedProjects.filter(isInProgress),
    [selectedProjects],
  );
  const selectedRunnableProjects = useMemo(
    () => selectedProjects.filter((project) => !isInProgress(project)),
    [selectedProjects],
  );
  const selectedPipelineDisabledProjects = useMemo(
    () =>
      selectedProjects.filter(
        (project) => project.pipelineSettings?.autoRunOnCrawl === false,
      ),
    [selectedProjects],
  );

  function toggleProjectSelection(projectId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function toggleMatchingSelection() {
    if (!usingAnomalyView) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allMatchingSelected) {
        for (const id of anomalyMatchingIds) next.delete(id);
      } else {
        for (const id of anomalyMatchingIds) next.add(id);
      }
      return next;
    });
  }

  return {
    allMatchingSelected,
    allVisibleSelected,
    anomalyMatchingIds,
    selectedCount,
    selectedPipelineDisabledProjects,
    selectedProjects,
    selectedRunnableProjects,
    selectedRunningProjects,
    toggleMatchingSelection,
    toggleProjectSelection,
    toggleVisibleSelection,
  };
}
