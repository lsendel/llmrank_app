"use client";

import { useCallback, useState } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api, type StrategyCompetitor, type StrategyPersona } from "@/lib/api";

export function useCompetitors(projectId: string) {
  const { withAuth } = useApi();
  const { data, mutate, ...rest } = useApiSWR<StrategyCompetitor[]>(
    `competitors-${projectId}`,
    useCallback(() => api.strategy.getCompetitors(projectId), [projectId]),
  );

  async function addCompetitor(domain: string) {
    await withAuth(() => api.strategy.addCompetitor(projectId, domain));
    await mutate();
  }

  async function removeCompetitor(id: string) {
    await withAuth(() => api.strategy.removeCompetitor(id));
    await mutate();
  }

  return {
    competitors: data,
    addCompetitor,
    removeCompetitor,
    mutate,
    ...rest,
  };
}

export function usePersonas(projectId: string) {
  const { withAuth } = useApi();
  const [personas, setPersonas] = useState<StrategyPersona[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generatePersonas(niche: string): Promise<StrategyPersona[]> {
    setGenerating(true);
    setError(null);
    try {
      const data = await withAuth(() =>
        api.strategy.generatePersonas(projectId, { niche }),
      );
      const result = data as StrategyPersona[];
      setPersonas(result);
      return result;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate personas",
      );
      throw err;
    } finally {
      setGenerating(false);
    }
  }

  return { personas, generating, error, generatePersonas };
}
