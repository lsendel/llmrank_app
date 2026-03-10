import type { ScoringProfile } from "@/lib/api";

export const DEFAULT_SCORING_PROFILE_PRESET = "default";

export const SCORING_PRESETS = {
  default: {
    label: "Default",
    weights: { technical: 25, content: 30, aiReadiness: 30, performance: 15 },
  },
  ecommerce: {
    label: "E-commerce",
    weights: { technical: 30, content: 20, aiReadiness: 35, performance: 15 },
  },
  blog: {
    label: "Blog / Content",
    weights: { technical: 15, content: 40, aiReadiness: 30, performance: 15 },
  },
  saas: {
    label: "SaaS",
    weights: { technical: 25, content: 25, aiReadiness: 35, performance: 15 },
  },
  local_business: {
    label: "Local Business",
    weights: { technical: 30, content: 25, aiReadiness: 25, performance: 20 },
  },
} satisfies Record<
  string,
  { label: string; weights: ScoringProfile["weights"] }
>;

export type ScoringProfilePreset = keyof typeof SCORING_PRESETS | "custom";
export type ScoringWeightCategory = keyof ScoringProfile["weights"];

export const SCORING_CATEGORIES: {
  key: ScoringWeightCategory;
  label: string;
}[] = [
  { key: "technical", label: "Technical SEO" },
  { key: "content", label: "Content Quality" },
  { key: "aiReadiness", label: "AI Readiness" },
  { key: "performance", label: "Performance" },
];

export function getPresetWeights(
  preset: keyof typeof SCORING_PRESETS,
): ScoringProfile["weights"] {
  return { ...SCORING_PRESETS[preset].weights };
}

export function getScoringWeightsTotal(weights: ScoringProfile["weights"]) {
  return (
    weights.technical +
    weights.content +
    weights.aiReadiness +
    weights.performance
  );
}

export function isScoringWeightsValid(weights: ScoringProfile["weights"]) {
  return getScoringWeightsTotal(weights) === 100;
}

export function getScoringProfileName(preset: ScoringProfilePreset) {
  if (preset === "custom") {
    return "Custom Profile";
  }

  return SCORING_PRESETS[preset].label;
}
