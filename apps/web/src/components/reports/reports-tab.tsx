"use client";

import { GenerateReportModal } from "./generate-report-modal";
import { ReportList } from "./report-list";
import {
  ReportsTabLoadingState,
  ReportsTabToolbar,
} from "./reports-tab-sections";
import { useAutoReportSettings } from "./use-auto-report-settings";
import { useReportsTabActions } from "./use-reports-tab-actions";
import { useReportsTabData } from "./use-reports-tab-data";

interface Props {
  projectId: string;
  crawlJobId: string | undefined;
}

export default function ReportsTab({ projectId, crawlJobId }: Props) {
  const { reports, setReports, loading, fetchReports } = useReportsTabData({
    projectId,
  });
  const { showModal, setShowModal, handleExport, handleDelete } =
    useReportsTabActions({ crawlJobId, setReports });
  const autoReportSettings = useAutoReportSettings({
    projectId,
    crawlJobId,
    onReportGenerated: fetchReports,
  });

  if (loading || autoReportSettings.loading) {
    return <ReportsTabLoadingState />;
  }

  return (
    <div className="space-y-4">
      <ReportsTabToolbar
        crawlJobId={crawlJobId}
        onExport={handleExport}
        onOpenGenerate={() => setShowModal(true)}
      />

      <ReportList
        reports={reports}
        schedules={autoReportSettings.schedules}
        crawlJobId={crawlJobId}
        sendingNowScheduleId={autoReportSettings.sendingNowScheduleId}
        onDelete={handleDelete}
        onRefresh={fetchReports}
        onScheduleSendNow={autoReportSettings.handleSendNow}
        onScheduleToggle={autoReportSettings.handleToggle}
        onScheduleDelete={autoReportSettings.handleDelete}
      />

      <GenerateReportModal
        open={showModal}
        onClose={() => setShowModal(false)}
        projectId={projectId}
        crawlJobId={crawlJobId}
        onGenerated={fetchReports}
        locked={autoReportSettings.locked}
        onCreateSchedule={async ({ recipientInput, format, type }) => {
          autoReportSettings.setRecipientInput(recipientInput);
          autoReportSettings.setFormat(format);
          autoReportSettings.setType(type);
          await autoReportSettings.handleCreate();
          setShowModal(false);
        }}
        scheduleSaving={autoReportSettings.saving}
      />
    </div>
  );
}
