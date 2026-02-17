"use client";

import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, History, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CrawlHistoryChart } from "@/components/score-trend-chart";
import { CrawlComparison } from "@/components/crawl-comparison";

export default function ProjectHistoryPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [comparisonIds, setComparisonIds] = useState<[string, string] | null>(
    null,
  );

  const { data: project } = useApiSWR(
    `project-${projectId}`,
    useCallback(() => api.projects.get(projectId), [projectId]),
  );

  const { data: history, isLoading } = useApiSWR(
    `project-history-${projectId}`,
    useCallback(() => api.crawls.getProjectHistory(projectId), [projectId]),
  );

  const crawls = history?.data || [];
  const completedCrawls = crawls.filter((c) => c.status === "complete");

  const handleCompare = (id: string) => {
    if (!comparisonIds) {
      setComparisonIds([id, ""]);
    } else if (comparisonIds[0] === id) {
      setComparisonIds(null);
    } else if (comparisonIds[0] && !comparisonIds[1]) {
      // Comparison logic usually assumes [older, newer]
      const id1Index = crawls.findIndex((c) => c.id === comparisonIds[0]);
      const id2Index = crawls.findIndex((c) => c.id === id);

      if (id1Index > id2Index) {
        // id1 is older (higher index in desc sorted list)
        setComparisonIds([comparisonIds[0], id]);
      } else {
        setComparisonIds([id, comparisonIds[0]]);
      }
    } else {
      setComparisonIds([id, ""]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/projects/${projectId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Crawl History</h1>
          <p className="text-muted-foreground">
            {project?.name || "Loading..."} — History and trends
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CrawlHistoryChart crawlHistory={crawls} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Recent Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {completedCrawls.length > 0 ? (
                <>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm text-muted-foreground">
                      Latest Score
                    </span>
                    <span className="font-bold text-primary">
                      {completedCrawls[0].overallScore}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-sm text-muted-foreground">
                      Last Crawl
                    </span>
                    <span className="text-sm">
                      {formatDistanceToNow(
                        new Date(completedCrawls[0].createdAt),
                        { addSuffix: true },
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Crawls
                    </span>
                    <span className="text-sm">{completedCrawls.length}</span>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No completed crawls yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {comparisonIds && comparisonIds[1] && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Crawl Comparison</CardTitle>
              <CardDescription>
                Comparing crawl from{" "}
                {new Date(
                  crawls.find((c) => c.id === comparisonIds[0])?.createdAt ||
                    "",
                ).toLocaleDateString()}{" "}
                to{" "}
                {new Date(
                  crawls.find((c) => c.id === comparisonIds[1])?.createdAt ||
                    "",
                ).toLocaleDateString()}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComparisonIds(null)}
            >
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <CrawlComparison
              jobId={comparisonIds[0]}
              otherId={comparisonIds[1]}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Past Crawls</CardTitle>
          <CardDescription>
            Select two crawls to compare their scores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : crawls.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No crawl history found for this project.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crawls.map((job) => (
                  <TableRow
                    key={job.id}
                    className={
                      comparisonIds?.includes(job.id) ? "bg-muted/50" : ""
                    }
                  >
                    <TableCell>
                      {job.status === "complete" && (
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                          checked={comparisonIds?.includes(job.id) || false}
                          onChange={() => handleCompare(job.id)}
                          disabled={
                            !comparisonIds?.includes(job.id) &&
                            comparisonIds?.[0] &&
                            comparisonIds?.[1]
                              ? true
                              : false
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          job.status === "complete"
                            ? "default"
                            : job.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                        className="capitalize"
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {job.pagesScored ?? job.pagesCrawled ?? "-"}
                    </TableCell>
                    <TableCell>
                      {job.overallScore != null ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">
                            {job.overallScore}
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(job.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.status === "complete" && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`/dashboard/projects/${projectId}?crawlId=${job.id}`}
                          >
                            View Report
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
