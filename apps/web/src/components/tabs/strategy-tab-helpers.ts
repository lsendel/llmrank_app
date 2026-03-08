import type {
  StrategyCompetitor,
  StrategyPersona,
  VisibilityGap,
} from "@/lib/api";

export const DEMAND_FLOW_NICHE = "AI SEO and Content Optimization";
export const DEFAULT_VISIBILITY_PROVIDERS = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
] as const;

type PersonaIdentity = Pick<StrategyPersona, "name" | "role">;

export function buildPersonaIdentityKey(persona: PersonaIdentity): string {
  return `${persona.name.toLowerCase()}::${persona.role.toLowerCase()}`;
}

export function buildCompetitorDomainSet(
  competitors: StrategyCompetitor[] | undefined,
): Set<string> {
  return new Set((competitors ?? []).map((item) => item.domain.toLowerCase()));
}

export function getRecommendedCompetitorDomains({
  visibilityGaps,
  existingCompetitorDomains,
  limit = 6,
}: {
  visibilityGaps: VisibilityGap[] | undefined;
  existingCompetitorDomains: Set<string>;
  limit?: number;
}): string[] {
  const domains = new Set<string>();

  for (const gap of visibilityGaps ?? []) {
    for (const cited of gap.competitorsCited ?? []) {
      const domain = cited.domain?.trim().toLowerCase();
      if (!domain || existingCompetitorDomains.has(domain)) continue;
      domains.add(domain);
    }
  }

  return Array.from(domains).slice(0, limit);
}

export function getSuggestedKeywordSelection({
  suggestedKeywords,
  savedKeywords,
  autoSelectLimit = 10,
}: {
  suggestedKeywords: string[];
  savedKeywords: Array<{ keyword: string }> | undefined;
  autoSelectLimit?: number;
}): { filtered: string[]; autoSelected: string[] } {
  const existing = new Set(
    (savedKeywords ?? []).map((keyword) => keyword.keyword.toLowerCase()),
  );
  const filtered = suggestedKeywords.filter(
    (keyword) => !existing.has(keyword.toLowerCase()),
  );

  return {
    filtered,
    autoSelected: filtered.slice(0, autoSelectLimit),
  };
}

export function toggleSelectedKeyword(
  current: string[],
  keyword: string,
): string[] {
  return current.includes(keyword)
    ? current.filter((item) => item !== keyword)
    : [...current, keyword];
}
