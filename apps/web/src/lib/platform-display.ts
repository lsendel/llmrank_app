import type { LLMPlatformId } from "@llm-boost/shared";

/**
 * Single source of truth for how each AI platform is shown in the UI (label +
 * icon). Keyed by the internal platform id (chatgpt, gemini_ai_mode, …) so it
 * works for stored `platformScores`. Replaces the hardcoded icon map that lived
 * in platform-readiness-badges (which was missing `copilot`).
 */
export const PLATFORM_DISPLAY: Record<
  LLMPlatformId,
  { label: string; icon: string }
> = {
  chatgpt: { label: "ChatGPT", icon: "\u{1F916}" },
  perplexity: { label: "Perplexity", icon: "\u{1F50D}" },
  claude: { label: "Claude", icon: "\u{1F7E0}" },
  gemini: { label: "Gemini", icon: "\u{1F48E}" },
  grok: { label: "Grok", icon: "⚡" },
  copilot: { label: "Copilot", icon: "\u{1F537}" },
  gemini_ai_mode: { label: "Gemini AI Mode", icon: "✨" },
};

const FALLBACK = { label: "", icon: "\u{1F539}" };

/** Display label + icon for a platform id; falls back to the raw id. */
export function platformDisplay(id: string): { label: string; icon: string } {
  const meta = PLATFORM_DISPLAY[id as LLMPlatformId];
  if (meta) return meta;
  return { label: id, icon: FALLBACK.icon };
}

/** Icon keyed by display label — for components that only have the label. */
export const PLATFORM_ICON_BY_LABEL: Record<string, string> =
  Object.fromEntries(
    Object.values(PLATFORM_DISPLAY).map((m) => [m.label, m.icon]),
  );
