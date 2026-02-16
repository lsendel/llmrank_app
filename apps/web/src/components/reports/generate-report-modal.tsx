"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  crawlJobId: string;
  onGenerated: () => void;
}

export function GenerateReportModal({
  open,
  onClose,
  projectId,
  crawlJobId,
  onGenerated,
}: Props) {
  const [type, setType] = useState<"summary" | "detailed">("summary");
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [preparedFor, setPreparedFor] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await api.reports.generate({
        projectId,
        crawlJobId,
        type,
        format,
        config: preparedFor ? { preparedFor } : undefined,
      });
      onGenerated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const messages: Record<string, string> = {
          REPORT_SERVICE_UNAVAILABLE:
            "The report service is temporarily unavailable. Please try again in a few minutes.",
          REPORT_SERVICE_TIMEOUT:
            "The report service took too long to respond. Please try again.",
          REPORT_SERVICE_REJECTED:
            "The report service could not process this request. Please contact support if this persists.",
          PLAN_LIMIT_REACHED:
            "You've reached the report generation limit for your plan.",
        };
        setError(messages[err.code] ?? err.message);
      } else {
        setError("Failed to generate report. Please try again.");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
          <DialogDescription>
            Create a downloadable report for this crawl analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select
              value={type}
              onValueChange={(v: "summary" | "detailed") => setType(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Executive Summary (2-4 pages)
                  </div>
                </SelectItem>
                <SelectItem value="detailed">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Detailed Technical Report (10-50+ pages)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <Select
              value={format}
              onValueChange={(v: "pdf" | "docx") => setFormat(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF Document</SelectItem>
                <SelectItem value="docx">Word Document (.docx)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Prepared For (optional)</Label>
            <Input
              placeholder="Client name or company"
              value={preparedFor}
              onChange={(e) => setPreparedFor(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
