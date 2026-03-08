"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type Project, type ProjectsDefaultPreset } from "@/lib/api";
import { normalizeDomain } from "@llm-boost/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectGrid } from "./_components/project-grid";
import { ProjectsFiltersCard } from "./_components/projects-filters-card";
import { ProjectsPortfolioOverview } from "./_components/projects-portfolio-overview";
import { ProjectsSelectionBar } from "./_components/projects-selection-bar";
import { QueueList } from "./_components/queue-list";
import { PriorityFeedCard } from "./_components/priority-feed-card";
import { useProjectsPageSummaries } from "./_hooks/use-projects-page-summaries";
import {
  isInProgress,
  PROJECTS_PER_PAGE,
  STALE_CRAWL_THRESHOLD_DAYS,
} from "./projects-page-utils";
import { StateMessage } from "@/components/ui/state";
import { WorkflowGuidance } from "@/components/ui/workflow-guidance";
import { useUser } from "@/lib/auth-hooks";
import { buildAnomalySmartFix } from "@/lib/anomaly-smart-fixes";
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

type HealthFilter =
  | "all"
  | "good"
  | "needs_work"
  | "poor"
  | "no_crawl"
  | "in_progress"
  | "failed";

type SortBy =
  | "activity_desc"
  | "score_desc"
  | "score_asc"
  | "name_asc"
  | "name_desc"
  | "created_desc"
  | "created_asc";

type ViewPreset = "seo_manager" | "content_lead" | "exec_summary";
type AnomalyFilter =
  | "all"
  | "failed"
  | "stale"
  | "no_crawl"
  | "in_progress"
  | "low_score"
  | "manual_schedule"
  | "pipeline_disabled";
type ActionableAnomalyFilter = Exclude<AnomalyFilter, "all">;

const VALID_HEALTH_FILTERS: HealthFilter[] = [
  "all",
  "good",
  "needs_work",
  "poor",
  "no_crawl",
  "in_progress",
  "failed",
];

const VALID_SORTS: SortBy[] = [
  "activity_desc",
  "score_desc",
  "score_asc",
  "name_asc",
  "name_desc",
  "created_desc",
  "created_asc",
];
const VALID_ANOMALY_FILTERS: AnomalyFilter[] = [
  "all",
  "failed",
  "stale",
  "no_crawl",
  "in_progress",
  "low_score",
  "manual_schedule",
  "pipeline_disabled",
];
const ANOMALY_SHORTCUTS: Record<
  ActionableAnomalyFilter,
  {
    title: string;
    description: string;
    tab: string;
    cta: string;
  }
> = {
  failed: {
    title: "Recover failed crawls",
    description:
      "Open Issues for affected projects to inspect blockers and relaunch stable runs.",
    tab: "issues",
    cta: "Open issues",
  },
  stale: {
    title: "Refresh stale monitoring",
    description:
      "Open Automation to tighten crawl cadence and keep rankings current.",
    tab: "automation",
    cta: "Open automation",
  },
  no_crawl: {
    title: "Run first crawl",
    description:
      "Open Overview for projects with no crawl history and trigger first analysis.",
    tab: "overview",
    cta: "Open overview",
  },
  in_progress: {
    title: "Monitor active jobs",
    description:
      "Open Logs for active crawls to spot stuck stages and resolve them quickly.",
    tab: "logs",
    cta: "Open logs",
  },
  low_score: {
    title: "Prioritize highest-impact fixes",
    description:
      "Open Issues for low-score projects and address core SEO blockers first.",
    tab: "issues",
    cta: "Open issues",
  },
  manual_schedule: {
    title: "Reduce manual overhead",
    description:
      "Open Settings and switch from manual schedule to recurring scans where needed.",
    tab: "settings",
    cta: "Open settings",
  },
  pipeline_disabled: {
    title: "Re-enable automation pipeline",
    description:
      "Open Automation and restore post-crawl auto-run for faster issue remediation.",
    tab: "automation",
    cta: "Open automation",
  },
};

const VIEW_PRESETS: Record<
  ViewPreset,
  {
    label: string;
    health: HealthFilter;
    sort: SortBy;
  }
> = {
  seo_manager: {
    label: "SEO Manager",
    health: "poor",
    sort: "score_asc",
  },
  content_lead: {
    label: "Content Lead",
    health: "needs_work",
    sort: "score_asc",
  },
  exec_summary: {
    label: "Exec Summary",
    health: "all",
    sort: "activity_desc",
  },
};

const DEFAULT_PRESET_STORAGE_KEY = "projects-default-view-preset";
const PROJECTS_LAST_VISIT_STORAGE_KEY = "projects-last-visit-at";

function parsePage(value: string | null): number {
  const n = Number(value ?? "1");
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function lastActivityTimestamp(project: Project): number {
  const reference =
    project.latestCrawl?.createdAt ?? project.updatedAt ?? project.createdAt;
  const timestamp = new Date(reference).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function projectScore(project: Project): number {
  return project.latestCrawl?.overallScore ?? -1;
}

function matchesSearch(project: Project, query: string): boolean {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    project.name.toLowerCase().includes(normalized) ||
    normalizeDomain(project.domain).toLowerCase().includes(normalized)
  );
}

function compareProjectsBySort(a: Project, b: Project, sortBy: SortBy): number {
  switch (sortBy) {
    case "score_desc":
      return projectScore(b) - projectScore(a);
    case "score_asc":
      return projectScore(a) - projectScore(b);
    case "name_asc":
      return a.name.localeCompare(b.name);
    case "name_desc":
      return b.name.localeCompare(a.name);
    case "created_asc":
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case "created_desc":
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    case "activity_desc":
    default:
      return lastActivityTimestamp(b) - lastActivityTimestamp(a);
  }
}

function matchesAnomaly(project: Project, filter: AnomalyFilter): boolean {
  if (filter === "all") return true;
  if (filter === "failed") return project.latestCrawl?.status === "failed";
  if (filter === "no_crawl") return !project.latestCrawl;
  if (filter === "in_progress") return isInProgress(project);
  if (filter === "low_score") {
    const score = project.latestCrawl?.overallScore;
    return score != null && score < 60;
  }
  if (filter === "manual_schedule")
    return project.settings.schedule === "manual";
  if (filter === "pipeline_disabled") {
    return project.pipelineSettings?.autoRunOnCrawl === false;
  }
  if (filter === "stale") {
    const latest = project.latestCrawl;
    if (!latest || latest.status !== "complete") return false;
    const reference = latest.completedAt ?? latest.createdAt;
    const timestamp = new Date(reference).getTime();
    if (!Number.isFinite(timestamp)) return false;
    return (
      Date.now() - timestamp > STALE_CRAWL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
    );
  }
  return false;
}

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
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCrawlPreflightOpen, setBulkCrawlPreflightOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkCrawling, setBulkCrawling] = useState(false);
  const [bulkEnablingPipeline, setBulkEnablingPipeline] = useState(false);
  const [bulkPlanningSmartFixes, setBulkPlanningSmartFixes] = useState(false);
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
    if (selectedCount === 0) return;
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
    if (selectedCount === 0) return;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your portfolio with shareable filters and bulk actions.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      <WorkflowGuidance
        title="Portfolio execution flow"
        description="Keep portfolio operations predictable: narrow scope, select targets, and run bulk actions."
        actions={[
          {
            label: "Create Project",
            href: "/dashboard/projects/new",
            variant: "outline",
          },
          {
            label: "History",
            href: "/dashboard/history",
            variant: "ghost",
          },
        ]}
        steps={[
          {
            title: "Filter to the right portfolio slice",
            description:
              "Use health, anomaly, and sort controls to isolate the projects that need attention now.",
            icon: Search,
          },
          {
            title: "Select projects by outcome",
            description:
              "Use anomaly views to build focused batches for remediation, reruns, or automation updates.",
            icon: Sparkles,
          },
          {
            title: "Execute one-click bulk operations",
            description:
              "Run crawls, enable defaults, or plan smart fixes to convert insights into action quickly.",
            icon: Play,
          },
        ]}
      />

      {lastProjectContext && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Continue where you left off</p>
              <p className="text-xs text-muted-foreground">
                Resume{" "}
                {lastProjectContext.projectName ||
                  lastProjectContext.domain ||
                  "last project"}{" "}
                in {projectTabLabel(lastProjectContext.tab)}.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={lastProjectContextHref(lastProjectContext)}>
                Resume
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="projects" className="w-full">
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-6 space-y-6">
          <ProjectsPortfolioOverview
            effectiveLastVisitedAt={effectiveLastVisitedAt}
            sinceLastVisitSummary={sinceLastVisitSummary}
            anomalySummary={anomalySummary}
            analyzedPortfolioCount={analyzedPortfolioCount}
            totalPortfolioProjects={totalPortfolioProjects}
            anomalyFilter={anomalyFilter}
            onSelectAnomaly={(value) =>
              updateParams({ anomaly: value as AnomalyFilter, page: 1 })
            }
          />

          <PriorityFeedCard />

          {loading ? (
            <StateMessage
              variant="loading"
              title="Loading projects"
              description="Fetching portfolio health, score trends, and anomaly signals."
              className="py-16"
            />
          ) : (
            <>
              {projects.length > 0 || totalFiltered > 0 ? (
                <>
                  <ProjectsFiltersCard
                    searchInput={searchInput}
                    onSearchInputChange={setSearchInput}
                    healthFilter={healthFilter}
                    onHealthChange={(value) =>
                      updateParams({
                        health: value as HealthFilter,
                        page: 1,
                        anomaly: "all",
                      })
                    }
                    sortBy={sortBy}
                    onSortChange={(value) =>
                      updateParams({ sort: value as SortBy, page: 1 })
                    }
                    onReset={resetFilters}
                    presetButtons={presetButtons}
                    onApplyPreset={(preset) =>
                      applyPreset(preset as ViewPreset)
                    }
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

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing{" "}
                      {totalFiltered === 0
                        ? 0
                        : (currentPage - 1) * PROJECTS_PER_PAGE + 1}
                      –
                      {Math.min(currentPage * PROJECTS_PER_PAGE, totalFiltered)}{" "}
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

                  {projects.length > 0 ? (
                    <ProjectGrid
                      projects={projects}
                      selectedIds={selectedIds}
                      onToggleProjectSelection={toggleProjectSelection}
                      onRequestDelete={(target) => setDeleteTarget(target)}
                    />
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-muted-foreground">
                          No projects match the current filters.
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={resetFilters}
                        >
                          Clear Filters
                        </Button>
                      </CardContent>
                    </Card>
                  )}

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
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <QueueList />
        </TabsContent>
      </Tabs>

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
                  selectedRunnableProjects.map((project) => project.id),
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
    </div>
  );
}
