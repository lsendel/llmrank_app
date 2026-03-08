import { apiUrl } from "../../api-base-url";
import { ApiError } from "./errors";
import type { RequestOptions } from "./types";

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers: extraHeaders, ...init } = options;

  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json");

  try {
    const response = await fetch(apiUrl(path), {
      ...init,
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
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

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(
        response.status,
        "INVALID_RESPONSE",
        "Invalid JSON response from server",
      );
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      0,
      "NETWORK_ERROR",
      error instanceof Error ? error.message : "Network request failed",
    );
  }
}
