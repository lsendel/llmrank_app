export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export interface ApiEnvelope<T> {
  data: T;
}

export interface DownloadResponse {
  filename: string | null;
  contentType: string | null;
  content: string;
}
