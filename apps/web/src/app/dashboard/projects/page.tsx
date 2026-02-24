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
import { api, type Project } from "@/lib/api";
import { normalizeDomain } from "@llm-boost/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueueList } from "./_components/queue-list";
import { PriorityFeedCard } from "./_components/priority-feed-card";

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

export default function ProjectsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const currentPage = parsePage(searchParams.get("page"));
  const rawHealth = searchParams.get("health");
  const rawSort = searchParams.get("sort");
  const searchQuery = searchParams.get("q") ?? "";
  const healthFilter: HealthFilter = VALID_HEALTH_FILTERS.includes(
    rawHealth as HealthFilter,
  )
    ? (rawHealth as HealthFilter)
    : "all";
  const sortBy: SortBy = VALID_SORTS.includes(rawSort as SortBy)
    ? (rawSort as SortBy)
    : "activity_desc";

  const [searchInput, setSearchInput] = useState(searchQuery);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkCrawling, setBulkCrawling] = useState(false);
  const hasBootstrappedPreset = useRef(false);

  const updateParams = useCallback(
    (changes: {
      page?: number;
      q?: string;
      health?: HealthFilter;
      sort?: SortBy;
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
  }, [searchQuery, healthFilter, sortBy, currentPage]);

  const activePreset = useMemo(() => {
    for (const [key, preset] of Object.entries(VIEW_PRESETS)) {
      if (preset.health === healthFilter && preset.sort === sortBy) {
        return key as ViewPreset;
      }
    }
    return null;
  }, [healthFilter, sortBy]);

  const defaultPreset = useMemo(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(DEFAULT_PRESET_STORAGE_KEY);
    if (!stored || !(stored in VIEW_PRESETS)) return null;
    return stored as ViewPreset;
  }, []);

  const applyPreset = useCallback(
    (preset: ViewPreset) => {
      const config = VIEW_PRESETS[preset];
      setSearchInput("");
      updateParams({
        health: config.health,
        sort: config.sort,
        q: undefined,
        page: 1,
      });
    },
    [updateParams],
  );

  useEffect(() => {
    if (hasBootstrappedPreset.current) return;
    hasBootstrappedPreset.current = true;

    const hasQueryOverrides =
      !!searchParams.get("health") ||
      !!searchParams.get("sort") ||
      !!searchParams.get("q");
    if (hasQueryOverrides) return;

    if (defaultPreset) {
      applyPreset(defaultPreset);
    }
  }, [applyPreset, defaultPreset, searchParams]);

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

  const projects = result?.data ?? [];
  const pagination = result?.pagination;
  const totalFiltered = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      updateParams({ page: totalPages });
    }
  }, [currentPage, totalPages, updateParams]);

  const visibleIds = projects.map((project) => project.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

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

  async function handleBulkRunCrawls() {
    if (selectedCount === 0) return;
    setBulkCrawling(true);
    try {
      const ids = [...selectedIds];
      let success = 0;
      let failed = 0;
      for (const projectId of ids) {
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

  function resetFilters() {
    setSearchInput("");
    setSelectedIds(new Set());
    updateParams({
      page: 1,
      q: undefined,
      health: "all",
      sort: "activity_desc",
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
          <PriorityFeedCard />

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground">Loading projects...</p>
            </div>
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
                          disabled={!activePreset}
                          onClick={() => {
                            if (!activePreset) return;
                            localStorage.setItem(
                              DEFAULT_PRESET_STORAGE_KEY,
                              activePreset,
                            );
                            toast({
                              title: "Default view updated",
                              description: `${VIEW_PRESETS[activePreset].label} will load by default.`,
                            });
                          }}
                        >
                          Set As Default View
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                    </CardContent>
                  </Card>

                  {selectedCount > 0 && (
                    <Card>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <p className="text-sm font-medium">
                          {selectedCount} selected
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={handleBulkRunCrawls}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleVisibleSelection}
                      disabled={projects.length === 0}
                    >
                      {allVisibleSelected ? "Unselect Page" : "Select Page"}
                    </Button>
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
    </div>
  );
}
