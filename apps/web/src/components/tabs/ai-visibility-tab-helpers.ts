import { type ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { api, type VisibilityCheck } from "@/lib/api";
import { confidenceFromVisibilityCoverage } from "@/lib/insight-metadata";

export type AIVisibilityScore = Awaited<
  ReturnType<(typeof api.visibility)["getAIScore"]>
>;
export type BacklinkSummary = Awaited<
  ReturnType<(typeof api.backlinks)["getSummary"]>
>;
export type DiscoveryResult = Awaited<
  ReturnType<(typeof api.visibility)["discoverKeywords"]>
>;

export const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  grok: "Grok",
  gemini_ai_mode: "AI Search",
};

export const LLM_PROVIDER_ORDER = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "copilot",
  "grok",
] as const;

export const KEYWORD_PROVIDER_ORDER = [
  ...LLM_PROVIDER_ORDER,
  "gemini_ai_mode",
] as const;

export type VisibilityMeta = {
  checks: number;
  providerCount: number;
  queryCount: number;
  latestCheckedAt: string | null;
  confidence: {
    label: string;
    variant: ComponentProps<typeof Badge>["variant"];
  };
};

export type KeywordRow = {
  query: string;
  providers: Record<string, boolean | undefined>;
};

export type ProviderMentionSummary = {
  provider: (typeof LLM_PROVIDER_ORDER)[number];
  label: string;
  checks: number;
  mentioned: number;
  hasMentions: boolean;
};

export function splitChecksByMode(checks: VisibilityCheck[]) {
  return {
    llmChecks: checks.filter((check) => check.llmProvider !== "gemini_ai_mode"),
    aiModeChecks: checks.filter(
      (check) => check.llmProvider === "gemini_ai_mode",
    ),
  };
}

export function calculateMentionRate(checks: VisibilityCheck[]) {
  if (checks.length === 0) return 0;

  return Math.round(
    (checks.filter((check) => check.brandMentioned).length / checks.length) *
      100,
  );
}

export function buildKeywordRows(checks: VisibilityCheck[], limit = 20) {
  const queryMap = new Map<string, KeywordRow>();

  for (const check of checks) {
    const existing = queryMap.get(check.query) ?? {
      query: check.query,
      providers: {},
    };
    existing.providers[check.llmProvider] = check.brandMentioned ?? false;
    queryMap.set(check.query, existing);
  }

  return Array.from(queryMap.values()).slice(0, limit);
}

export function buildVisibilityMeta(checks?: VisibilityCheck[] | null) {
  if (!checks || checks.length === 0) return null;

  const providers = new Set<string>();
  const queries = new Set<string>();
  let latestTimestamp: number | null = null;
  let latestCheckedAt: string | null = null;

  for (const check of checks) {
    providers.add(check.llmProvider);
    queries.add(check.query);

    const timestamp = new Date(check.checkedAt).getTime();
    if (
      Number.isFinite(timestamp) &&
      (latestTimestamp == null || timestamp > latestTimestamp)
    ) {
      latestTimestamp = timestamp;
      latestCheckedAt = check.checkedAt;
    }
  }

  return {
    checks: checks.length,
    providerCount: providers.size,
    queryCount: queries.size,
    latestCheckedAt,
    confidence: confidenceFromVisibilityCoverage(
      checks.length,
      providers.size,
      queries.size,
    ),
  } satisfies VisibilityMeta;
}

export function buildProviderMentionSummary(checks: VisibilityCheck[]) {
  return LLM_PROVIDER_ORDER.map((provider) => {
    const providerChecks = checks.filter(
      (check) => check.llmProvider === provider,
    );
    const mentioned = providerChecks.filter(
      (check) => check.brandMentioned,
    ).length;

    return {
      provider,
      label: PROVIDER_LABELS[provider] ?? provider,
      checks: providerChecks.length,
      mentioned,
      hasMentions: mentioned > 0,
    } satisfies ProviderMentionSummary;
  });
}
