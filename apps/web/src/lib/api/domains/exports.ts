import { apiUrl } from "../../api-base-url";

export function createExportsApi() {
  return {
    download(projectId: string, format: "csv" | "json") {
      window.open(
        apiUrl(`/api/projects/${projectId}/export?format=${format}`),
        "_blank",
      );
    },
  };
}
