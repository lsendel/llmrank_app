"use client";

import useSWR, { type SWRConfiguration } from "swr";

/**
 * SWR wrapper for cookie-authenticated API calls.
 * Cookies are sent automatically via credentials: 'include'.
 */
export function useApiSWR<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  config?: SWRConfiguration<T>,
) {
  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
    onError(error: unknown) {
      if ((error as { status?: number })?.status === 401) {
        window.location.href = "/sign-out";
      }
    },
    ...config,
  });
}
