import { createLogger } from "./logger";

const log = createLogger({ context: "fetch-retry" });

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

const DEFAULTS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  timeoutMs: 15_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts?: RetryOptions,
): Promise<Response> {
  const { maxRetries, baseDelayMs, timeoutMs } = { ...DEFAULTS, ...opts };

  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Don't retry 4xx — those are client errors
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // 5xx — retry
      lastResponse = response;
      log.warn(`Attempt ${attempt}/${maxRetries} got ${response.status}`, {
        url,
        status: response.status,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log.warn(
        `Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
        {
          url,
        },
      );
    }

    // Exponential backoff: 1s, 3s, 9s
    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(3, attempt - 1);
      await sleep(delay);
    }
  }

  // All retries exhausted
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError ?? new Error("All retries exhausted");
}
