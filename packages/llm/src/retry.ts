/**
 * Retries an async function with exponential backoff + jitter.
 *
 * Retries on: rate limits (429), server errors (500+), network errors.
 * Does NOT retry on: client errors (400-428), auth errors (401/403).
 * Respects Retry-After headers when available.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Don't retry client errors (except 429 rate limits)
      if (isNonRetryableError(err)) throw err;

      if (attempt < maxAttempts) {
        const retryAfterMs = getRetryAfterMs(err);
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
        const delay = retryAfterMs ?? addJitter(exponentialDelay);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Wraps a promise with a timeout. Rejects with a TimeoutError if the
 * promise doesn't resolve within `ms` milliseconds.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new TimeoutError(`Request timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

function isNonRetryableError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;

  // Anthropic SDK errors have a `status` property
  const status = (err as Record<string, unknown>).status;
  if (typeof status === "number") {
    // Retry on 429 (rate limit) and 5xx (server errors)
    if (status === 429 || status >= 500) return false;
    // Don't retry on other client errors (400, 401, 403, 422, etc.)
    return true;
  }

  return false;
}

/** Extract Retry-After header value in milliseconds, if present. */
function getRetryAfterMs(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;

  const headers = (err as Record<string, unknown>).headers as
    | Record<string, string>
    | undefined;
  if (!headers) return null;

  const retryAfter = headers["retry-after"] ?? headers["Retry-After"];
  if (!retryAfter) return null;

  // Could be seconds (integer) or an HTTP date
  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 120_000); // Cap at 2 minutes
  }

  return null;
}

/** Add ±25% jitter to a delay to prevent thundering herd. */
function addJitter(delayMs: number): number {
  const jitter = delayMs * 0.25 * (Math.random() * 2 - 1); // -25% to +25%
  return Math.max(0, Math.round(delayMs + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
