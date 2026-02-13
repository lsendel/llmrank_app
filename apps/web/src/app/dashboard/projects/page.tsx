"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type Project } from "@/lib/api";

function gradeColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
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

export default function ProjectsPage() {
  const { data: result, isLoading: loading } = useApiSWR(
    "projects-list",
    useCallback((token: string) => api.projects.list(token), []),
  );

  const projects = result?.data ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Projects grid */}
      {projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const lastScore = project.latestCrawl?.overallScore ?? null;
            const hasCrawl = project.latestCrawl != null;

            return (
              <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
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
                            {project.latestCrawl!.pagesScored} pages scored
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
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
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
    </div>
  );
}
