"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Compass,
  Trophy,
  Eye,
  Bug,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
  AlertTriangle,
  Play,
  Search,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { cn, gradeColor } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type Project, type ProjectsDefaultPreset } from "@/lib/api";
import { normalizeDomain } from "@llm-boost/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueueList } from "./_components/queue-list";
import { PriorityFeedCard } from "./_components/priority-feed-card";
import { StateMessage } from "@/components/ui/state";

const PROJECTS_PER_PAGE = 12;

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
const STALE_CRAWL_THRESHOLD_DAYS = 14;

function isViewPreset(value: string | null | undefined): value is ViewPreset {
  if (!value) return false;
  return value in VIEW_PRESETS;
}

function defaultPresetFromPersona(persona?: string | null): ViewPreset {
  if (persona === "agency" || persona === "freelancer") return "seo_manager";
  if (persona === "in_house" || persona === "developer") return "content_lead";
  return "exec_summary";
}

function gradeBadgeVariant(
  score: number,
): "success" | "warning" | "destructive" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "destructive";
}

function gradeLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 60) return "Needs Work";
  return "Poor";
}

function parsePage(value: string | null): number {
  const n = Number(value ?? "1");
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function isInProgress(project: Project): boolean {
  const status = project.latestCrawl?.status;
  return status === "pending" || status === "crawling" || status === "scoring";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const currentPage = parsePage(searchParams.get("page"));
  const rawHealth = searchParams.get("health");
  const rawSort = searchParams.get("sort");
  const rawAnomaly = searchParams.get("anomaly");
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
  const [savingDefaultPreset, setSavingDefaultPreset] = useState(false);
  const [lastVisitedAt, setLastVisitedAt] = useState<string | null>(null);
  const hasBootstrappedPreset = useRef(false);

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

  const defaultPreset = useMemo(() => {
    const serverPreset = isViewPreset(
      accountPreferences?.projectsDefaultPreset ?? null,
    )
      ? accountPreferences?.projectsDefaultPreset
      : null;
    if (serverPreset) return serverPreset;

    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(DEFAULT_PRESET_STORAGE_KEY);
    if (isViewPreset(stored)) return stored;

    return defaultPresetFromPersona(accountMe?.persona);
  }, [accountMe?.persona, accountPreferences?.projectsDefaultPreset]);

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

  useEffect(() => {
    if (hasBootstrappedPreset.current) return;
    if (accountPreferencesLoading || accountMeLoading) return;
    hasBootstrappedPreset.current = true;

    const hasQueryOverrides =
      !!searchParams.get("health") ||
      !!searchParams.get("sort") ||
      !!searchParams.get("q") ||
      !!searchParams.get("anomaly");
    if (hasQueryOverrides) return;

    if (defaultPreset) {
      applyPreset(defaultPreset);
    }
  }, [
    accountMeLoading,
    accountPreferencesLoading,
    applyPreset,
    defaultPreset,
    searchParams,
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

  const sinceLastVisitSummary = useMemo(() => {
    const activity = recentActivity ?? [];
    if (activity.length === 0) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
      };
    }

    const since = lastVisitedAt
      ? new Date(lastVisitedAt).getTime()
      : Number.NEGATIVE_INFINITY;

    const fresh = activity.filter((entry) => {
      const created = new Date(entry.createdAt).getTime();
      return Number.isFinite(created) && created > since;
    });

    return {
      total: fresh.length,
      completed: fresh.filter((entry) => entry.status === "complete").length,
      failed: fresh.filter((entry) => entry.status === "failed").length,
      running: fresh.filter(
        (entry) =>
          entry.status === "pending" ||
          entry.status === "crawling" ||
          entry.status === "scoring",
      ).length,
    };
  }, [lastVisitedAt, recentActivity]);

  const anomalySummary = useMemo(() => {
    const now = Date.now();
    const staleThresholdMs = STALE_CRAWL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    return {
      failed: anomalyProjects.filter(
        (project) => project.latestCrawl?.status === "failed",
      ).length,
      stale: anomalyProjects.filter((project) => {
        const latest = project.latestCrawl;
        if (!latest || latest.status !== "complete") return false;
        const reference = latest.completedAt ?? latest.createdAt;
        const timestamp = new Date(reference).getTime();
        if (!Number.isFinite(timestamp)) return false;
        return now - timestamp > staleThresholdMs;
      }).length,
      noCrawl: anomalyProjects.filter((project) => !project.latestCrawl).length,
      inProgress: anomalyProjects.filter(isInProgress).length,
      lowScore: anomalyProjects.filter(
        (project) => (project.latestCrawl?.overallScore ?? 100) < 60,
      ).length,
      manualSchedule: anomalyProjects.filter(
        (project) => project.settings.schedule === "manual",
      ).length,
      pipelineDisabled: anomalyProjects.filter(
        (project) => project.pipelineSettings?.autoRunOnCrawl === false,
      ).length,
    };
  }, [anomalyProjects]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const previous = localStorage.getItem(PROJECTS_LAST_VISIT_STORAGE_KEY);
    setLastVisitedAt(previous);
    localStorage.setItem(
      PROJECTS_LAST_VISIT_STORAGE_KEY,
      new Date().toISOString(),
    );
  }, []);

  const pageSummary = useMemo(() => {
    const withScore = projects.filter(
      (project) => project.latestCrawl?.overallScore != null,
    );
    return {
      good: withScore.filter(
        (project) => (project.latestCrawl?.overallScore ?? 0) >= 80,
      ).length,
      needsWork: withScore.filter((project) => {
        const score = project.latestCrawl?.overallScore ?? 0;
        return score >= 60 && score < 80;
      }).length,
      poor: withScore.filter(
        (project) => (project.latestCrawl?.overallScore ?? 0) < 60,
      ).length,
      inProgress: projects.filter(isInProgress).length,
    };
  }, [projects]);

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

      <Tabs defaultValue="projects" className="w-full">
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-6 space-y-6">
          <Card>
            <CardContent className="grid gap-4 p-4 lg:grid-cols-2">
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-semibold">Since Last Visit</p>
                {!lastVisitedAt ? (
                  <p className="text-xs text-muted-foreground">
                    First portfolio visit in this browser.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Since {new Date(lastVisitedAt).toLocaleString()}
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
                    {anomalySummary.stale} stale ({STALE_CRAWL_THRESHOLD_DAYS}
                    d+)
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
                  <Button
                    size="sm"
                    variant={anomalyFilter === "failed" ? "default" : "outline"}
                    onClick={() => updateParams({ anomaly: "failed", page: 1 })}
                  >
                    Failed
                  </Button>
                  <Button
                    size="sm"
                    variant={anomalyFilter === "stale" ? "default" : "outline"}
                    onClick={() => updateParams({ anomaly: "stale", page: 1 })}
                  >
                    Stale
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      anomalyFilter === "no_crawl" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateParams({ anomaly: "no_crawl", page: 1 })
                    }
                  >
                    No Crawl
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      anomalyFilter === "in_progress" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateParams({ anomaly: "in_progress", page: 1 })
                    }
                  >
                    In Progress
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      anomalyFilter === "low_score" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateParams({ anomaly: "low_score", page: 1 })
                    }
                  >
                    Low Score
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      anomalyFilter === "manual_schedule"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateParams({ anomaly: "manual_schedule", page: 1 })
                    }
                  >
                    Manual Schedule
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      anomalyFilter === "pipeline_disabled"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      updateParams({ anomaly: "pipeline_disabled", page: 1 })
                    }
                  >
                    Pipeline Disabled
                  </Button>
                  <Button
                    size="sm"
                    variant={anomalyFilter === "all" ? "default" : "outline"}
                    onClick={() => updateParams({ anomaly: "all", page: 1 })}
                  >
                    All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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
                  <Card>
                    <CardContent className="space-y-4 p-4">
                      <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search projects by name or domain"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-8"
                          />
                        </div>

                        <Select
                          value={healthFilter}
                          onValueChange={(value) =>
                            updateParams({
                              health: value as HealthFilter,
                              page: 1,
                              anomaly: "all",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              All Health States
                            </SelectItem>
                            <SelectItem value="good">Good (80+)</SelectItem>
                            <SelectItem value="needs_work">
                              Needs Work (60-79)
                            </SelectItem>
                            <SelectItem value="poor">Poor (&lt;60)</SelectItem>
                            <SelectItem value="in_progress">
                              Crawl In Progress
                            </SelectItem>
                            <SelectItem value="failed">
                              Last Crawl Failed
                            </SelectItem>
                            <SelectItem value="no_crawl">
                              No Crawls Yet
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={sortBy}
                          onValueChange={(value) =>
                            updateParams({
                              sort: value as SortBy,
                              page: 1,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="activity_desc">
                              Latest Activity
                            </SelectItem>
                            <SelectItem value="score_desc">
                              Score: High to Low
                            </SelectItem>
                            <SelectItem value="score_asc">
                              Score: Low to High
                            </SelectItem>
                            <SelectItem value="name_asc">
                              Name: A to Z
                            </SelectItem>
                            <SelectItem value="name_desc">
                              Name: Z to A
                            </SelectItem>
                            <SelectItem value="created_desc">
                              Newest Created
                            </SelectItem>
                            <SelectItem value="created_asc">
                              Oldest Created
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Button variant="outline" onClick={resetFilters}>
                          Reset
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {(
                          Object.entries(VIEW_PRESETS) as Array<
                            [ViewPreset, (typeof VIEW_PRESETS)[ViewPreset]]
                          >
                        ).map(([key, preset]) => (
                          <Button
                            key={key}
                            size="sm"
                            variant={
                              activePreset === key ? "default" : "outline"
                            }
                            onClick={() => applyPreset(key)}
                          >
                            {preset.label}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!activePreset || savingDefaultPreset}
                          onClick={async () => {
                            if (!activePreset) return;
                            localStorage.setItem(
                              DEFAULT_PRESET_STORAGE_KEY,
                              activePreset,
                            );
                            setSavingDefaultPreset(true);
                            try {
                              const updated =
                                await api.account.updatePreferences({
                                  projectsDefaultPreset:
                                    activePreset as ProjectsDefaultPreset,
                                });
                              await mutateAccountPreferences(updated, {
                                revalidate: false,
                              });
                              toast({
                                title: "Default view updated",
                                description: `${VIEW_PRESETS[activePreset].label} will load by default.`,
                              });
                            } catch {
                              toast({
                                title: "Saved only on this browser",
                                description:
                                  "Could not sync default view to your account right now.",
                                variant: "warning",
                              });
                            } finally {
                              setSavingDefaultPreset(false);
                            }
                          }}
                        >
                          {savingDefaultPreset ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Set As Default View"
                          )}
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {usingAnomalyView && (
                          <Badge variant="default">
                            anomaly: {anomalyFilter.replace(/_/g, " ")}
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          {totalFiltered} matching
                        </Badge>
                        <Badge variant="success">
                          {pageSummary.good} good (page)
                        </Badge>
                        <Badge variant="warning">
                          {pageSummary.needsWork} needs work (page)
                        </Badge>
                        <Badge variant="destructive">
                          {pageSummary.poor} poor (page)
                        </Badge>
                        <Badge variant="info">
                          {pageSummary.inProgress} in progress (page)
                        </Badge>
                      </div>

                      {activeAnomalyShortcut && (
                        <div className="rounded-lg border border-dashed p-3">
                          <p className="text-sm font-medium">
                            {activeAnomalyShortcut.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activeAnomalyShortcut.description}
                          </p>
                          {anomalyShortcutTargets.length > 0 ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {anomalyShortcutTargets.map((project) => (
                                <Button
                                  key={project.id}
                                  size="sm"
                                  variant="outline"
                                  asChild
                                >
                                  <Link
                                    href={`/dashboard/projects/${project.id}?tab=${activeAnomalyShortcut.tab}`}
                                  >
                                    {activeAnomalyShortcut.cta}: {project.name}
                                  </Link>
                                </Button>
                              ))}
                              {anomalyFilteredProjects.length >
                                anomalyShortcutTargets.length && (
                                <Badge variant="secondary">
                                  +
                                  {anomalyFilteredProjects.length -
                                    anomalyShortcutTargets.length}{" "}
                                  more matching projects
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">
                              No projects match this anomaly and search query.
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {selectedCount > 0 && (
                    <Card>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <p className="text-sm font-medium">
                          {selectedCount} selected
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {anomalyFilter === "pipeline_disabled" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void handleEnablePipelineDefaults()
                              }
                              disabled={
                                bulkEnablingPipeline ||
                                selectedPipelineDisabledProjects.length === 0
                              }
                            >
                              {bulkEnablingPipeline ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Enable Pipeline Defaults
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={openBulkCrawlPreflight}
                            disabled={bulkCrawling}
                          >
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
                            onClick={() => setBulkDeleteOpen(true)}
                            disabled={bulkDeleting}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedIds(new Set())}
                          >
                            Clear Selection
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {projects.map((project) => {
                        const lastScore =
                          project.latestCrawl?.overallScore ?? null;
                        const hasCrawl = project.latestCrawl != null;
                        const isSelected = selectedIds.has(project.id);

                        return (
                          <Card
                            key={project.id}
                            className={cn(
                              "group transition-shadow hover:shadow-md",
                              isSelected && "ring-2 ring-primary/40",
                            )}
                          >
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() =>
                                      toggleProjectSelection(project.id)
                                    }
                                    aria-label={`Select ${project.name}`}
                                  />
                                  <div>
                                    <Link
                                      href={`/dashboard/projects/${project.id}`}
                                      className="font-semibold hover:text-primary"
                                    >
                                      {project.name}
                                    </Link>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                      {normalizeDomain(project.domain)}
                                    </p>
                                    {project.latestCrawl &&
                                      project.latestCrawl.status !==
                                        "complete" && (
                                        <Badge
                                          variant={
                                            project.latestCrawl.status ===
                                            "failed"
                                              ? "destructive"
                                              : "secondary"
                                          }
                                          className="mt-2 capitalize"
                                        >
                                          {project.latestCrawl.status}
                                        </Badge>
                                      )}
                                  </div>
                                </div>

                                {lastScore !== null ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span
                                      className={`text-2xl font-bold ${gradeColor(lastScore)}`}
                                    >
                                      {lastScore}
                                    </span>
                                    <Badge
                                      variant={gradeBadgeVariant(lastScore)}
                                    >
                                      {gradeLabel(lastScore)}
                                    </Badge>
                                  </div>
                                ) : (
                                  <Badge variant="secondary">
                                    No crawls yet
                                  </Badge>
                                )}
                              </div>

                              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                                {hasCrawl ? (
                                  <>
                                    <span>
                                      {project.latestCrawl!.pagesCrawled ??
                                        project.latestCrawl!.pagesScored ??
                                        0}{" "}
                                      pages scanned
                                    </span>
                                    {project.latestCrawl!.completedAt && (
                                      <span>
                                        Last crawl:{" "}
                                        {new Date(
                                          project.latestCrawl!.completedAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span>
                                    Created{" "}
                                    {new Date(
                                      project.createdAt,
                                    ).toLocaleDateString()}
                                  </span>
                                )}
                              </div>

                              <div className="mt-4 flex items-center justify-between border-t pt-3">
                                <div className="flex items-center gap-1">
                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Link
                                          href={`/dashboard/projects/${project.id}?tab=strategy`}
                                          className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                        >
                                          <Compass className="h-4 w-4" />
                                        </Link>
                                      </TooltipTrigger>
                                      <TooltipContent>Strategy</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Link
                                          href={`/dashboard/projects/${project.id}?tab=competitors`}
                                          className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                        >
                                          <Trophy className="h-4 w-4" />
                                        </Link>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Competitors
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Link
                                          href={`/dashboard/projects/${project.id}?tab=visibility`}
                                          className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Link>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Visibility
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Link
                                          href={`/dashboard/projects/${project.id}?tab=issues`}
                                          className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                        >
                                          <Bug className="h-4 w-4" />
                                        </Link>
                                      </TooltipTrigger>
                                      <TooltipContent>Issues</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                          onClick={() =>
                                            setDeleteTarget({
                                              id: project.id,
                                              name: project.name,
                                            })
                                          }
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  asChild
                                >
                                  <Link
                                    href={`/dashboard/projects/${project.id}`}
                                  >
                                    View Project
                                  </Link>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
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
