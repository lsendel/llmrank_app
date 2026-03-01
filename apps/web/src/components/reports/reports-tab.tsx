"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Loader2, Download, Mail, Trash2 } from "lucide-react";
import { api, ApiError, type Report, type ReportSchedule } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { GenerateReportModal } from "./generate-report-modal";
import { ReportList } from "./report-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Props {
  projectId: string;
  crawlJobId: string | undefined;
}

type ReportAudience = "executive" | "seo_lead" | "content_lead";

const REPORT_AUDIENCE_PRESETS: Record<
  ReportAudience,
  {
    label: string;
    description: string;
    format: "pdf" | "docx";
    type: "summary" | "detailed";
  }
> = {
  executive: {
    label: "Executive Summary",
    description: "High-level outcomes for leadership updates.",
    format: "pdf",
    type: "summary",
  },
  seo_lead: {
    label: "SEO Lead",
    description: "Detailed technical and visibility context for SEO owners.",
    format: "pdf",
    type: "detailed",
  },
  content_lead: {
    label: "Content Lead",
    description: "Detailed findings optimized for editorial execution.",
    format: "docx",
    type: "detailed",
  },
};

const REPORT_AUDIENCE_ORDER: ReportAudience[] = [
  "executive",
  "seo_lead",
  "content_lead",
];

function parseRecipientEmails(rawInput: string): {
  valid: string[];
  invalid: string[];
} {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const token of rawInput.split(/[,\n;]+/g)) {
    const normalized = token.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    if (EMAIL_RE.test(normalized)) {
      valid.push(normalized);
    } else {
      invalid.push(normalized);
    }
  }

  return { valid, invalid };
}

function inferAudienceFromSchedule(
  schedule: ReportSchedule,
): ReportAudience | null {
  const match = REPORT_AUDIENCE_ORDER.find((audience) => {
    const preset = REPORT_AUDIENCE_PRESETS[audience];
    return preset.format === schedule.format && preset.type === schedule.type;
  });
  return match ?? null;
}

export default function ReportsTab({ projectId, crawlJobId }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { toast } = useToast();

  async function handleExport(format: "csv" | "json") {
    if (!crawlJobId) return;
    try {
      const data = await api.crawls.exportData(crawlJobId, format);
      if (format === "csv") {
        const blob = new Blob([data as string], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `crawl-export.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `crawl-export.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      toast({
        title: "Export failed",
        description:
          err instanceof Error ? err.message : "Could not export data",
        variant: "destructive",
      });
    }
  }

  const fetchReports = useCallback(async () => {
    try {
      const list = await api.reports.list(projectId);
      setReports(list);
    } catch {
      // Empty state shown
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Poll for in-progress reports
  useEffect(() => {
    const pending = reports.some(
      (r) => r.status === "queued" || r.status === "generating",
    );
    if (!pending) return;
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, [reports, fetchReports]);

  async function handleDelete(reportId: string) {
    try {
      await api.reports.delete(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err: unknown) {
      toast({
        title: "Failed to delete report",
        description:
          err instanceof Error ? err.message : "Could not delete the report",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={!crawlJobId}>
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleExport("csv")}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("json")}>
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          onClick={() => setShowModal(true)}
          disabled={!crawlJobId}
          size="sm"
        >
          <FileText className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>

      <ReportList
        reports={reports}
        onDelete={handleDelete}
        onRefresh={fetchReports}
      />

      {crawlJobId && (
        <GenerateReportModal
          open={showModal}
          onClose={() => setShowModal(false)}
          projectId={projectId}
          crawlJobId={crawlJobId}
          onGenerated={fetchReports}
        />
      )}

      {/* Auto-Report Settings */}
      <AutoReportSettings
        projectId={projectId}
        crawlJobId={crawlJobId}
        onReportGenerated={fetchReports}
      />
    </div>
  );
}

function AutoReportSettings({
  projectId,
  crawlJobId,
  onReportGenerated,
}: {
  projectId: string;
  crawlJobId?: string;
  onReportGenerated?: () => Promise<void> | void;
}) {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [audience, setAudience] = useState<ReportAudience>("executive");
  const [recipientInput, setRecipientInput] = useState("");
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [type, setType] = useState<"summary" | "detailed">("summary");
  const [saving, setSaving] = useState(false);
  const [sendingNowScheduleId, setSendingNowScheduleId] = useState<
    string | null
  >(null);
  const { toast } = useToast();

  const selectedPreset = REPORT_AUDIENCE_PRESETS[audience];

  const fetchSchedules = useCallback(async () => {
    try {
      const list = await api.reports.schedules.list(projectId);
      setSchedules(list);
      setLocked(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setLocked(true);
      } else if (err instanceof Error) {
        console.warn("[fetchSchedules]", err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  function handleAudienceSelect(nextAudience: ReportAudience) {
    setAudience(nextAudience);
    const preset = REPORT_AUDIENCE_PRESETS[nextAudience];
    setFormat(preset.format);
    setType(preset.type);
  }

  async function handleCreate() {
    if (!recipientInput || locked) return;
    const { valid, invalid } = parseRecipientEmails(recipientInput);
    if (valid.length === 0) {
      toast({
        title: "Add at least one valid email",
        description:
          invalid.length > 0
            ? `Invalid addresses: ${invalid.join(", ")}`
            : "Enter one or more recipient emails.",
        variant: "destructive",
      });
      return;
    }

    if (invalid.length > 0) {
      toast({
        title: "Some emails were ignored",
        description: `Invalid addresses: ${invalid.join(", ")}`,
        variant: "destructive",
      });
    }

    setSaving(true);
    try {
      const created: ReportSchedule[] = [];
      const failed: string[] = [];
      let planLocked = false;

      await Promise.all(
        valid.map(async (recipientEmail) => {
          try {
            const schedule = await api.reports.schedules.create({
              projectId,
              format,
              type,
              recipientEmail,
            });
            created.push(schedule);
          } catch (err) {
            if (err instanceof ApiError && err.status === 403) {
              planLocked = true;
            }
            failed.push(recipientEmail);
          }
        }),
      );

      if (planLocked) {
        setLocked(true);
      }

      if (created.length > 0) {
        setSchedules((prev) => [...prev, ...created]);
        setRecipientInput("");
      }

      if (failed.length === 0) {
        toast({
          title:
            created.length === 1 ? "Schedule created" : "Schedules created",
          description:
            created.length > 1
              ? `${created.length} recipients added.`
              : undefined,
        });
      } else if (created.length > 0) {
        toast({
          title: "Partial success",
          description: `Created ${created.length} schedules. Failed: ${failed.join(", ")}`,
          variant: "destructive",
        });
      } else {
        throw new Error(
          "Could not create report schedules for the provided recipients.",
        );
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setLocked(true);
      }
      toast({
        title: "Failed to create schedule",
        description:
          err instanceof Error ? err.message : "Failed to create schedule",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendNow(schedule: ReportSchedule) {
    if (!crawlJobId) {
      toast({
        title: "No completed crawl yet",
        description: "Run a crawl before sending a scheduled report now.",
        variant: "destructive",
      });
      return;
    }

    setSendingNowScheduleId(schedule.id);
    try {
      await api.reports.generate({
        projectId,
        crawlJobId,
        format: schedule.format,
        type: schedule.type,
        config: { preparedFor: schedule.recipientEmail },
      });
      await onReportGenerated?.();
      toast({
        title: "Report queued",
        description: `A ${schedule.type} ${schedule.format.toUpperCase()} report is generating now.`,
      });
    } catch (err) {
      toast({
        title: "Failed to send now",
        description:
          err instanceof Error ? err.message : "Could not generate the report.",
        variant: "destructive",
      });
    } finally {
      setSendingNowScheduleId(null);
    }
  }

  async function handleToggle(schedule: ReportSchedule) {
    try {
      const updated = await api.reports.schedules.update(schedule.id, {
        enabled: !schedule.enabled,
      });
      setSchedules((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    } catch (err: unknown) {
      toast({
        title: "Failed to update schedule",
        description:
          err instanceof Error ? err.message : "Could not toggle the schedule",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.reports.schedules.delete(id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      toast({
        title: "Failed to delete schedule",
        description:
          err instanceof Error ? err.message : "Could not delete the schedule",
        variant: "destructive",
      });
    }
  }

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Auto-Report Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Automatically generate and email reports after each completed crawl.
          Available on Pro plans and above.
        </p>

        {locked && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Scheduled reports are available on Pro plans and above.
          </div>
        )}

        {!locked && (
          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">1. Choose audience preset</p>
              <p className="text-xs text-muted-foreground">
                Presets configure report depth and output format.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {REPORT_AUDIENCE_ORDER.map((presetAudience) => {
                const preset = REPORT_AUDIENCE_PRESETS[presetAudience];
                const selected = audience === presetAudience;
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
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {preset.type} • {preset.format}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Selected preset:{" "}
              <span className="font-medium">{selectedPreset.label}</span> (
              {selectedPreset.type}, {selectedPreset.format.toUpperCase()})
            </div>
          </div>
        )}

        {/* Existing schedules */}
        {schedules.length > 0 && (
          <div className="space-y-2">
            {schedules.map((schedule) => {
              const inferredAudience = inferAudienceFromSchedule(schedule);
              return (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {schedule.recipientEmail}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {schedule.format.toUpperCase()} &bull;{" "}
                      {schedule.type === "detailed" ? "Detailed" : "Summary"}
                    </p>
                    {inferredAudience && (
                      <p className="text-xs text-muted-foreground">
                        Audience:{" "}
                        {REPORT_AUDIENCE_PRESETS[inferredAudience].label}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        !crawlJobId || sendingNowScheduleId === schedule.id
                      }
                      onClick={() => handleSendNow(schedule)}
                    >
                      {sendingNowScheduleId === schedule.id
                        ? "Sending..."
                        : "Send now"}
                    </Button>
                    <Badge
                      variant={schedule.enabled ? "success" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleToggle(schedule)}
                    >
                      {schedule.enabled ? "Active" : "Paused"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new schedule */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="schedule-email">Recipient Email</Label>
            <Input
              id="schedule-email"
              type="text"
              placeholder="client@example.com, team@example.com"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              disabled={locked}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              2. Add one or more recipients separated by comma, semicolon, or
              new line.
            </p>
          </div>
          <div>
            <Label>Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as "pdf" | "docx")}
              disabled={locked}
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
          <div>
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as "summary" | "detailed")}
              disabled={locked}
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
        <Button
          onClick={handleCreate}
          disabled={saving || !recipientInput || locked}
          size="sm"
        >
          {saving ? "Creating..." : "3. Add Schedule"}
        </Button>
      </CardContent>
    </Card>
  );
}
