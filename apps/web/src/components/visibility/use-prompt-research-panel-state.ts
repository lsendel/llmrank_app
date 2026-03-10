"use client";

import { useCallback, useMemo, useState } from "react";
import { api, ApiError, type AIPrompt } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import { useToast } from "@/components/ui/use-toast";
import {
  buildPromptResearchCsv,
  buildPromptResearchCsvFilename,
  filterPromptResearchPrompts,
  type PromptCategoryFilter,
  type PromptDifficultyFilter,
  type PromptMentionedFilter,
} from "./prompt-research-panel-helpers";

type PromptResearchListResult = {
  data: AIPrompt[];
  meta: { limit: number; plan: string };
};

export function usePromptResearchPanelState({
  projectId,
  filters,
}: {
  projectId: string;
  filters?: { region?: string; language?: string };
}) {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [categoryFilter, setCategoryFilter] =
    useState<PromptCategoryFilter>("all");
  const [mentionedFilter, setMentionedFilter] =
    useState<PromptMentionedFilter>("all");
  const [difficultyFilter, setDifficultyFilter] =
    useState<PromptDifficultyFilter>("all");
  const [runningPromptId, setRunningPromptId] = useState<string | null>(null);
  const [trackingPromptId, setTrackingPromptId] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    data: result,
    isLoading,
    error,
    mutate,
  } = useApiSWR<PromptResearchListResult>(
    `prompt-research-${projectId}`,
    useCallback(() => api.promptResearch.list(projectId), [projectId]),
  );

  const prompts = result?.data ?? [];
  const meta = result?.meta;
  const filteredPrompts = useMemo(
    () =>
      filterPromptResearchPrompts(prompts, {
        categoryFilter,
        mentionedFilter,
        difficultyFilter,
      }),
    [prompts, categoryFilter, mentionedFilter, difficultyFilter],
  );

  const handleCategoryFilterChange = useCallback((value: string) => {
    setCategoryFilter(value as PromptCategoryFilter);
  }, []);

  const handleMentionedFilterChange = useCallback((value: string) => {
    setMentionedFilter(value as PromptMentionedFilter);
  }, []);

  const handleDifficultyFilterChange = useCallback((value: string) => {
    setDifficultyFilter(value as PromptDifficultyFilter);
  }, []);

  const handleDiscover = useCallback(async () => {
    setIsDiscovering(true);
    try {
      await api.promptResearch.discover(projectId);
      await mutate();
      toast({
        title: "Prompts discovered",
        description: "New AI prompts have been added.",
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to discover prompts";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsDiscovering(false);
    }
  }, [mutate, projectId, toast]);

  const handleDelete = useCallback(
    async (promptId: string) => {
      try {
        await api.promptResearch.remove(projectId, promptId);
        await mutate();
      } catch {
        toast({
          title: "Error",
          description: "Failed to remove prompt",
          variant: "destructive",
        });
      }
    },
    [mutate, projectId, toast],
  );

  const handleRunCheck = useCallback(
    async (prompt: AIPrompt) => {
      setRunningPromptId(prompt.id);
      try {
        const result = await api.promptResearch.check({
          projectId,
          promptId: prompt.id,
          ...(filters?.region ? { region: filters.region } : {}),
          ...(filters?.language ? { language: filters.language } : {}),
        });
        await mutate();
        toast({
          title: "Prompt check complete",
          description: result.yourMentioned
            ? "Your brand was mentioned in this prompt."
            : "Your brand is not mentioned yet for this prompt.",
        });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to run prompt check";
        toast({ title: "Error", description: message, variant: "destructive" });
      } finally {
        setRunningPromptId(null);
      }
    },
    [filters?.language, filters?.region, mutate, projectId, toast],
  );

  const handleTrackPrompt = useCallback(
    async (prompt: AIPrompt) => {
      setTrackingPromptId(prompt.id);
      try {
        await api.visibility.schedules.create({
          projectId,
          query: prompt.prompt,
          providers: ["chatgpt", "claude", "perplexity", "gemini"],
          frequency: "weekly",
        });
        toast({
          title: "Tracking enabled",
          description: "Added weekly visibility tracking for this prompt.",
        });
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to create tracking schedule";
        toast({ title: "Error", description: message, variant: "destructive" });
      } finally {
        setTrackingPromptId(null);
      }
    },
    [projectId, toast],
  );

  const handleExportCsv = useCallback(() => {
    if (filteredPrompts.length === 0) return;

    const csv = buildPromptResearchCsv(filteredPrompts);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildPromptResearchCsvFilename(projectId);
    anchor.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV exported",
      description: `${filteredPrompts.length} prompt${
        filteredPrompts.length === 1 ? "" : "s"
      } exported.`,
    });
  }, [filteredPrompts, projectId, toast]);

  return {
    categoryFilter,
    difficultyFilter,
    error,
    filteredPrompts,
    handleCategoryFilterChange,
    handleDelete,
    handleDifficultyFilterChange,
    handleDiscover,
    handleExportCsv,
    handleMentionedFilterChange,
    handleRunCheck,
    handleTrackPrompt,
    isDiscovering,
    isLoading,
    mentionedFilter,
    meta,
    prompts,
    runningPromptId,
    trackingPromptId,
  };
}
