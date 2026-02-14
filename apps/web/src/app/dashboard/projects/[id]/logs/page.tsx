"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Upload, Bot, Globe, FileText } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api, ApiError, type LogAnalysisSummary } from "@/lib/api";

const BOT_COLORS: Record<string, string> = {
  "GPTBot (OpenAI)": "bg-green-100 text-green-800",
  "ChatGPT-User": "bg-green-100 text-green-800",
  "ClaudeBot (Anthropic)": "bg-purple-100 text-purple-800",
  Anthropic: "bg-purple-100 text-purple-800",
  PerplexityBot: "bg-blue-100 text-blue-800",
  "Google Extended": "bg-yellow-100 text-yellow-800",
  Googlebot: "bg-yellow-100 text-yellow-800",
  Bingbot: "bg-cyan-100 text-cyan-800",
  Applebot: "bg-gray-100 text-gray-800",
};

export default function LogsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { withToken } = useApi();

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestSummary, setLatestSummary] = useState<LogAnalysisSummary | null>(
    null,
  );

  const {
    data: uploads,
    isLoading,
    mutate,
  } = useApiSWR(
    `logs-${projectId}`,
    useCallback(
      (token: string) => api.logs.list(token, projectId),
      [projectId],
    ),
  );

  async function handleFileUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const content = await file.text();
      await withToken(async (token) => {
        const result = await api.logs.upload(token, projectId, {
          filename: file.name,
          content,
        });
        setLatestSummary(result.summary);
        mutate();
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to upload log file. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  const summary = latestSummary ?? uploads?.[0]?.summary;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/projects/${projectId}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Server Log Analysis
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Upload server logs to see which AI crawlers are visiting your site
        </p>
      </div>

      {/* Upload area */}
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
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
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
            onChange={handleFileChange}
          />
          {error && (
            <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary stats */}
      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Requests"
              value={summary.totalRequests.toLocaleString()}
              icon={<Globe className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              label="Crawler Requests"
              value={summary.crawlerRequests.toLocaleString()}
              icon={<Bot className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              label="Unique IPs"
              value={summary.uniqueIPs.toLocaleString()}
              icon={<Globe className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              label="AI Bot %"
              value={
                summary.totalRequests > 0
                  ? `${((summary.crawlerRequests / summary.totalRequests) * 100).toFixed(1)}%`
                  : "0%"
              }
              icon={<Bot className="h-4 w-4 text-muted-foreground" />}
            />
          </div>

          {/* Bot breakdown */}
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
                  {summary.botBreakdown.map((b) => (
                    <div
                      key={b.bot}
                      className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50"
                    >
                      <Badge
                        variant="secondary"
                        className={BOT_COLORS[b.bot] ?? ""}
                      >
                        {b.bot}
                      </Badge>
                      <span className="text-sm font-medium tabular-nums">
                        {b.count.toLocaleString()} requests
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top paths */}
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
                  {summary.topPaths.map((p) => (
                    <div
                      key={p.path}
                      className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50"
                    >
                      <code className="truncate font-mono text-xs">
                        {p.path}
                      </code>
                      <span className="ml-4 shrink-0 tabular-nums text-muted-foreground">
                        {p.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Past uploads */}
      {!isLoading && uploads && uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploads.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{u.filename}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{u.totalRequests.toLocaleString()} requests</span>
                    <span>{u.crawlerRequests.toLocaleString()} crawlers</span>
                    <span className="text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
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
