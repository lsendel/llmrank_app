interface CitationReadinessInput {
  llmCitationWorthiness: number | null;
  schemaTypes: string[];
  structuredDataCount: number;
  externalLinks: number;
  facts: { content: string; citabilityScore: number }[];
}

interface CitationReadinessResult {
  score: number;
  components: {
    factCitability: number;
    llmCitationWorthiness: number;
    schemaQuality: number;
    structuredDataCount: number;
  };
  topCitableFacts: { content: string; citabilityScore: number }[];
}

// Schema types that make content more citable by LLMs
const HIGH_CITABILITY_SCHEMAS = new Set([
  "Article",
  "NewsArticle",
  "BlogPosting",
  "ScholarlyArticle",
  "FAQPage",
  "HowTo",
  "TechArticle",
  "Dataset",
  "Report",
]);

export function computeCitationReadiness(
  input: CitationReadinessInput,
): CitationReadinessResult {
  // 1. Fact citability: average of top facts' scores (0-100)
  const sortedFacts = [...input.facts].sort(
    (a, b) => b.citabilityScore - a.citabilityScore,
  );
  const topFacts = sortedFacts.slice(0, 5);
  const factCitability = topFacts.length
    ? Math.round(
        topFacts.reduce((s, f) => s + f.citabilityScore, 0) / topFacts.length,
      )
    : 0;

  // 2. LLM citation worthiness (0-100, or 0 if unavailable)
  const llmScore = input.llmCitationWorthiness ?? 0;

  // 3. Schema quality: bonus for having high-citability schema types (0-100)
  const citableSchemaCount = input.schemaTypes.filter((t) =>
    HIGH_CITABILITY_SCHEMAS.has(t),
  ).length;
  const schemaQuality = Math.min(
    100,
    citableSchemaCount * 30 + (input.structuredDataCount > 0 ? 10 : 0),
  );

  // 4. External links as authority signal (0-20 bonus, capped)
  const linkBonus = Math.min(20, input.externalLinks * 2);

  // Weighted composite:
  // - LLM citation worthiness: 35% (if available, otherwise redistribute)
  // - Fact citability: 30%
  // - Schema quality: 25%
  // - Link authority bonus: 10%
  let score: number;
  if (input.llmCitationWorthiness != null) {
    score = Math.round(
      llmScore * 0.35 +
        factCitability * 0.3 +
        schemaQuality * 0.25 +
        linkBonus * 0.5,
    );
  } else {
    // Redistribute LLM weight to facts and schema
    score = Math.round(
      factCitability * 0.5 + schemaQuality * 0.35 + linkBonus * 0.75,
    );
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    components: {
      factCitability,
      llmCitationWorthiness: llmScore,
      schemaQuality,
      structuredDataCount: input.structuredDataCount,
    },
    topCitableFacts: topFacts,
  };
}
