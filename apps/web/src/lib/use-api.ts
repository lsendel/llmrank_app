"use client";

import { useCallback } from "react";

export function useApi() {
  const withAuth = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error: unknown) {
      if ((error as { status?: number })?.status === 401) {
        window.location.href = "/sign-out";
      }
      throw error;
    }
  }, []);

  return { withAuth };
}
