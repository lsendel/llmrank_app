import { Download, FileText, Loader2, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ReportSchedule } from "@/lib/api";
import {
  inferAudienceFromSchedule,
  REPORT_AUDIENCE_ORDER,
  REPORT_AUDIENCE_PRESETS,
  type ReportAudience,
} from "./reports-tab-helpers";

export function ReportsTabLoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ReportsTabToolbar({
  crawlJobId,
  onExport,
  onOpenGenerate,
}: {
  crawlJobId?: string;
  onExport: (format: "csv" | "json") => void | Promise<void>;
  onOpenGenerate: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={!crawlJobId}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => void onExport("csv")}>
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void onExport("json")}>
            Export as JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button onClick={onOpenGenerate} disabled={!crawlJobId} size="sm">
        <FileText className="mr-2 h-4 w-4" />
        Generate Report
      </Button>
    </div>
  );
}

export function AutoReportSettingsSection({
  crawlJobId,
  schedules,
  locked,
  audience,
  recipientInput,
  format,
  type,
  saving,
  sendingNowScheduleId,
  selectedPreset,
  onAudienceSelect,
  onRecipientInputChange,
  onFormatChange,
  onTypeChange,
  onCreate,
  onSendNow,
  onToggle,
  onDelete,
}: {
  crawlJobId?: string;
  schedules: ReportSchedule[];
  locked: boolean;
  audience: ReportAudience;
  recipientInput: string;
  format: "pdf" | "docx";
  type: "summary" | "detailed";
  saving: boolean;
  sendingNowScheduleId: string | null;
  selectedPreset: (typeof REPORT_AUDIENCE_PRESETS)[ReportAudience];
  onAudienceSelect: (audience: ReportAudience) => void;
  onRecipientInputChange: (value: string) => void;
  onFormatChange: (format: "pdf" | "docx") => void;
  onTypeChange: (type: "summary" | "detailed") => void;
  onCreate: () => void | Promise<void>;
  onSendNow: (schedule: ReportSchedule) => void | Promise<void>;
  onToggle: (schedule: ReportSchedule) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}) {
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
                    onClick={() => onAudienceSelect(presetAudience)}
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
              <span className="font-medium">{selectedPreset.label}</span>(
              {selectedPreset.type}, {selectedPreset.format.toUpperCase()})
            </div>
          </div>
        )}

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
                      {schedule.format.toUpperCase()} •{" "}
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
                      onClick={() => void onSendNow(schedule)}
                    >
                      {sendingNowScheduleId === schedule.id
                        ? "Sending..."
                        : "Send now"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={schedule.enabled ? "default" : "outline"}
                      aria-pressed={schedule.enabled}
                      onClick={() => void onToggle(schedule)}
                    >
                      {schedule.enabled ? "Active" : "Paused"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void onDelete(schedule.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="schedule-email">Recipient Email</Label>
            <Input
              id="schedule-email"
              type="text"
              placeholder="client@example.com, team@example.com"
              value={recipientInput}
              onChange={(event) => onRecipientInputChange(event.target.value)}
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
              onValueChange={onFormatChange}
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
            <Select value={type} onValueChange={onTypeChange} disabled={locked}>
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
          onClick={() => void onCreate()}
          disabled={saving || !recipientInput || locked}
          size="sm"
        >
          {saving ? "Creating..." : "3. Add Schedule"}
        </Button>
      </CardContent>
    </Card>
  );
}
