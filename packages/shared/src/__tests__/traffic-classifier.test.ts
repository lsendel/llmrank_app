import { describe, it, expect } from "vitest";
import { classifyTraffic } from "../utils/traffic-classifier";

describe("classifyTraffic", () => {
  describe("AI bot detection (user-agent)", () => {
    it.each([
      ["GPTBot/1.0", "chatgpt"],
      ["Mozilla/5.0 ChatGPT-User/1.0", "chatgpt"],
      ["ClaudeBot/1.0", "claude"],
      ["Claude-Web/1.0", "claude"],
      ["PerplexityBot/1.0", "perplexity"],
      ["Mozilla/5.0 (compatible; Google-Extended)", "gemini"],
      ["Applebot-Extended/1.0", "apple_ai"],
      ["cohere-ai", "cohere"],
      ["Meta-ExternalAgent/1.0", "meta_ai"],
    ])("detects %s as ai_bot/%s", (ua, provider) => {
      const result = classifyTraffic(ua, null);
      expect(result.sourceType).toBe("ai_bot");
      expect(result.aiProvider).toBe(provider);
    });
  });

  describe("AI referral detection (referrer)", () => {
    it.each([
      ["https://chat.openai.com/share/abc", "chatgpt"],
      ["https://chatgpt.com/c/abc", "chatgpt"],
      ["https://claude.ai/chat/abc", "claude"],
      ["https://www.perplexity.ai/search/abc", "perplexity"],
      ["https://gemini.google.com/app/abc", "gemini"],
      ["https://bard.google.com/chat", "gemini"],
      ["https://you.com/search?q=test", "you"],
      ["https://phind.com/search?q=test", "phind"],
      ["https://copilot.microsoft.com/chat", "copilot"],
    ])("detects referrer %s as ai_referral/%s", (ref, provider) => {
      const result = classifyTraffic("Mozilla/5.0", ref);
      expect(result.sourceType).toBe("ai_referral");
      expect(result.aiProvider).toBe(provider);
    });
  });

  describe("standard traffic classification", () => {
    it("detects Google organic", () => {
      const result = classifyTraffic("Mozilla/5.0", "https://www.google.com/search?q=test");
      expect(result.sourceType).toBe("organic");
      expect(result.aiProvider).toBeNull();
    });

    it("detects Bing organic", () => {
      const result = classifyTraffic("Mozilla/5.0", "https://www.bing.com/search?q=test");
      expect(result.sourceType).toBe("organic");
    });

    it("detects social traffic from Twitter", () => {
      const result = classifyTraffic("Mozilla/5.0", "https://t.co/abc123");
      expect(result.sourceType).toBe("social");
    });

    it("detects social traffic from LinkedIn", () => {
      const result = classifyTraffic("Mozilla/5.0", "https://www.linkedin.com/feed");
      expect(result.sourceType).toBe("social");
    });

    it("classifies no referrer as direct", () => {
      const result = classifyTraffic("Mozilla/5.0", null);
      expect(result.sourceType).toBe("direct");
      expect(result.aiProvider).toBeNull();
    });

    it("classifies empty referrer as direct", () => {
      const result = classifyTraffic("Mozilla/5.0", "");
      expect(result.sourceType).toBe("direct");
    });

    it("classifies unknown referrer as other", () => {
      const result = classifyTraffic("Mozilla/5.0", "https://some-random-site.com/page");
      expect(result.sourceType).toBe("other");
    });
  });

  describe("edge cases", () => {
    it("bot UA takes priority over AI referrer", () => {
      const result = classifyTraffic("GPTBot/1.0", "https://claude.ai/chat");
      expect(result.sourceType).toBe("ai_bot");
      expect(result.aiProvider).toBe("chatgpt");
    });

    it("handles null UA and null referrer", () => {
      const result = classifyTraffic(null, null);
      expect(result.sourceType).toBe("direct");
      expect(result.aiProvider).toBeNull();
    });

    it("is case-insensitive for UA matching", () => {
      const result = classifyTraffic("gptbot/1.0", null);
      expect(result.sourceType).toBe("ai_bot");
      expect(result.aiProvider).toBe("chatgpt");
    });
  });
});
