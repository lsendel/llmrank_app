import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useRef, useState } from "react";
import { api, ApiError, type LogAnalysisSummary } from "@/lib/api";
import { useApi } from "@/lib/use-api";

type UseLogsTabActionsArgs = {
  projectId: string;
  mutateUploads: () => Promise<unknown> | unknown;
};

export function useLogsTabActions({
  projectId,
  mutateUploads,
}: UseLogsTabActionsArgs) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { withAuth } = useApi();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedFile, setLastFailedFile] = useState<File | null>(null);
  const [latestSummary, setLatestSummary] = useState<LogAnalysisSummary | null>(
    null,
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setLastFailedFile(null);

      try {
        const content = await file.text();
        await withAuth(async () => {
          const result = await api.logs.upload(projectId, {
            filename: file.name,
            content,
          });
          setLatestSummary(result.summary);
          await mutateUploads();
        });
      } catch (err) {
        setLastFailedFile(file);
        setError(
          err instanceof ApiError
            ? err.message
            : "Failed to upload log file. Please try again.",
        );
      } finally {
        setUploading(false);
      }
    },
    [mutateUploads, projectId, withAuth],
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFileUpload(file);
      }
    },
    [handleFileUpload],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file) {
        void handleFileUpload(file);
      }
    },
    [handleFileUpload],
  );

  const handleRetryUpload = useCallback(() => {
    if (lastFailedFile) {
      void handleFileUpload(lastFailedFile);
    }
  }, [handleFileUpload, lastFailedFile]);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    uploading,
    error,
    latestSummary,
    canRetryUpload: lastFailedFile !== null,
    handleFileUpload,
    handleFileChange,
    handleDrop,
    handleRetryUpload,
    handleDismissError,
    openFilePicker,
  };
}
