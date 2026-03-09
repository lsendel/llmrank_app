import type {
  ChangeEventHandler,
  DragEventHandler,
  ReactNode,
  RefObject,
} from "react";
import { Bot, FileText, Globe, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StateCard, StateMessage } from "@/components/ui/state";
import type { LogAnalysisSummary, LogUpload } from "@/lib/api";
import { botBadgeClass, formatAiBotRate } from "./logs-tab-helpers";

export function LogsTabHeader() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Server Log Analysis</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Upload server logs to see which AI crawlers are visiting your site
      </p>
    </div>
  );
}

export function LogsTabUploadSection({
  fileInputRef,
  uploading,
  error,
  canRetryUpload,
  onBrowse,
  onFileChange,
  onDrop,
  onRetry,
  onDismiss,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  error: string | null;
  canRetryUpload: boolean;
  onBrowse: () => void;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Log File
        </CardTitle>
        <CardDescription>
          Apache or Nginx combined log format (.log, .txt)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          onClick={onBrowse}
        >
          <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">
            {uploading
              ? "Analyzing log file..."
              : "Drop a log file here or click to browse"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Supports Apache/Nginx combined log format
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".log,.txt"
          className="hidden"
          onChange={onFileChange}
        />
        {error && (
          <StateMessage
            variant="error"
            title="Upload failed"
            description={error}
            compact
            className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 px-3"
            action={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  disabled={!canRetryUpload || uploading}
                >
                  Retry upload
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onDismiss}
                >
                  Dismiss
                </Button>
              </div>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

export function LogsTabSummarySection({
  summary,
}: {
  summary: LogAnalysisSummary | null;
}) {
  if (!summary) return null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LogsStatCard
          label="Total Requests"
          value={summary.totalRequests.toLocaleString()}
          icon={<Globe className="h-4 w-4 text-muted-foreground" />}
        />
        <LogsStatCard
          label="Crawler Requests"
          value={summary.crawlerRequests.toLocaleString()}
          icon={<Bot className="h-4 w-4 text-muted-foreground" />}
        />
        <LogsStatCard
          label="Unique IPs"
          value={summary.uniqueIPs.toLocaleString()}
          icon={<Globe className="h-4 w-4 text-muted-foreground" />}
        />
        <LogsStatCard
          label="AI Bot %"
          value={formatAiBotRate(summary)}
          icon={<Bot className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {summary.botBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bot Breakdown</CardTitle>
            <CardDescription>
              AI and search engine crawlers detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.botBreakdown.map((bot) => (
                <div
                  key={bot.bot}
                  className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50"
                >
                  <Badge variant="secondary" className={botBadgeClass(bot.bot)}>
                    {bot.bot}
                  </Badge>
                  <span className="text-sm font-medium tabular-nums">
                    {bot.count.toLocaleString()} requests
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary.topPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Crawled Paths</CardTitle>
            <CardDescription>
              Most frequently visited pages by crawlers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {summary.topPaths.map((path) => (
                <div
                  key={path.path}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <code className="truncate font-mono text-xs">
                    {path.path}
                  </code>
                  <span className="ml-4 shrink-0 tabular-nums text-muted-foreground">
                    {path.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export function LogsTabHistorySection({
  uploads,
  isLoading,
}: {
  uploads: LogUpload[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <StateCard
        variant="loading"
        cardTitle="Upload History"
        description="Loading previous log uploads..."
        contentClassName="p-0"
      />
    );
  }

  if (uploads.length === 0) {
    return (
      <StateCard
        variant="empty"
        cardTitle="Upload History"
        description="No log uploads yet. Upload your first log file to start crawl analysis."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{upload.filename}</span>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>{upload.totalRequests.toLocaleString()} requests</span>
                <span>{upload.crawlerRequests.toLocaleString()} crawlers</span>
                <span className="text-xs">
                  {new Date(upload.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LogsStatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
