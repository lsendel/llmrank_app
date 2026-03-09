import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { api, type Report } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

type UseReportsTabActionsArgs = {
  crawlJobId?: string;
  setReports: Dispatch<SetStateAction<Report[]>>;
};

export function useReportsTabActions({
  crawlJobId,
  setReports,
}: UseReportsTabActionsArgs) {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);

  const handleExport = useCallback(
    async (format: "csv" | "json") => {
      if (!crawlJobId) return;

      try {
        const data = await api.crawls.exportData(crawlJobId, format);
        const blob =
          format === "csv"
            ? new Blob([data as string], { type: "text/csv" })
            : new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download =
          format === "csv" ? "crawl-export.csv" : "crawl-export.json";
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (err: unknown) {
        toast({
          title: "Export failed",
          description:
            err instanceof Error ? err.message : "Could not export data",
          variant: "destructive",
        });
      }
    },
    [crawlJobId, toast],
  );

  const handleDelete = useCallback(
    async (reportId: string) => {
      try {
        await api.reports.delete(reportId);
        setReports((prev) => prev.filter((report) => report.id !== reportId));
      } catch (err: unknown) {
        toast({
          title: "Failed to delete report",
          description:
            err instanceof Error ? err.message : "Could not delete the report",
          variant: "destructive",
        });
      }
    },
    [setReports, toast],
  );

  return {
    showModal,
    setShowModal,
    handleExport,
    handleDelete,
  };
}
