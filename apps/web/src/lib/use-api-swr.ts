"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

/**
 * SWR wrapper that auto-injects Clerk auth token.
 * Provides caching, request dedup, and stale-while-revalidate.
 */
export function useApiSWR<T>(
  key: string | null,
  fetcher: (token: string) => Promise<T>,
  config?: SWRConfiguration<T>,
) {
  const { getToken } = useAuth();

  const wrappedFetcher = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Not authenticated");
    return fetcher(token);
  }, [getToken, fetcher]);

  return useSWR<T>(key, wrappedFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
    ...config,
  });
}
