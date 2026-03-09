import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { type CrawlJob } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StateMessage } from "@/components/ui/state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkflowGuidance } from "@/components/ui/workflow-guidance";
import {
  getHistoryScoreClassName,
  getHistoryStatusVariant,
  getHistoryWorkflowContent,
} from "../history-page-helpers";

export function HistoryPageHeader() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Crawl History</h1>
      <p className="text-muted-foreground">
        View all past crawls across all your projects.
      </p>
    </div>
  );
}

export function HistoryWorkflowCard({ isFree }: { isFree: boolean }) {
  const workflow = getHistoryWorkflowContent(isFree);

  return (
    <WorkflowGuidance
      title="History workflow"
      description={workflow.description}
      actions={workflow.actions}
      steps={workflow.steps}
    />
  );
}

export function HistoryLockedState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <Lock className="mb-4 h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">
          Crawl history is available on paid plans
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Upgrade to Starter or above to keep a full history of all your crawls
          and track score changes over time.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/billing">View Plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function HistoryTableCard({
  history,
  isLoading,
  page,
  pagination,
  onPreviousPage,
  onNextPage,
}: {
  history: CrawlJob[];
  isLoading: boolean;
  page: number;
  pagination: { totalPages: number } | null;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          A log of all crawl jobs performed by your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <StateMessage
            variant="loading"
            title="Loading crawl history"
            description="Fetching recent crawl runs across your projects."
            compact
            className="py-10"
          />
        ) : history.length === 0 ? (
          <StateMessage
            variant="empty"
            title="No crawl history yet"
            description="Run your first crawl to populate this timeline and start trend tracking."
            compact
            className="py-10"
            action={
              <Button asChild size="sm">
                <Link href="/dashboard/projects">Start Crawl</Link>
              </Button>
            }
          />
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
                      variant={getHistoryStatusVariant(job.status)}
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
                          className={`font-bold ${getHistoryScoreClassName(job.letterGrade)}`}
                        >
                          {job.overallScore}
                        </span>
                        <Badge variant="outline" className="h-5 px-1.5 text-xs">
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
                    {job.status === "complete" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-8 px-2"
                      >
                        <Link
                          href={`/dashboard/projects/${job.projectId}?tab=reports&crawlId=${job.id}`}
                        >
                          View Report
                        </Link>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {pagination && pagination.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousPage}
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
              onClick={onNextPage}
              disabled={page === pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
