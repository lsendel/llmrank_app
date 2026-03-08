import { apiUrl } from "../../api-base-url";
import { ApiError } from "./errors";
import type { DownloadResponse } from "./types";

function extractFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? null;
}

export async function postDownload(path: string): Promise<DownloadResponse> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: { Accept: "*/*" },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? "UNKNOWN_ERROR",
      errorBody?.error?.message ?? response.statusText,
      errorBody?.error?.details,
    );
  }

  return {
    filename: extractFilename(response.headers.get("content-disposition")),
    contentType: response.headers.get("content-type"),
    content: await response.text(),
  };
}
