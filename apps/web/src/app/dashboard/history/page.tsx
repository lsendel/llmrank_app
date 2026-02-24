"use client";

import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
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
import { ChevronLeft, ChevronRight, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { usePlan } from "@/hooks/use-plan";

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const { isFree } = usePlan();

  const { data, isLoading } = useApiSWR(
    isFree ? null : `crawl-history-${page}`,
    useCallback(() => api.crawls.getHistory(page, limit), [page]),
  );

  const history = data?.data || [];
  const pagination = data?.pagination;

  if (isFree) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Crawl History</h1>
          <p className="text-muted-foreground">
            View all past crawls across all your projects.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="mb-4 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              Crawl history is available on paid plans
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Upgrade to Starter or above to keep a full history of all your
              crawls and track score changes over time.
            </p>
            <Button asChild className="mt-6">
              <Link href="/dashboard/billing">View Plans</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Crawl History</h1>
          <p className="text-muted-foreground">
            View all past crawls across all your projects.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            A log of all crawl jobs performed by your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No crawl history found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {job.projectName || "Unknown Project"}
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
                          <span
                            className={`font-bold ${
                              job.letterGrade === "A"
                                ? "text-green-500"
                                : job.letterGrade === "B"
                                  ? "text-blue-500"
                                  : job.letterGrade === "C"
                                    ? "text-yellow-500"
                                    : "text-red-500"
                            }`}
                          >
                            {job.overallScore}
                          </span>
                          <Badge
                            variant="outline"
                            className="h-5 px-1.5 text-xs"
                          >
                            {job.letterGrade}
                          </Badge>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {job.createdAt &&
                        formatDistanceToNow(new Date(job.createdAt), {
                          addSuffix: true,
                        })}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.status === "complete" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 px-2"
                        >
                          <Link
                            href={`/dashboard/projects/${job.projectId}?crawlId=${job.id}`}
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

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={page === pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
