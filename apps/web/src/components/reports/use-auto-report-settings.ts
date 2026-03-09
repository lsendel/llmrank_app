import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { api, ApiError, type ReportSchedule } from "@/lib/api";
import {
  REPORT_AUDIENCE_PRESETS,
  type ReportAudience,
  parseRecipientEmails,
} from "./reports-tab-helpers";

type UseAutoReportSettingsArgs = {
  projectId: string;
  crawlJobId?: string;
  onReportGenerated?: () => Promise<void> | void;
};

export function useAutoReportSettings({
  projectId,
  crawlJobId,
  onReportGenerated,
}: UseAutoReportSettingsArgs) {
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
    void fetchSchedules();
  }, [fetchSchedules]);

  const handleAudienceSelect = useCallback((nextAudience: ReportAudience) => {
    setAudience(nextAudience);
    const preset = REPORT_AUDIENCE_PRESETS[nextAudience];
    setFormat(preset.format);
    setType(preset.type);
  }, []);

  const handleCreate = useCallback(async () => {
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
  }, [format, locked, projectId, recipientInput, toast, type]);

  const handleSendNow = useCallback(
    async (schedule: ReportSchedule) => {
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
            err instanceof Error
              ? err.message
              : "Could not generate the report.",
          variant: "destructive",
        });
      } finally {
        setSendingNowScheduleId(null);
      }
    },
    [crawlJobId, onReportGenerated, projectId, toast],
  );

  const handleToggle = useCallback(
    async (schedule: ReportSchedule) => {
      try {
        const updated = await api.reports.schedules.update(schedule.id, {
          enabled: !schedule.enabled,
        });
        setSchedules((prev) =>
          prev.map((candidate) =>
            candidate.id === updated.id ? updated : candidate,
          ),
        );
      } catch (err: unknown) {
        toast({
          title: "Failed to update schedule",
          description:
            err instanceof Error
              ? err.message
              : "Could not toggle the schedule",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await api.reports.schedules.delete(id);
        setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
      } catch (err: unknown) {
        toast({
          title: "Failed to delete schedule",
          description:
            err instanceof Error
              ? err.message
              : "Could not delete the schedule",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  return {
    schedules,
    loading,
    locked,
    audience,
    recipientInput,
    format,
    type,
    saving,
    sendingNowScheduleId,
    selectedPreset,
    setRecipientInput,
    setFormat,
    setType,
    handleAudienceSelect,
    handleCreate,
    handleSendNow,
    handleToggle,
    handleDelete,
  };
}
