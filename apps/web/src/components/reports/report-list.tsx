"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Trash2,
  Loader2,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { api, type Report } from "@/lib/api";
import { track } from "@/lib/telemetry";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: Report["status"]) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
  > = {
    queued: "outline",
    generating: "secondary",
    complete: "success",
    failed: "destructive",
  };
  return (
    <Badge variant={variants[status] ?? "outline"}>
      {status === "generating" && (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      )}
      {status}
    </Badge>
  );
}

interface Props {
  reports: Report[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function ReportList({ reports, onDelete }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(report: Report) {
    setDownloading(report.id);
    try {
      const blob = await api.reports.download(report.id);
      track("report.downloaded", {
        format: report.format,
        projectId: report.projectId,
      });
      const ext = report.format === "pdf" ? "pdf" : "docx";
      const filename = `ai-readiness-report-${report.type}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Error handling via toast or similar
    } finally {
      setDownloading(null);
    }
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No reports generated yet. Click &quot;Generate Report&quot; to create
          one.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Format</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {report.type === "summary" ? (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                )}
                {report.type === "summary"
                  ? "Executive Summary"
                  : "Detailed Report"}
              </div>
            </TableCell>
            <TableCell className="text-xs uppercase">{report.format}</TableCell>
            <TableCell>{statusBadge(report.status)}</TableCell>
            <TableCell>{formatFileSize(report.fileSize)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(report.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                {report.status === "complete" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(report)}
                    disabled={downloading === report.id}
                  >
                    {downloading === report.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(report.id)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
