import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { type SubTab } from "./competitors-tab-helpers";

type AsyncMutator = () => Promise<unknown> | unknown;

type UseCompetitorsTabActionsArgs = {
  projectId: string;
  mutateBenchmarks: AsyncMutator;
  mutateStrategy: AsyncMutator;
};

export function useCompetitorsTabActions({
  projectId,
  mutateBenchmarks,
  mutateStrategy,
}: UseCompetitorsTabActionsArgs) {
  const { withAuth } = useApi();
  const [activeTab, setActiveTab] = useState<SubTab>("benchmark");
  const [newDomain, setNewDomain] = useState("");
  const [benchmarking, setBenchmarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<
    (() => Promise<void>) | null
  >(null);
  const [rebenchmarkingId, setRebenchmarkingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    await Promise.all([mutateBenchmarks(), mutateStrategy()]);
  }, [mutateBenchmarks, mutateStrategy]);

  const runBenchmark = useCallback(
    async (domain: string) => {
      const trimmed = domain.trim();
      if (!trimmed) return;

      setBenchmarking(true);
      setError(null);
      setLastFailedAction(null);

      try {
        await withAuth(() =>
          api.benchmarks.trigger({
            projectId,
            competitorDomain: trimmed,
          }),
        );
        setNewDomain("");
        await refreshAll();
      } catch (err: unknown) {
        setLastFailedAction(() => async () => {
          await runBenchmark(trimmed);
        });
        setError(
          err instanceof Error ? err.message : "Failed to benchmark competitor",
        );
      } finally {
        setBenchmarking(false);
      }
    },
    [projectId, refreshAll, withAuth],
  );

  const handleBenchmark = useCallback(async () => {
    await runBenchmark(newDomain);
  }, [newDomain, runBenchmark]);

  const runRebenchmark = useCallback(
    async (competitorId: string) => {
      setRebenchmarkingId(competitorId);
      setError(null);
      setLastFailedAction(null);

      try {
        await withAuth(() =>
          api.competitorMonitoring.rebenchmark(competitorId),
        );
        await mutateBenchmarks();
      } catch (err: unknown) {
        setLastFailedAction(() => async () => {
          await runRebenchmark(competitorId);
        });
        setError(err instanceof Error ? err.message : "Failed to re-benchmark");
      } finally {
        setRebenchmarkingId(null);
      }
    },
    [mutateBenchmarks, withAuth],
  );

  const handleRebenchmark = useCallback(
    async (competitorId: string) => {
      await runRebenchmark(competitorId);
    },
    [runRebenchmark],
  );

  const runToggleMonitoring = useCallback(
    async (competitorId: string, currentlyEnabled: boolean) => {
      setTogglingId(competitorId);
      setError(null);
      setLastFailedAction(null);

      try {
        await withAuth(() =>
          api.competitorMonitoring.updateMonitoring(competitorId, {
            enabled: !currentlyEnabled,
          }),
        );
        await mutateStrategy();
      } catch (err: unknown) {
        setLastFailedAction(() => async () => {
          await runToggleMonitoring(competitorId, currentlyEnabled);
        });
        setError(
          err instanceof Error ? err.message : "Failed to update monitoring",
        );
      } finally {
        setTogglingId(null);
      }
    },
    [mutateStrategy, withAuth],
  );

  const handleToggleMonitoring = useCallback(
    async (competitorId: string, currentlyEnabled: boolean) => {
      await runToggleMonitoring(competitorId, currentlyEnabled);
    },
    [runToggleMonitoring],
  );

  const handleRetry = useCallback(() => {
    if (!lastFailedAction) return;
    void lastFailedAction();
  }, [lastFailedAction]);

  return {
    activeTab,
    setActiveTab,
    newDomain,
    setNewDomain,
    benchmarking,
    error,
    lastFailedAction,
    rebenchmarkingId,
    togglingId,
    handleBenchmark,
    handleRebenchmark,
    handleToggleMonitoring,
    handleRetry,
  };
}
