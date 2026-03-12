"use client";

import { useState, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import type { CompetitorSuggestion } from "@/lib/api";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCompetitorSuggestions(projectId: string | null) {
  const [suggestions, setSuggestions] = useState<CompetitorSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard: only fetch once per projectId to avoid duplicate AI calls.
  const fetchedForRef = useRef<string | null>(null);

  const fetch = useCallback(
    async (keywords: string[], goal?: string) => {
      if (!projectId) return;
      if (fetchedForRef.current === projectId) return;

      fetchedForRef.current = projectId;
      setLoading(true);
      setError(null);

      try {
        const res = await api.discovery.suggestCompetitors(projectId, {
          keywords,
          goal,
        });
        setSuggestions(res.competitors);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to load competitor suggestions.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  const retry = useCallback(
    async (keywords: string[], goal?: string) => {
      // Reset the guard so fetch runs again.
      fetchedForRef.current = null;
      await fetch(keywords, goal);
    },
    [fetch],
  );

  return { suggestions, loading, error, fetch, retry } as const;
}
