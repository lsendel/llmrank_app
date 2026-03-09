import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  api,
  ApiError,
  type ScheduledQuery,
  type VisibilityCheck,
} from "@/lib/api";
import { useApi } from "@/lib/use-api";
import {
  AI_SEARCH_PRESET,
  BALANCED_PRESET,
  DEFAULT_PROVIDER_IDS,
  FULL_COVERAGE_PRESET,
  filterKnownProviderIds,
  recommendedProvidersForIntent,
  type ProviderId,
  type VisibilityIntent,
  type ScheduleFrequency,
} from "./visibility-tab-helpers";

type VisibilityMode = "run-monitor" | "analyze-gaps";

type UseVisibilityTabActionsArgs = {
  projectId: string;
  canFilterRegion: boolean;
  isProOrAbove: boolean;
  regionFilter: ReturnType<
    typeof import("./visibility-tab-helpers").buildRegionFilter
  >;
  setSelectedRegion: Dispatch<SetStateAction<string>>;
  setHistory: Dispatch<SetStateAction<VisibilityCheck[]>>;
  setSchedules: Dispatch<SetStateAction<ScheduledQuery[]>>;
};

export function useVisibilityTabActions({
  projectId,
  canFilterRegion,
  isProOrAbove,
  regionFilter,
  setSelectedRegion,
  setHistory,
  setSchedules,
}: UseVisibilityTabActionsArgs) {
  const { withAuth } = useApi();
  const { toast } = useToast();
  const [mode, setMode] = useState<VisibilityMode>("run-monitor");
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] =
    useState<ProviderId[]>(DEFAULT_PROVIDER_IDS);
  const [intent, setIntent] = useState<VisibilityIntent>("discovery");
  const [results, setResults] = useState<VisibilityCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const handleModeChange = useCallback((value: string) => {
    setMode(value as VisibilityMode);
  }, []);

  const handleSelectRegion = useCallback(
    (value: string) => {
      if (!canFilterRegion && value !== "all") {
        toast({
          title: "Pro plan required",
          description:
            "Regional filtering is available on Pro and Agency plans.",
          variant: "destructive",
        });
        return;
      }

      setSelectedRegion(value);
    },
    [canFilterRegion, setSelectedRegion, toast],
  );

  const toggleProvider = useCallback((id: ProviderId) => {
    setSelectedProviders((prev) =>
      prev.includes(id)
        ? prev.filter((provider) => provider !== id)
        : [...prev, id],
    );
  }, []);

  const applyProviderPreset = useCallback((providers: readonly string[]) => {
    setSelectedProviders(filterKnownProviderIds(providers));
  }, []);

  const handleApplyIntentPreset = useCallback(() => {
    const recommended = recommendedProvidersForIntent(intent, isProOrAbove);
    applyProviderPreset(recommended);
    toast({
      title: "Provider preset applied",
      description: `Loaded recommended providers for ${intent} intent.`,
    });
  }, [applyProviderPreset, intent, isProOrAbove, toast]);

  const handleApplyBalancedPreset = useCallback(() => {
    applyProviderPreset(BALANCED_PRESET);
  }, [applyProviderPreset]);

  const handleApplyAiSearchPreset = useCallback(() => {
    applyProviderPreset(AI_SEARCH_PRESET);
  }, [applyProviderPreset]);

  const handleApplyFullCoveragePreset = useCallback(() => {
    if (!isProOrAbove) {
      toast({
        title: "Pro plan required",
        description:
          "Full coverage preset is available on Pro and Agency plans.",
        variant: "destructive",
      });
      return;
    }

    applyProviderPreset(FULL_COVERAGE_PRESET);
  }, [applyProviderPreset, isProOrAbove, toast]);

  const handleRunCheck = useCallback(async () => {
    if (selectedKeywordIds.length === 0 || selectedProviders.length === 0)
      return;

    setLoading(true);
    setError(null);

    try {
      const realIds: string[] = [];
      const personaQueries: string[] = [];

      for (const id of selectedKeywordIds) {
        if (id.startsWith("persona:")) {
          personaQueries.push(id.split(":").slice(2).join(":"));
        } else {
          realIds.push(id);
        }
      }

      if (personaQueries.length > 0) {
        const saved = await api.keywords.createBatch(projectId, personaQueries);
        realIds.push(...saved.map((keyword) => keyword.id));
      }

      await withAuth(async () => {
        const data = await api.visibility.run({
          projectId,
          keywordIds: realIds,
          providers: selectedProviders,
          ...(regionFilter && {
            region: regionFilter.region,
            language: regionFilter.language,
          }),
        });
        setResults(data);
      });

      const updated = await api.visibility.list(projectId, regionFilter);
      setHistory(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to run visibility check.");
      }
    } finally {
      setLoading(false);
    }
  }, [
    projectId,
    regionFilter,
    selectedKeywordIds,
    selectedProviders,
    setHistory,
    withAuth,
  ]);

  const handleScheduleCreated = useCallback(
    (schedule: ScheduledQuery) => {
      setSchedules((prev) => [...prev, schedule]);
    },
    [setSchedules],
  );

  const handleCreateSchedule = useCallback(
    async (data: {
      query: string;
      providers: string[];
      frequency: ScheduleFrequency;
    }) => {
      setScheduleError(null);
      try {
        await withAuth(async () => {
          const created = await api.visibility.schedules.create({
            projectId,
            ...data,
          });
          setSchedules((prev) => [...prev, created]);
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setScheduleError(err.message);
        } else {
          setScheduleError("Failed to create schedule.");
        }
        throw err;
      }
    },
    [projectId, setSchedules, withAuth],
  );

  const handleToggleSchedule = useCallback(
    async (schedule: ScheduledQuery) => {
      try {
        await withAuth(async () => {
          const updated = await api.visibility.schedules.update(schedule.id, {
            enabled: !schedule.enabled,
          });
          setSchedules((prev) =>
            prev.map((current) =>
              current.id === updated.id ? updated : current,
            ),
          );
        });
      } catch (err) {
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Failed to toggle schedule",
          variant: "destructive",
        });
      }
    },
    [setSchedules, toast, withAuth],
  );

  const handleDeleteSchedule = useCallback(
    async (id: string) => {
      try {
        await withAuth(async () => {
          await api.visibility.schedules.delete(id);
          setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
        });
      } catch (err) {
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Failed to delete schedule",
          variant: "destructive",
        });
      }
    },
    [setSchedules, toast, withAuth],
  );

  return {
    mode,
    handleModeChange,
    handleSelectRegion,
    selectedKeywordIds,
    setSelectedKeywordIds,
    selectedProviders,
    intent,
    setIntent,
    results,
    loading,
    error,
    scheduleError,
    handleRunCheck,
    handleScheduleCreated,
    handleCreateSchedule,
    handleToggleSchedule,
    handleDeleteSchedule,
    handleApplyIntentPreset,
    handleApplyBalancedPreset,
    handleApplyAiSearchPreset,
    handleApplyFullCoveragePreset,
    toggleProvider,
  };
}
