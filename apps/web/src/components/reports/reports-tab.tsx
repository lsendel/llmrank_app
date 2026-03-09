"use client";

import { GenerateReportModal } from "./generate-report-modal";
import { ReportList } from "./report-list";
import {
  AutoReportSettingsSection,
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
    useReportsTabActions({
      crawlJobId,
      setReports,
    });
  const autoReportSettings = useAutoReportSettings({
    projectId,
    crawlJobId,
    onReportGenerated: fetchReports,
  });

  if (loading) {
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

      {!autoReportSettings.loading && (
        <AutoReportSettingsSection
          crawlJobId={crawlJobId}
          schedules={autoReportSettings.schedules}
          locked={autoReportSettings.locked}
          audience={autoReportSettings.audience}
          recipientInput={autoReportSettings.recipientInput}
          format={autoReportSettings.format}
          type={autoReportSettings.type}
          saving={autoReportSettings.saving}
          sendingNowScheduleId={autoReportSettings.sendingNowScheduleId}
          selectedPreset={autoReportSettings.selectedPreset}
          onAudienceSelect={autoReportSettings.handleAudienceSelect}
          onRecipientInputChange={autoReportSettings.setRecipientInput}
          onFormatChange={autoReportSettings.setFormat}
          onTypeChange={autoReportSettings.setType}
          onCreate={autoReportSettings.handleCreate}
          onSendNow={autoReportSettings.handleSendNow}
          onToggle={autoReportSettings.handleToggle}
          onDelete={autoReportSettings.handleDelete}
        />
      )}
    </div>
  );
}
