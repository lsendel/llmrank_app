"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export function useApi() {
  const router = useRouter();

  const withAuth = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (error: unknown) {
        if ((error as { status?: number })?.status === 401) {
          router.push("/sign-in");
        }
        throw error;
      }
    },
    [router],
  );

  return { withAuth };
}
