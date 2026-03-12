export interface ClassificationResult {
  sourceType: "organic" | "ai_referral" | "ai_bot" | "direct" | "social" | "other";
  aiProvider: string | null;
}

const AI_BOT_PATTERNS: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /gptbot|chatgpt-user/i, provider: "chatgpt" },
  { pattern: /claudebot|claude-web/i, provider: "claude" },
  { pattern: /perplexitybot/i, provider: "perplexity" },
  { pattern: /google-extended/i, provider: "gemini" },
  { pattern: /applebot-extended/i, provider: "apple_ai" },
  { pattern: /cohere-ai/i, provider: "cohere" },
  { pattern: /meta-externalagent/i, provider: "meta_ai" },
];

const AI_REFERRER_PATTERNS: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /chat\.openai\.com|chatgpt\.com/, provider: "chatgpt" },
  { pattern: /claude\.ai/, provider: "claude" },
  { pattern: /perplexity\.ai/, provider: "perplexity" },
  { pattern: /gemini\.google\.com|bard\.google\.com/, provider: "gemini" },
  { pattern: /\byou\.com/, provider: "you" },
  { pattern: /phind\.com/, provider: "phind" },
  { pattern: /copilot\.microsoft\.com/, provider: "copilot" },
];

const SEARCH_ENGINES = /google\.\w+\/search|bing\.com\/search|duckduckgo\.com|yahoo\.com\/search|baidu\.com\/s/;
const SOCIAL_PLATFORMS = /twitter\.com|x\.com|t\.co|linkedin\.com|facebook\.com|fb\.com|reddit\.com|youtube\.com/;

export function classifyTraffic(
  userAgent: string | null,
  referrer: string | null,
): ClassificationResult {
  // 1. Check UA for AI bots (highest priority)
  if (userAgent) {
    for (const { pattern, provider } of AI_BOT_PATTERNS) {
      if (pattern.test(userAgent)) {
        return { sourceType: "ai_bot", aiProvider: provider };
      }
    }
  }

  // 2. Check referrer for AI providers
  if (referrer) {
    for (const { pattern, provider } of AI_REFERRER_PATTERNS) {
      if (pattern.test(referrer)) {
        return { sourceType: "ai_referral", aiProvider: provider };
      }
    }

    // 3. Check for search engines
    if (SEARCH_ENGINES.test(referrer)) {
      return { sourceType: "organic", aiProvider: null };
    }

    // 4. Check for social platforms
    if (SOCIAL_PLATFORMS.test(referrer)) {
      return { sourceType: "social", aiProvider: null };
    }

    // 5. Has referrer but doesn't match anything
    return { sourceType: "other", aiProvider: null };
  }

  // 6. No referrer = direct
  return { sourceType: "direct", aiProvider: null };
}
