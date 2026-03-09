import { useCallback } from "react";
import { api, type LogUpload } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";

type UseLogsTabDataArgs = {
  projectId: string;
};

export function useLogsTabData({ projectId }: UseLogsTabDataArgs) {
  const {
    data: uploads,
    isLoading,
    mutate,
  } = useApiSWR<LogUpload[]>(
    `logs-${projectId}`,
    useCallback(() => api.logs.list(projectId), [projectId]),
  );

  return {
    uploads,
    isLoading,
    mutateUploads: mutate,
  };
}
