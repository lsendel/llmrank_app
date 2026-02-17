"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
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
import { useToast } from "@/components/ui/use-toast";
import { gradeColor } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

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

const PROJECTS_PER_PAGE = 12;

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueueList } from "./_components/queue-list";

// ... existing code ...

export default function ProjectsPage() {
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const {
    data: result,
    isLoading: loading,
    mutate,
  } = useApiSWR(
    `projects-list-${page}`,
    useCallback(
      () => api.projects.list({ page: page + 1, limit: PROJECTS_PER_PAGE }),
      [page],
    ),
  );

  async function handleDeleteProject() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.projects.delete(deleteTarget.id);
      setDeleteTarget(null);
      toast({
        title: "Project deleted",
        description: `"${deleteTarget.name}" has been removed.`,
      });
      mutate();
    } catch {
      toast({ title: "Failed to delete project", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const projects = result?.data ?? [];
  const pagination = result?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your website projects and view their AI-readiness scores.
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
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground">Loading projects...</p>
            </div>
          ) : (
            <>
              {projects.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => {
                    const lastScore = project.latestCrawl?.overallScore ?? null;
                    const hasCrawl = project.latestCrawl != null;

                    return (
                      <Link
                        key={project.id}
                        href={`/dashboard/projects/${project.id}`}
                      >
                        <Card className="group transition-shadow hover:shadow-md">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold group-hover:text-primary">
                                  {project.name}
                                </h3>
                                <p className="mt-0.5 text-sm text-muted-foreground">
                                  {project.domain}
                                </p>
                              </div>
                              {lastScore !== null ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span
                                    className={`text-2xl font-bold ${gradeColor(lastScore)}`}
                                  >
                                    {lastScore}
                                  </span>
                                  <Badge variant={gradeBadgeVariant(lastScore)}>
                                    {gradeLabel(lastScore)}
                                  </Badge>
                                </div>
                              ) : (
                                <Badge variant="secondary">No crawls yet</Badge>
                              )}
                            </div>
                            <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                              {hasCrawl && (
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
                              )}
                              {!hasCrawl && (
                                <span>
                                  Created{" "}
                                  {new Date(
                                    project.createdAt,
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </div>

                            {/* Quick Access Links */}
                            <div className="mt-4 flex items-center justify-between border-t pt-3">
                              <div className="flex items-center gap-1">
                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Link
                                        href={`/dashboard/projects/${project.id}?tab=strategy`}
                                        className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                        onClick={(e) => e.stopPropagation()}
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
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Trophy className="h-4 w-4" />
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent>Competitors</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Link
                                        href={`/dashboard/projects/${project.id}?tab=visibility`}
                                        className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent>Visibility</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider delayDuration={0}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Link
                                        href={`/dashboard/projects/${project.id}?tab=issues`}
                                        className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                        onClick={(e) => e.stopPropagation()}
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
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setDeleteTarget({
                                            id: project.id,
                                            name: project.name,
                                          });
                                        }}
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
                      </Link>
                    );
                  })}
                </div>
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

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {page * PROJECTS_PER_PAGE + 1}–
                    {Math.min((page + 1) * PROJECTS_PER_PAGE, pagination.total)}{" "}
                    of {pagination.total} projects
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <QueueList />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
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
    </div>
  );
}
