import type { ExtractedData, LLMContentScores } from "@llm-boost/shared";
import { makeFixture, type GoldenFixture } from "./_builder";

/**
 * LLM-content-score gating fixtures — the regression lock for #108 / #114.
 *
 * `llmContentScores` are only present for the top-N pages that get LLM-scored.
 * When present + poor they must DEDUCT (CONTENT_DEPTH / CONTENT_CLARITY /
 * CONTENT_AUTHORITY / CITATION_WORTHINESS / POOR_QUESTION_COVERAGE). The
 * with/without pair below is identical except for `llmScores`, so the harness
 * can assert that the WITHOUT page scores >= the WITH page on content and AI
 * readiness — i.e. if the LLM metric silently dies (drops to null), content is
 * INFLATED, which is exactly the #108 breakage this locks against.
 */

// Shared page shape for the with/without pair — only `llmScores` differs.
const pairExtracted: Partial<ExtractedData> = {
  avg_sentence_length: 15,
};

const poorLlmScores: LLMContentScores = {
  clarity: 45,
  authority: 50,
  comprehensiveness: 40,
  structure: 42, // < 50 → POOR_QUESTION_COVERAGE
  citation_worthiness: 48,
};

export const llmGatingFixtures: GoldenFixture[] = [
  makeFixture(
    "llm-scored-clean",
    "A top-N page that WAS LLM-scored and scored well (all 100). The LLM " +
      "factors are present but deduct nothing — a high-quality scored page stays " +
      "clean.",
    ["healthcare", "llm-gating", "clean"],
    {
      page: {
        contentHash: "llm-clean-hash",
        llmScores: {
          clarity: 100,
          authority: 100,
          comprehensiveness: 100,
          structure: 100,
          citation_worthiness: 100,
        },
      },
    },
  ),

  makeFixture(
    "llm-scored-poor-with",
    "A top-N page LLM-scored as POOR. WITH scores present, the engine deducts " +
      "CONTENT_DEPTH/CLARITY/AUTHORITY (content) and CITATION_WORTHINESS + " +
      "POOR_QUESTION_COVERAGE (AI readiness).",
    ["healthcare", "llm-gating"],
    {
      page: { contentHash: "llm-poor-hash", llmScores: poorLlmScores },
      extracted: pairExtracted,
    },
  ),

  makeFixture(
    "llm-scored-poor-without",
    "The SAME page as llm-scored-poor-with but NOT LLM-scored (llmScores null). " +
      "All LLM-driven deductions vanish, so content/AI scores are HIGHER. Locks " +
      "the #108/#114 'dead LLM metric inflates content_score' failure mode.",
    ["healthcare", "llm-gating"],
    {
      page: { contentHash: "llm-poor-hash", llmScores: null },
      extracted: pairExtracted,
    },
  ),
];
