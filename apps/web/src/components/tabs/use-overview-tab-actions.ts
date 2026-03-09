import { useCallback } from "react";
import { api } from "@/lib/api";

type UseOverviewTabActionsArgs = {
  projectId: string;
};

export function useOverviewTabActions({
  projectId,
}: UseOverviewTabActionsArgs) {
  const handleExportCsv = useCallback(() => {
    void api.exports.download(projectId, "csv");
  }, [projectId]);

  const handleExportJson = useCallback(() => {
    void api.exports.download(projectId, "json");
  }, [projectId]);

  return {
    handleExportCsv,
    handleExportJson,
  };
}
