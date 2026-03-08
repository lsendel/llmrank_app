export const PROVIDERS = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
  { id: "copilot", label: "Copilot" },
  { id: "gemini_ai_mode", label: "AI Search (Gemini)" },
  { id: "grok", label: "Grok" },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];
export type VisibilityIntent = "discovery" | "comparison" | "transactional";
export type ScheduleFrequency = "hourly" | "daily" | "weekly";

const PROVIDER_ID_SET = new Set<string>(
  PROVIDERS.map((provider) => provider.id),
);

export const DEFAULT_PROVIDER_IDS: ProviderId[] = PROVIDERS.map(
  (provider) => provider.id,
);

export const BALANCED_PRESET: ProviderId[] = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
];

export const AI_SEARCH_PRESET: ProviderId[] = [
  "perplexity",
  "gemini",
  "gemini_ai_mode",
];

export const FULL_COVERAGE_PRESET: ProviderId[] = [...DEFAULT_PROVIDER_IDS];

export const FREQUENCY_OPTIONS = [
  { value: "hourly", label: "Hourly", description: "Every hour" },
  { value: "daily", label: "Daily", description: "Every 24 hours" },
  { value: "weekly", label: "Weekly", description: "Every 7 days" },
] as const;

export const REGIONS = [
  { value: "all", label: "Worldwide" },
  { value: "us", label: "US" },
  { value: "gb", label: "UK" },
  { value: "de", label: "DE" },
  { value: "fr", label: "FR" },
  { value: "es", label: "ES" },
  { value: "br", label: "BR" },
  { value: "jp", label: "JP" },
  { value: "au", label: "AU" },
  { value: "ca", label: "CA" },
  { value: "in", label: "IN" },
  { value: "it", label: "IT" },
  { value: "nl", label: "NL" },
  { value: "se", label: "SE" },
  { value: "kr", label: "KR" },
] as const;

const REGION_LANGUAGES: Record<string, string> = {
  us: "en",
  gb: "en",
  de: "de",
  fr: "fr",
  es: "es",
  br: "pt",
  jp: "ja",
  au: "en",
  ca: "en",
  in: "en",
  it: "it",
  nl: "nl",
  se: "sv",
  kr: "ko",
};

export function recommendedProvidersForIntent(
  intent: VisibilityIntent,
  isProOrAbove: boolean,
): ProviderId[] {
  switch (intent) {
    case "comparison":
      return isProOrAbove
        ? ["perplexity", "gemini", "chatgpt", "grok"]
        : ["perplexity", "gemini", "chatgpt"];
    case "transactional":
      return isProOrAbove
        ? ["chatgpt", "gemini", "copilot", "gemini_ai_mode"]
        : ["chatgpt", "gemini", "copilot"];
    case "discovery":
    default:
      return isProOrAbove
        ? ["chatgpt", "claude", "perplexity", "gemini_ai_mode"]
        : ["chatgpt", "claude", "perplexity"];
  }
}

export function buildRegionFilter(
  selectedRegion: string,
  canFilterRegion: boolean,
): { region: string; language: string } | undefined {
  if (selectedRegion === "all" || !canFilterRegion) {
    return undefined;
  }

  return {
    region: selectedRegion,
    language: REGION_LANGUAGES[selectedRegion] ?? "en",
  };
}

export function filterKnownProviderIds(
  providers: readonly string[],
): ProviderId[] {
  return providers.filter((provider): provider is ProviderId =>
    PROVIDER_ID_SET.has(provider),
  );
}
