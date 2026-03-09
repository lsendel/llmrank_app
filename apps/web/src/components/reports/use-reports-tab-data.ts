import { useCallback, useEffect, useState } from "react";
import { api, type Report } from "@/lib/api";

type UseReportsTabDataArgs = {
  projectId: string;
};

export function useReportsTabData({ projectId }: UseReportsTabDataArgs) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      const list = await api.reports.list(projectId);
      setReports(list);
    } catch {
      // Empty state shown when loading completes without data.
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    const pending = reports.some(
      (report) => report.status === "queued" || report.status === "generating",
    );

    if (!pending) return;

    const interval = setInterval(() => {
      void fetchReports();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchReports, reports]);

  return {
    reports,
    setReports,
    loading,
    fetchReports,
  };
}
