import { memo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRightLeft,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StateCard } from "@/components/ui/state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CrawledPage } from "@/lib/api";
import { cn, gradeColor } from "@/lib/utils";
import {
  getAriaSort,
  type SortDirection,
  type SortField,
} from "./pages-tab-helpers";

export function PagesTabEmptyState() {
  return (
    <StateCard
      variant="empty"
      description="No pages crawled yet. Run a crawl to see page-level results."
      contentClassName="p-0"
    />
  );
}

export function PagesTabRedirectToggle({
  redirectCount,
  showRedirects,
  onShowRedirectsChange,
}: {
  redirectCount: number;
  showRedirects: boolean;
  onShowRedirectsChange: (checked: boolean) => void;
}) {
  if (redirectCount <= 0) return null;

  return (
    <div className="flex items-center gap-2 border-b px-4 py-2">
      <label className="cursor-pointer select-none flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={showRedirects}
          onChange={(event) => onShowRedirectsChange(event.target.checked)}
          className="rounded border-input"
        />
        Show redirects ({redirectCount})
      </label>
    </div>
  );
}

export function PagesTabTable({
  pages,
  projectId,
  sortField,
  sortDir,
  expandedRow,
  onSort,
  onToggleExpandedRow,
}: {
  pages: CrawledPage[];
  projectId: string;
  sortField: SortField;
  sortDir: SortDirection;
  expandedRow: string | null;
  onSort: (field: SortField) => void;
  onToggleExpandedRow: (pageId: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead
            field="url"
            currentField={sortField}
            currentDir={sortDir}
            onSort={onSort}
          >
            URL
          </SortableHead>
          <SortableHead
            field="statusCode"
            currentField={sortField}
            currentDir={sortDir}
            onSort={onSort}
          >
            Status
          </SortableHead>
          <SortableHead
            field="title"
            currentField={sortField}
            currentDir={sortDir}
            onSort={onSort}
          >
            Title
          </SortableHead>
          <SortableHead
            field="overallScore"
            currentField={sortField}
            currentDir={sortDir}
            onSort={onSort}
          >
            Score
          </SortableHead>
          <SortableHead
            field="issueCount"
            currentField={sortField}
            currentDir={sortDir}
            onSort={onSort}
          >
            Issues
          </SortableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pages.map((page) => {
          const isExpanded = expandedRow === page.id;

          return (
            <PageTableRow
              key={page.id}
              page={page}
              projectId={projectId}
              isExpanded={isExpanded}
              onToggleExpandedRow={onToggleExpandedRow}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

function SortableHead({
  field,
  currentField,
  currentDir,
  onSort,
  children,
}: {
  field: SortField;
  currentField: SortField;
  currentDir: SortDirection;
  onSort: (field: SortField) => void;
  children: string;
}) {
  return (
    <TableHead
      aria-sort={getAriaSort(field, currentField, currentDir)}
      className="cursor-pointer hover:text-foreground"
      onClick={() => onSort(field)}
    >
      {children}{" "}
      <SortIndicator
        field={field}
        currentField={currentField}
        currentDir={currentDir}
      />
    </TableHead>
  );
}

const PageTableRow = memo(function PageTableRow({
  page,
  projectId,
  isExpanded,
  onToggleExpandedRow,
}: {
  page: CrawledPage;
  projectId: string;
  isExpanded: boolean;
  onToggleExpandedRow: (pageId: string) => void;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer focus-within:bg-muted/30"
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        onClick={() => onToggleExpandedRow(page.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleExpandedRow(page.id);
          }
        }}
      >
        <TableCell className="font-mono text-xs">
          <span className="inline-flex items-center gap-1.5">
            {page.url}
            {page.isCrossDomainRedirect && (
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 font-normal gap-0.5"
              >
                <ArrowRightLeft className="h-3 w-3" />
                redirect
              </Badge>
            )}
          </span>
        </TableCell>
        <TableCell>
          <Badge variant={page.statusCode === 200 ? "success" : "destructive"}>
            {page.statusCode}
          </Badge>
        </TableCell>
        <TableCell>{page.title ?? "--"}</TableCell>
        <TableCell>
          <span
            className={cn(
              "font-semibold",
              page.overallScore != null ? gradeColor(page.overallScore) : "",
            )}
          >
            {page.overallScore ?? "--"}
          </span>
        </TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
            {page.issueCount}
          </span>
        </TableCell>
      </TableRow>
      {isExpanded && <ExpandedPageRow page={page} projectId={projectId} />}
    </>
  );
});

function ExpandedPageRow({
  page,
  projectId,
}: {
  page: CrawledPage;
  projectId: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={5} className="bg-muted/30 p-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <ScoreBlock label="Technical" value={page.technicalScore} />
          <ScoreBlock label="Content" value={page.contentScore} />
          <ScoreBlock label="AI Readiness" value={page.aiReadinessScore} />
          <ScoreBlock label="Performance" value={page.performanceScore} />
        </div>

        {page.isCrossDomainRedirect && page.redirectUrl && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <p className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
              <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
              <span>
                Redirects to:{" "}
                <a
                  href={page.redirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:no-underline"
                >
                  {page.redirectUrl}
                </a>
              </span>
            </p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
            <Link href={`/dashboard/projects/${projectId}/pages/${page.id}`}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              View Details
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
            <a href={page.url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open Page
            </a>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ScoreBlock({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value ?? "--"}</p>
    </div>
  );
}

function SortIndicator({
  field,
  currentField,
  currentDir,
}: {
  field: SortField;
  currentField: SortField;
  currentDir: SortDirection;
}) {
  if (currentField !== field) return null;
  return <span className="ml-1">{currentDir === "asc" ? "^" : "v"}</span>;
}

export function PagesTabCard({ children }: { children: React.ReactNode }) {
  return <Card>{children}</Card>;
}
