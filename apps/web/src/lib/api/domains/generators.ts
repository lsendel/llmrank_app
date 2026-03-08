import { postDownload } from "../core/download";
import type { DownloadResponse } from "../core/types";

export function createGeneratorsApi() {
  return {
    sitemap(projectId: string): Promise<DownloadResponse> {
      return postDownload(`/api/projects/${projectId}/generate/sitemap`);
    },

    llmsTxt(projectId: string): Promise<DownloadResponse> {
      return postDownload(`/api/projects/${projectId}/generate/llms-txt`);
    },
  };
}
