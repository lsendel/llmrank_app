import Link from "next/link";
import { Bug, Compass, Eye, Trash2, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Project } from "@/lib/api";
import { cn, gradeColor } from "@/lib/utils";
import { normalizeDomain } from "@llm-boost/shared";
import { gradeBadgeVariant, gradeLabel } from "../projects-page-utils";

function ProjectQuickLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className="rounded-md p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary"
          >
            {icon}
          </Link>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ProjectGrid({
  projects,
  selectedIds,
  onToggleProjectSelection,
  onRequestDelete,
}: {
  projects: Project[];
  selectedIds: Set<string>;
  onToggleProjectSelection: (projectId: string) => void;
  onRequestDelete: (target: { id: string; name: string }) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => {
        const lastScore = project.latestCrawl?.overallScore ?? null;
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
                    onCheckedChange={() => onToggleProjectSelection(project.id)}
                    aria-label={`Select ${project.name}`}
                  />
                  {project.faviconUrl && (
                    <img
                      src={project.faviconUrl}
                      alt=""
                      className="mt-0.5 h-5 w-5 rounded-sm"
                    />
                  )}
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
                      project.latestCrawl.status !== "complete" && (
                        <Badge
                          variant={
                            project.latestCrawl.status === "failed"
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
                    <Badge variant={gradeBadgeVariant(lastScore)}>
                      {gradeLabel(lastScore)}
                    </Badge>
                  </div>
                ) : (
                  <Badge variant="secondary">No crawls yet</Badge>
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
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <div className="flex items-center gap-1">
                  <ProjectQuickLink
                    href={`/dashboard/projects/${project.id}?tab=strategy`}
                    label="Strategy"
                    icon={<Compass className="h-4 w-4" />}
                  />
                  <ProjectQuickLink
                    href={`/dashboard/projects/${project.id}?tab=competitors`}
                    label="Competitors"
                    icon={<Trophy className="h-4 w-4" />}
                  />
                  <ProjectQuickLink
                    href={`/dashboard/projects/${project.id}?tab=visibility`}
                    label="Visibility"
                    icon={<Eye className="h-4 w-4" />}
                  />
                  <ProjectQuickLink
                    href={`/dashboard/projects/${project.id}?tab=issues`}
                    label="Issues"
                    icon={<Bug className="h-4 w-4" />}
                  />

                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() =>
                            onRequestDelete({
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
                  <Link href={`/dashboard/projects/${project.id}`}>
                    View Project
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
