"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { useRouter } from "next/navigation";

/**
 * SWR wrapper for cookie-authenticated API calls.
 * Cookies are sent automatically via credentials: 'include'.
 */
export function useApiSWR<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  config?: SWRConfiguration<T>,
) {
  const router = useRouter();

  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
    onError(error: unknown) {
      if ((error as { status?: number })?.status === 401) {
        router.push("/sign-in");
      }
    },
    ...config,
  });
}
