"use client";

import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  REPORT_AUDIENCE_PRESETS,
  REPORT_AUDIENCE_ORDER,
  type ReportAudience,
} from "./reports-tab-helpers";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  crawlJobId?: string;
  onGenerated: () => void;
  locked?: boolean;
  onCreateSchedule?: (args: {
    recipientInput: string;
    format: "pdf" | "docx";
    type: "summary" | "detailed";
  }) => void | Promise<void>;
  scheduleSaving?: boolean;
}

export function GenerateReportModal({
  open,
  onClose,
  projectId,
  crawlJobId,
  onGenerated,
  locked,
  onCreateSchedule,
  scheduleSaving,
}: Props) {
  const [type, setType] = useState<"summary" | "detailed">("summary");
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [preparedFor, setPreparedFor] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Schedule tab state
  const [schedAudience, setSchedAudience] =
    useState<ReportAudience>("executive");
  const [schedRecipient, setSchedRecipient] = useState("");
  const [schedFormat, setSchedFormat] = useState<"pdf" | "docx">("pdf");
  const [schedType, setSchedType] = useState<"summary" | "detailed">("summary");

  // Reset schedule state when modal closes
  useEffect(() => {
    if (!open) {
      setSchedAudience("executive");
      setSchedRecipient("");
      setSchedFormat("pdf");
      setSchedType("summary");
    }
  }, [open]);

  function handleAudienceSelect(audience: ReportAudience) {
    setSchedAudience(audience);
    const preset = REPORT_AUDIENCE_PRESETS[audience];
    setSchedFormat(preset.format);
    setSchedType(preset.type);
  }

  async function handleGenerate() {
    if (!crawlJobId) return;
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
          <DialogTitle>New Report</DialogTitle>
          <DialogDescription>
            Create a downloadable report for this crawl analysis.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate Now</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4 pt-4">
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

            {!crawlJobId && (
              <p className="text-xs text-muted-foreground">
                Run a crawl first to generate reports.
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || !crawlJobId}
              >
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
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 pt-4">
            {locked ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Scheduled reports are available on Pro plans and above.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Audience Preset</Label>
                  <div className="grid gap-2 grid-cols-3">
                    {REPORT_AUDIENCE_ORDER.map((presetAudience) => {
                      const preset = REPORT_AUDIENCE_PRESETS[presetAudience];
                      const selected = schedAudience === presetAudience;
                      return (
                        <button
                          key={presetAudience}
                          type="button"
                          onClick={() => handleAudienceSelect(presetAudience)}
                          className={`rounded-md border p-3 text-left transition-colors ${
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <p className="text-sm font-medium">{preset.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {preset.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-recipient">Recipient Email</Label>
                  <Input
                    id="schedule-recipient"
                    type="text"
                    placeholder="client@example.com, team@example.com"
                    value={schedRecipient}
                    onChange={(e) => setSchedRecipient(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Separate multiple recipients with commas.
                  </p>
                </div>

                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select
                      value={schedFormat}
                      onValueChange={(v: "pdf" | "docx") => setSchedFormat(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="docx">DOCX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={schedType}
                      onValueChange={(v: "summary" | "detailed") =>
                        setSchedType(v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="summary">Summary</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={scheduleSaving || !schedRecipient || locked}
                onClick={() =>
                  void onCreateSchedule?.({
                    recipientInput: schedRecipient,
                    format: schedFormat,
                    type: schedType,
                  })
                }
              >
                {scheduleSaving ? "Creating..." : "Create Schedule"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
