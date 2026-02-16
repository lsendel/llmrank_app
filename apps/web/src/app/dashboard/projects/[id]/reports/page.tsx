"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import { api, type Report, type Project } from "@/lib/api";
import { GenerateReportModal } from "@/components/reports/generate-report-modal";
import { ReportList } from "@/components/reports/report-list";

export default function ReportsPage() {
  const params = useParams<{ id: string }>();
  const [reports, setReports] = useState<Report[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const [reportList, proj] = await Promise.all([
        api.reports.list(params.id),
        api.projects.get(params.id),
      ]);
      setReports(reportList);
      setProject(proj);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

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
    } catch (err) {
      console.error("Failed to delete report:", err);
    }
  }

  const latestCrawlId = project?.latestCrawl?.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">
            Generate downloadable PDF and Word reports for your analysis.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} disabled={!latestCrawlId}>
          <FileText className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generated Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportList
            reports={reports}
            onDelete={handleDelete}
            onRefresh={fetchReports}
          />
        </CardContent>
      </Card>

      {latestCrawlId && (
        <GenerateReportModal
          open={showModal}
          onClose={() => setShowModal(false)}
          projectId={params.id}
          crawlJobId={latestCrawlId}
          onGenerated={fetchReports}
        />
      )}
    </div>
  );
}
