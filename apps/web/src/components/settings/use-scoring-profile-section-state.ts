import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { api, type ScoringProfile } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  DEFAULT_SCORING_PROFILE_PRESET,
  getPresetWeights,
  getScoringProfileName,
  getScoringWeightsTotal,
  isScoringWeightsValid,
  type ScoringProfilePreset,
  type ScoringWeightCategory,
} from "./scoring-profile-section-helpers";

export function useScoringProfileSectionState() {
  const { data: profiles, mutate } = useApiSWR<ScoringProfile[]>(
    "scoring-profiles",
    useCallback(() => api.scoringProfiles.list(), []),
  );
  const { toast } = useToast();

  const [weights, setWeights] = useState<ScoringProfile["weights"]>(() =>
    getPresetWeights(DEFAULT_SCORING_PROFILE_PRESET),
  );
  const [preset, setPreset] = useState<ScoringProfilePreset>(
    DEFAULT_SCORING_PROFILE_PRESET,
  );
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = getScoringWeightsTotal(weights);
  const isValid = isScoringWeightsValid(weights);

  const handlePresetChange = useCallback(
    (nextPreset: Exclude<ScoringProfilePreset, "custom">) => {
      setPreset(nextPreset);
      setShowCustomEditor(false);
      setWeights(getPresetWeights(nextPreset));
    },
    [],
  );

  const handleWeightChange = useCallback(
    (category: ScoringWeightCategory, value: number) => {
      setWeights((current) => ({ ...current, [category]: value }));
      setPreset("custom");
      setShowCustomEditor(true);
    },
    [],
  );

  const handleToggleCustomEditor = useCallback(() => {
    setShowCustomEditor((current) => !current);
  }, []);

  const handleSave = useCallback(async () => {
    if (!isValid) {
      return;
    }

    setSaving(true);
    try {
      const name = getScoringProfileName(preset);
      const existing = profiles?.find((profile) => profile.isDefault);

      if (existing) {
        await api.scoringProfiles.update(existing.id, { name, weights });
      } else {
        await api.scoringProfiles.create({ name, weights });
      }

      await mutate?.();
      toast({ title: "Scoring profile saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [isValid, mutate, preset, profiles, toast, weights]);

  return {
    weights,
    preset,
    showCustomEditor,
    saving,
    total,
    isValid,
    handlePresetChange,
    handleWeightChange,
    handleToggleCustomEditor,
    handleSave,
  };
}
