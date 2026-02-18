export interface AIVisibilityInput {
  /** % of tracked keywords mentioned across LLMs (0-1) */
  llmMentionRate: number;
  /** % of tracked keywords found in AI search (0-1) */
  aiSearchPresenceRate: number;
  /** Domain's mention share vs competitors (0-1) */
  shareOfVoice: number;
  /** Normalized backlink authority (0-1) */
  backlinkAuthoritySignal: number;
}

export interface AIVisibilityResult {
  overall: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: {
    llmMentions: number;
    aiSearch: number;
    shareOfVoice: number;
    backlinkAuthority: number;
  };
}

const WEIGHTS = {
  llmMentions: 40,
  aiSearch: 30,
  shareOfVoice: 20,
  backlinkAuthority: 10,
} as const;

export function computeAIVisibilityScore(
  input: AIVisibilityInput,
): AIVisibilityResult {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  const llm = clamp(input.llmMentionRate) * WEIGHTS.llmMentions;
  const ai = clamp(input.aiSearchPresenceRate) * WEIGHTS.aiSearch;
  const sov = clamp(input.shareOfVoice) * WEIGHTS.shareOfVoice;
  const bl = clamp(input.backlinkAuthoritySignal) * WEIGHTS.backlinkAuthority;

  const overall = Math.round(llm + ai + sov + bl);

  return {
    overall,
    grade: letterGrade(overall),
    breakdown: {
      llmMentions: Math.round(llm),
      aiSearch: Math.round(ai),
      shareOfVoice: Math.round(sov),
      backlinkAuthority: Math.round(bl),
    },
  };
}

function letterGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
