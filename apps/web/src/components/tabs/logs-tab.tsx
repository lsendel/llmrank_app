"use client";

import { resolveLogSummary } from "./logs-tab-helpers";
import {
  LogsTabHeader,
  LogsTabHistorySection,
  LogsTabSummarySection,
  LogsTabUploadSection,
} from "./logs-tab-sections";
import { useLogsTabActions } from "./use-logs-tab-actions";
import { useLogsTabData } from "./use-logs-tab-data";

export function LogsTab({ projectId }: { projectId: string }) {
  const { uploads, isLoading, mutateUploads } = useLogsTabData({ projectId });
  const {
    fileInputRef,
    uploading,
    error,
    latestSummary,
    canRetryUpload,
    handleFileChange,
    handleDrop,
    handleRetryUpload,
    handleDismissError,
    openFilePicker,
  } = useLogsTabActions({
    projectId,
    mutateUploads,
  });
  const summary = resolveLogSummary({ latestSummary, uploads });

  return (
    <div className="space-y-8">
      <LogsTabHeader />

      <LogsTabUploadSection
        fileInputRef={fileInputRef}
        uploading={uploading}
        error={error}
        canRetryUpload={canRetryUpload}
        onBrowse={openFilePicker}
        onFileChange={handleFileChange}
        onDrop={handleDrop}
        onRetry={handleRetryUpload}
        onDismiss={handleDismissError}
      />

      <LogsTabSummarySection summary={summary} />

      <LogsTabHistorySection uploads={uploads ?? []} isLoading={isLoading} />
    </div>
  );
}
