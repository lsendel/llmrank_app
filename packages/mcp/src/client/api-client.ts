import { ApiClientConfig, ApiClientError, ApiErrorResponse } from "./types";

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, apiToken, timeout = 30000 } = config;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      "User-Agent": "llm-boost-mcp/1.0.0",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });

    const json = await response.json();

    if (!response.ok) {
      const err = json as ApiErrorResponse;
      throw new ApiClientError(
        response.status,
        err.error?.code ?? "UNKNOWN",
        err.error?.message ?? "Request failed",
        err.error?.details,
      );
    }

    return json as T;
  }

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
