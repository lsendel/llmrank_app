/**
 * Centralized model selection for all LLM operations.
 * Change defaults here instead of hunting through individual files.
 */
export const LLM_MODELS = {
  scoring: "claude-haiku-4-5-20251001",
  summary: "claude-haiku-4-5-20251001",
  factExtraction: "claude-haiku-4-5-20251001",
  personas: "claude-sonnet-4-5-20250929",
  optimizer: "claude-sonnet-4-5-20250929",
  visibility: {
    claude: "claude-sonnet-4-5-20250929",
    chatgpt: "gpt-4o-mini",
    gemini: "gemini-2.0-flash",
    gemini_ai_mode: "gemini-2.0-flash",
  },
} as const;
