"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type ProjectsDefaultPreset } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueueList } from "./_components/queue-list";
import { useProjectsPageSummaries } from "./_hooks/use-projects-page-summaries";
import {
  ProjectsPageDialogs,
  ProjectsTabContent,
} from "./projects-page-sections";
import { ProjectsPageHeader } from "./projects-page-header";
import {
  compareProjectsBySort,
  matchesAnomaly,
  matchesSearch,
  parsePage,
  PROJECTS_PER_PAGE,
} from "./projects-page-utils";
import { useUser } from "@/lib/auth-hooks";
import {
  getLastProjectContext,
  lastProjectContextHref,
  normalizeLastProjectContext,
  pickMostRecentProjectContext,
  projectTabLabel,
  saveLastProjectContext,
  type LastProjectContext,
} from "@/lib/workflow-memory";
import {
  defaultProjectsViewPresetFromPersona,
  normalizeProjectsViewPreset,
  shouldSyncProjectsViewPreset,
} from "@/lib/projects-view-preset";
import {
  normalizeProjectsViewState,
  projectsViewStateSignature,
} from "@/lib/projects-view-state";
import {
  normalizeVisitTimestamp,
  pickMostRecentVisitTimestamp,
} from "@/lib/visit-memory";
import {
  ANOMALY_SHORTCUTS,
  DEFAULT_PRESET_STORAGE_KEY,
  PROJECTS_LAST_VISIT_STORAGE_KEY,
  VALID_ANOMALY_FILTERS,
  VALID_HEALTH_FILTERS,
  VALID_SORTS,
  VIEW_PRESETS,
  type AnomalyFilter,
  type HealthFilter,
  type SortBy,
  type ViewPreset,
} from "./projects-page-config";
import { useProjectsPageBulkActions } from "./_hooks/use-projects-page-bulk-actions";
import { useProjectsPageSelection } from "./_hooks/use-projects-page-selection";

export default function ProjectsPage() {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const currentUserId = user?.id ?? null;

  const currentPage = parsePage(searchParams.get("page"));
  const rawHealth = searchParams.get("health");
  const rawSort = searchParams.get("sort");
  const rawAnomaly = searchParams.get("anomaly");
  const hasViewStateQueryOverrides =
    rawHealth !== null || rawSort !== null || rawAnomaly !== null;
  const searchQuery = searchParams.get("q") ?? "";
  const healthFilter: HealthFilter = VALID_HEALTH_FILTERS.includes(
    rawHealth as HealthFilter,
  )
    ? (rawHealth as HealthFilter)
    : "all";
  const sortBy: SortBy = VALID_SORTS.includes(rawSort as SortBy)
    ? (rawSort as SortBy)
    : "activity_desc";
  const anomalyFilter: AnomalyFilter = VALID_ANOMALY_FILTERS.includes(
    rawAnomaly as AnomalyFilter,
  )
    ? (rawAnomaly as AnomalyFilter)
    : "all";

  const [searchInput, setSearchInput] = useState(searchQuery);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [savingDefaultPreset, setSavingDefaultPreset] = useState(false);
  const [lastVisitedAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const previous = normalizeVisitTimestamp(
      localStorage.getItem(PROJECTS_LAST_VISIT_STORAGE_KEY),
    );
    localStorage.setItem(
      PROJECTS_LAST_VISIT_STORAGE_KEY,
      new Date().toISOString(),
    );
    return previous;
  });
  const [localLastProjectContext] = useState<LastProjectContext | null>(() =>
    getLastProjectContext(),
  );
  const hasBootstrappedPreset = useRef(false);
  const hasSyncedLegacyDefaultPreset = useRef(false);
  const hasSyncedLegacyProjectContext = useRef(false);
  const hasSyncedProjectsVisitRef = useRef(false);
  const isSyncingProjectsViewStateRef = useRef(false);
  const lastSyncedProjectsViewStateSignatureRef = useRef<string | null>(null);
  const pendingBootstrapViewStateSignatureRef = useRef<string | null>(null);

  const updateParams = useCallback(
    (changes: {
      page?: number;
      q?: string;
      health?: HealthFilter;
      sort?: SortBy;
      anomaly?: AnomalyFilter;
    }) => {
      const next = new URLSearchParams(searchParams.toString());
      const setOrDelete = (key: string, value: string | undefined) => {
        if (!value) next.delete(key);
        else next.set(key, value);
      };

      if (changes.page !== undefined) {
        if (changes.page <= 1) next.delete("page");
        else next.set("page", String(changes.page));
      }
      if (changes.q !== undefined) {
        setOrDelete("q", changes.q.trim() || undefined);
      }
      if (changes.health !== undefined) {
        if (changes.health === "all") next.delete("health");
        else next.set("health", changes.health);
      }
      if (changes.sort !== undefined) {
        if (changes.sort === "activity_desc") next.delete("sort");
        else next.set("sort", changes.sort);
      }
      if (changes.anomaly !== undefined) {
        if (changes.anomaly === "all") next.delete("anomaly");
        else next.set("anomaly", changes.anomaly);
      }

      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchQuery) {
        updateParams({ q: searchInput, page: 1 });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, searchQuery, updateParams]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, healthFilter, sortBy, anomalyFilter, currentPage]);

  const { data: accountMe, isLoading: accountMeLoading } = useApiSWR(
    "account-me",
    useCallback(() => api.account.getMe(), []),
  );
  const {
    data: accountPreferences,
    isLoading: accountPreferencesLoading,
    mutate: mutateAccountPreferences,
  } = useApiSWR(
    "account-preferences",
    useCallback(() => api.account.getPreferences(), []),
  );

  const activePreset = useMemo(() => {
    for (const [key, preset] of Object.entries(VIEW_PRESETS)) {
      if (preset.health === healthFilter && preset.sort === sortBy) {
        return key as ViewPreset;
      }
    }
    return null;
  }, [healthFilter, sortBy]);
  const currentProjectsViewState = useMemo(
    () => ({
      health: healthFilter,
      sort: sortBy,
      anomaly: anomalyFilter,
    }),
    [anomalyFilter, healthFilter, sortBy],
  );

  const defaultPreset = useMemo(() => {
    const serverPreset = normalizeProjectsViewPreset(
      accountPreferences?.projectsDefaultPreset ?? null,
    );
    if (serverPreset) return serverPreset;

    if (typeof window === "undefined") return null;
    const localPreset = normalizeProjectsViewPreset(
      localStorage.getItem(DEFAULT_PRESET_STORAGE_KEY),
    );
    if (localPreset) return localPreset;

    return defaultProjectsViewPresetFromPersona(accountMe?.persona);
  }, [accountMe?.persona, accountPreferences?.projectsDefaultPreset]);
  const serverProjectsViewState = useMemo(
    () => normalizeProjectsViewState(accountPreferences?.projectsLastViewState),
    [accountPreferences?.projectsLastViewState],
  );
  const serverProjectsViewStateSignature = useMemo(
    () => projectsViewStateSignature(serverProjectsViewState),
    [serverProjectsViewState],
  );

  const serverLastProjectContext = useMemo(
    () => normalizeLastProjectContext(accountPreferences?.lastProjectContext),
    [accountPreferences?.lastProjectContext],
  );

  const lastProjectContext = useMemo(
    () =>
      pickMostRecentProjectContext([
        localLastProjectContext,
        serverLastProjectContext,
      ]),
    [localLastProjectContext, serverLastProjectContext],
  );
  const effectiveLastVisitedAt = pickMostRecentVisitTimestamp([
    lastVisitedAt,
    normalizeVisitTimestamp(accountPreferences?.projectsLastVisitedAt),
  ]);

  useEffect(() => {
    if (accountPreferencesLoading || typeof window === "undefined") return;
    const serverPreset = normalizeProjectsViewPreset(
      accountPreferences?.projectsDefaultPreset ?? null,
    );
    if (!serverPreset) return;
    localStorage.setItem(DEFAULT_PRESET_STORAGE_KEY, serverPreset);
  }, [accountPreferencesLoading, accountPreferences?.projectsDefaultPreset]);

  useEffect(() => {
    if (accountPreferencesLoading) return;
    if (isSyncingProjectsViewStateRef.current) return;
    lastSyncedProjectsViewStateSignatureRef.current =
      serverProjectsViewStateSignature;
  }, [accountPreferencesLoading, serverProjectsViewStateSignature]);

  useEffect(() => {
    const pending = pendingBootstrapViewStateSignatureRef.current;
    if (!pending) return;
    const currentSignature = projectsViewStateSignature(
      currentProjectsViewState,
    );
    if (currentSignature === pending) {
      pendingBootstrapViewStateSignatureRef.current = null;
    }
  }, [currentProjectsViewState]);

  useEffect(() => {
    if (hasSyncedLegacyDefaultPreset.current) return;
    if (accountPreferencesLoading || typeof window === "undefined") return;

    const serverPreset = normalizeProjectsViewPreset(
      accountPreferences?.projectsDefaultPreset ?? null,
    );
    const localPreset = normalizeProjectsViewPreset(
      localStorage.getItem(DEFAULT_PRESET_STORAGE_KEY),
    );

    if (
      !shouldSyncProjectsViewPreset({
        serverPreset,
        localPreset,
      })
    ) {
      hasSyncedLegacyDefaultPreset.current = true;
      return;
    }

    hasSyncedLegacyDefaultPreset.current = true;
    void (async () => {
      try {
        const updated = await api.account.updatePreferences({
          projectsDefaultPreset: localPreset as ProjectsDefaultPreset,
        });
        await mutateAccountPreferences(updated, { revalidate: false });
      } catch {
        // Keep local default in place when server sync is unavailable.
      }
    })();
  }, [
    accountPreferencesLoading,
    accountPreferences?.projectsDefaultPreset,
    mutateAccountPreferences,
  ]);

  useEffect(() => {
    if (!serverLastProjectContext) return;
    if (!localLastProjectContext) {
      saveLastProjectContext(serverLastProjectContext);
      return;
    }
    const latest = pickMostRecentProjectContext([
      localLastProjectContext,
      serverLastProjectContext,
    ]);
    if (latest?.visitedAt === serverLastProjectContext.visitedAt) {
      saveLastProjectContext(serverLastProjectContext);
    }
  }, [localLastProjectContext, serverLastProjectContext]);

  useEffect(() => {
    if (hasSyncedLegacyProjectContext.current) return;
    if (accountPreferencesLoading) return;
    if (serverLastProjectContext || !localLastProjectContext) {
      hasSyncedLegacyProjectContext.current = true;
      return;
    }

    hasSyncedLegacyProjectContext.current = true;
    void (async () => {
      try {
        const updated = await api.account.updatePreferences({
          lastProjectContext: localLastProjectContext,
        });
        await mutateAccountPreferences(updated, { revalidate: false });
      } catch {
        // Keep local-only context when server sync is unavailable.
      }
    })();
  }, [
    accountPreferencesLoading,
    localLastProjectContext,
    mutateAccountPreferences,
    serverLastProjectContext,
  ]);

  useEffect(() => {
    if (hasSyncedProjectsVisitRef.current) return;
    if (accountPreferencesLoading || typeof window === "undefined") return;
    hasSyncedProjectsVisitRef.current = true;
    const currentVisitAt =
      normalizeVisitTimestamp(
        window.localStorage.getItem(PROJECTS_LAST_VISIT_STORAGE_KEY),
      ) ?? new Date().toISOString();
    void api.account
      .updatePreferences({ projectsLastVisitedAt: currentVisitAt })
      .catch(() => {
        // Keep local-only baseline when server sync is unavailable.
      });
  }, [accountPreferencesLoading]);

  const applyPreset = useCallback(
    (preset: ViewPreset) => {
      const config = VIEW_PRESETS[preset];
      setSearchInput("");
      updateParams({
        health: config.health,
        sort: config.sort,
        q: undefined,
        page: 1,
        anomaly: "all",
      });
    },
    [updateParams],
  );

  const handleSaveDefaultPreset = useCallback(async () => {
    if (!activePreset) return;

    localStorage.setItem(DEFAULT_PRESET_STORAGE_KEY, activePreset);
    setSavingDefaultPreset(true);
    try {
      const updated = await api.account.updatePreferences({
        projectsDefaultPreset: activePreset as ProjectsDefaultPreset,
      });
      await mutateAccountPreferences(updated, { revalidate: false });
      toast({
        title: "Default view updated",
        description: `${VIEW_PRESETS[activePreset].label} will load by default.`,
      });
    } catch {
      toast({
        title: "Saved only on this browser",
        description: "Could not sync default view to your account right now.",
        variant: "warning",
      });
    } finally {
      setSavingDefaultPreset(false);
    }
  }, [activePreset, mutateAccountPreferences, toast]);

  useEffect(() => {
    if (hasBootstrappedPreset.current) return;
    if (accountPreferencesLoading || accountMeLoading) return;

    const hasQueryOverrides =
      !!searchParams.get("health") ||
      !!searchParams.get("sort") ||
      !!searchParams.get("q") ||
      !!searchParams.get("anomaly");
    if (hasQueryOverrides) {
      pendingBootstrapViewStateSignatureRef.current = null;
      hasBootstrappedPreset.current = true;
      return;
    }

    if (serverProjectsViewState) {
      pendingBootstrapViewStateSignatureRef.current =
        projectsViewStateSignature(serverProjectsViewState);
      hasBootstrappedPreset.current = true;
      setSearchInput("");
      updateParams({
        health: serverProjectsViewState.health as HealthFilter,
        sort: serverProjectsViewState.sort as SortBy,
        anomaly: serverProjectsViewState.anomaly as AnomalyFilter,
        q: undefined,
        page: 1,
      });
      return;
    }

    if (defaultPreset) {
      pendingBootstrapViewStateSignatureRef.current =
        projectsViewStateSignature({
          health: VIEW_PRESETS[defaultPreset].health,
          sort: VIEW_PRESETS[defaultPreset].sort,
          anomaly: "all",
        });
      hasBootstrappedPreset.current = true;
      applyPreset(defaultPreset);
      return;
    }
    pendingBootstrapViewStateSignatureRef.current = null;
    hasBootstrappedPreset.current = true;
  }, [
    accountMeLoading,
    accountPreferencesLoading,
    applyPreset,
    defaultPreset,
    serverProjectsViewState,
    searchParams,
    updateParams,
  ]);

  useEffect(() => {
    if (accountPreferencesLoading) return;
    if (!hasBootstrappedPreset.current) return;
    if (isSyncingProjectsViewStateRef.current) return;

    const currentSignature = projectsViewStateSignature(
      currentProjectsViewState,
    );
    if (!currentSignature) return;
    if (
      pendingBootstrapViewStateSignatureRef.current &&
      pendingBootstrapViewStateSignatureRef.current !== currentSignature
    ) {
      return;
    }
    if (lastSyncedProjectsViewStateSignatureRef.current === currentSignature) {
      return;
    }

    // Avoid overwriting server state before initial URL hydration applies.
    if (
      !hasViewStateQueryOverrides &&
      serverProjectsViewStateSignature &&
      serverProjectsViewStateSignature !== currentSignature
    ) {
      return;
    }

    isSyncingProjectsViewStateRef.current = true;
    lastSyncedProjectsViewStateSignatureRef.current = currentSignature;

    void (async () => {
      try {
        const updated = await api.account.updatePreferences({
          projectsLastViewState: currentProjectsViewState,
        });
        await mutateAccountPreferences(updated, { revalidate: false });
      } catch {
        // Re-allow retries from the most recent server value on transient failures.
        lastSyncedProjectsViewStateSignatureRef.current =
          serverProjectsViewStateSignature;
      } finally {
        isSyncingProjectsViewStateRef.current = false;
      }
    })();
  }, [
    accountPreferencesLoading,
    currentProjectsViewState,
    hasViewStateQueryOverrides,
    mutateAccountPreferences,
    serverProjectsViewStateSignature,
  ]);

  const {
    data: result,
    isLoading: loading,
    mutate,
  } = useApiSWR(
    `projects-list-${currentPage}-${searchQuery}-${healthFilter}-${sortBy}`,
    useCallback(
      () =>
        api.projects.list({
          page: currentPage,
          limit: PROJECTS_PER_PAGE,
          q: searchQuery || undefined,
          health: healthFilter,
          sort: sortBy,
        }),
      [currentPage, searchQuery, healthFilter, sortBy],
    ),
  );

  const serverProjects = useMemo(() => result?.data ?? [], [result?.data]);
  const pagination = result?.pagination;
  const { data: billingInfo } = useApiSWR(
    "billing-usage",
    useCallback(() => api.billing.getInfo(), []),
  );
  const { data: recentActivity } = useApiSWR(
    "dashboard-recent-activity",
    useCallback(() => api.dashboard.getRecentActivity(), []),
  );
  const { data: portfolioSnapshot, mutate: mutatePortfolioSnapshot } =
    useApiSWR(
      "projects-portfolio-snapshot",
      useCallback(
        () =>
          api.projects.list({
            page: 1,
            limit: 100,
            health: "all",
            sort: "activity_desc",
          }),
        [],
      ),
    );
  const anomalyProjects = useMemo(
    () => portfolioSnapshot?.data ?? serverProjects,
    [portfolioSnapshot?.data, serverProjects],
  );

  const anomalyFilteredProjects = useMemo(() => {
    const filtered = anomalyProjects
      .filter((project) => matchesAnomaly(project, anomalyFilter))
      .filter((project) => matchesSearch(project, searchQuery));
    return [...filtered].sort((a, b) => compareProjectsBySort(a, b, sortBy));
  }, [anomalyFilter, anomalyProjects, searchQuery, sortBy]);
  const activeAnomalyShortcut = useMemo(
    () => (anomalyFilter === "all" ? null : ANOMALY_SHORTCUTS[anomalyFilter]),
    [anomalyFilter],
  );
  const anomalyShortcutTargets = useMemo(() => {
    if (!activeAnomalyShortcut) return [];
    return anomalyFilteredProjects.slice(0, 3);
  }, [activeAnomalyShortcut, anomalyFilteredProjects]);

  const usingAnomalyView = anomalyFilter !== "all";
  const totalFiltered = usingAnomalyView
    ? anomalyFilteredProjects.length
    : (pagination?.total ?? 0);
  const totalPages = usingAnomalyView
    ? Math.max(1, Math.ceil(totalFiltered / PROJECTS_PER_PAGE))
    : (pagination?.totalPages ?? 1);

  const projects = useMemo(() => {
    if (!usingAnomalyView) return serverProjects;
    const start = (currentPage - 1) * PROJECTS_PER_PAGE;
    return anomalyFilteredProjects.slice(start, start + PROJECTS_PER_PAGE);
  }, [usingAnomalyView, serverProjects, currentPage, anomalyFilteredProjects]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      updateParams({ page: totalPages });
    }
  }, [currentPage, totalPages, updateParams]);

  const {
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
  } = useProjectsPageSelection({
    anomalyFilteredProjects,
    projects,
    selectedIds,
    setSelectedIds,
    usingAnomalyView,
  });
  const estimatedCreditsUsed = selectedRunnableProjects.length;
  const creditsRemaining = billingInfo?.crawlCreditsRemaining ?? null;
  const estimatedCreditsAfterRun =
    creditsRemaining != null
      ? Math.max(creditsRemaining - estimatedCreditsUsed, 0)
      : null;
  const estimatedOverLimit =
    creditsRemaining != null && estimatedCreditsUsed > creditsRemaining;
  const analyzedPortfolioCount = anomalyProjects.length;
  const totalPortfolioProjects = portfolioSnapshot?.pagination.total ?? null;
  const { sinceLastVisitSummary, anomalySummary, pageSummary } =
    useProjectsPageSummaries({
      recentActivity,
      effectiveLastVisitedAt,
      anomalyProjects,
      projects,
    });
  const presetButtons = useMemo(
    () =>
      (
        Object.entries(VIEW_PRESETS) as Array<
          [ViewPreset, (typeof VIEW_PRESETS)[ViewPreset]]
        >
      ).map(([key, preset]) => ({
        key,
        label: preset.label,
        active: activePreset === key,
      })),
    [activePreset],
  );
  const anomalyShortcutLinks = useMemo(() => {
    if (!activeAnomalyShortcut) return [];

    return anomalyShortcutTargets.map((project) => ({
      id: project.id,
      name: project.name,
      href: `/dashboard/projects/${project.id}?tab=${activeAnomalyShortcut.tab}`,
    }));
  }, [activeAnomalyShortcut, anomalyShortcutTargets]);
  const additionalAnomalyMatchCount = Math.max(
    anomalyFilteredProjects.length - anomalyShortcutTargets.length,
    0,
  );

  const {
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
  } = useProjectsPageBulkActions({
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
  });
  return (
    <div className="space-y-6">
      <ProjectsPageHeader
        lastProjectContext={lastProjectContext}
        lastProjectContextHref={lastProjectContextHref}
        projectTabLabel={projectTabLabel}
      />
      <Tabs defaultValue="projects" className="w-full">
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-6 space-y-6">
          <ProjectsTabContent
            effectiveLastVisitedAt={effectiveLastVisitedAt}
            sinceLastVisitSummary={sinceLastVisitSummary}
            anomalySummary={anomalySummary}
            analyzedPortfolioCount={analyzedPortfolioCount}
            totalPortfolioProjects={totalPortfolioProjects}
            anomalyFilter={anomalyFilter}
            updateParams={updateParams}
            loading={loading}
            projects={projects}
            totalFiltered={totalFiltered}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            healthFilter={healthFilter}
            sortBy={sortBy}
            resetFilters={resetFilters}
            presetButtons={presetButtons}
            applyPreset={applyPreset}
            activePreset={activePreset}
            savingDefaultPreset={savingDefaultPreset}
            handleSaveDefaultPreset={handleSaveDefaultPreset}
            usingAnomalyView={usingAnomalyView}
            pageSummary={pageSummary}
            activeAnomalyShortcut={activeAnomalyShortcut}
            anomalyShortcutLinks={anomalyShortcutLinks}
            additionalAnomalyMatchCount={additionalAnomalyMatchCount}
            selectedCount={selectedCount}
            bulkEnablingPipeline={bulkEnablingPipeline}
            selectedPipelineDisabledProjects={selectedPipelineDisabledProjects}
            handleEnablePipelineDefaults={handleEnablePipelineDefaults}
            bulkPlanningSmartFixes={bulkPlanningSmartFixes}
            handlePlanSmartFixes={handlePlanSmartFixes}
            bulkCrawling={bulkCrawling}
            openBulkCrawlPreflight={openBulkCrawlPreflight}
            bulkDeleting={bulkDeleting}
            setBulkDeleteOpen={setBulkDeleteOpen}
            setSelectedIds={setSelectedIds}
            currentPage={currentPage}
            PROJECTS_PER_PAGE={PROJECTS_PER_PAGE}
            anomalyMatchingIds={anomalyMatchingIds}
            toggleMatchingSelection={toggleMatchingSelection}
            allMatchingSelected={allMatchingSelected}
            toggleVisibleSelection={toggleVisibleSelection}
            allVisibleSelected={allVisibleSelected}
            selectedIds={selectedIds}
            toggleProjectSelection={toggleProjectSelection}
            setDeleteTarget={setDeleteTarget}
            totalPages={totalPages}
          />
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <QueueList />
        </TabsContent>
      </Tabs>

      <ProjectsPageDialogs
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        deleting={deleting}
        handleDeleteProject={handleDeleteProject}
        bulkDeleteOpen={bulkDeleteOpen}
        setBulkDeleteOpen={setBulkDeleteOpen}
        selectedCount={selectedCount}
        handleBulkDeleteProjects={handleBulkDeleteProjects}
        bulkDeleting={bulkDeleting}
        bulkCrawlPreflightOpen={bulkCrawlPreflightOpen}
        setBulkCrawlPreflightOpen={setBulkCrawlPreflightOpen}
        selectedRunnableProjects={selectedRunnableProjects}
        selectedRunningProjects={selectedRunningProjects}
        estimatedCreditsUsed={estimatedCreditsUsed}
        creditsRemaining={creditsRemaining}
        estimatedCreditsAfterRun={estimatedCreditsAfterRun}
        estimatedOverLimit={estimatedOverLimit}
        bulkCrawling={bulkCrawling}
        executeBulkRunCrawls={executeBulkRunCrawls}
      />
    </div>
  );
}
