const PRO_SUPPORTED_REGIONS = new Set([
  "us",
  "gb",
  "de",
  "fr",
  "es",
  "br",
  "jp",
  "au",
  "ca",
  "in",
  "it",
  "nl",
  "se",
  "kr",
]);

const REGION_DEFAULT_LANGUAGE: Record<string, string> = {
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

export function normalizeLocaleCode(
  input: string | null | undefined,
): string | undefined {
  if (!input) return undefined;
  const value = input.trim().toLowerCase();
  if (!value || value === "all") return undefined;
  return value;
}

export function resolveLocaleForPlan(params: {
  plan: string;
  region?: string;
  language?: string;
}):
  | {
      locale: { region?: string; language?: string };
    }
  | { error: string } {
  const plan = params.plan;
  const region = normalizeLocaleCode(params.region);
  const language = normalizeLocaleCode(params.language);

  // Free and Starter are constrained to US English.
  if (plan === "free" || plan === "starter") {
    return { locale: { region: "us", language: "en" } };
  }

  if (!region && !language) {
    return { locale: {} };
  }

  const resolvedRegion = region ?? "us";
  const resolvedLanguage =
    language ?? REGION_DEFAULT_LANGUAGE[resolvedRegion] ?? "en";

  if (!/^[a-z]{2}$/.test(resolvedRegion)) {
    return { error: "Invalid region code. Use ISO 3166-1 alpha-2." };
  }
  if (!/^[a-z]{2}$/.test(resolvedLanguage)) {
    return { error: "Invalid language code. Use ISO 639-1." };
  }

  // Pro users get a curated region set; Agency can use any valid region code.
  if (plan === "pro" && !PRO_SUPPORTED_REGIONS.has(resolvedRegion)) {
    return {
      error:
        "Region not available on Pro. Upgrade to Agency for unrestricted regional coverage.",
    };
  }

  return {
    locale: {
      region: resolvedRegion,
      language: resolvedLanguage,
    },
  };
}
