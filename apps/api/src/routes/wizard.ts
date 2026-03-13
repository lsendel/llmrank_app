import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { suggestKeywords } from "@llm-boost/llm";

export const wizardRoutes = new Hono<AppEnv>();
wizardRoutes.use("*", authMiddleware);

// Extract keywords from a domain's homepage
wizardRoutes.post("/extract-keywords", async (c) => {
  const { domain } = await c.req.json<{ domain: string }>();

  // Fetch homepage
  const url = `https://${domain.replace(/^https?:\/\//, "")}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "LLMRank-Bot/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  const html = await res.text();

  // Extract title, meta, h1-h3 text
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const metaMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/is,
  );
  const headingMatches = [...html.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gis)];

  const extractedKeywords = [
    titleMatch?.[1]?.trim(),
    metaMatch?.[1]?.trim(),
    ...headingMatches.map((m) => m[1].replace(/<[^>]+>/g, "").trim()),
  ]
    .filter(Boolean)
    .slice(0, 10) as string[];

  // Get AI suggestions using existing keyword suggester
  const aiSuggestions = await suggestKeywords(
    c.env.ANTHROPIC_API_KEY,
    domain,
    extractedKeywords.join(", "),
  );

  return c.json({
    extracted: extractedKeywords.map((k) => ({
      keyword: k,
      source: "extracted" as const,
    })),
    aiSuggested: aiSuggestions.map((k: string) => ({
      keyword: k,
      source: "ai" as const,
    })),
  });
});

// Suggest competitors for a domain
wizardRoutes.post("/suggest-competitors", async (c) => {
  const { domain, keywords } = await c.req.json<{
    domain: string;
    keywords: string[];
  }>();

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You identify competitor websites. Return JSON array of objects with "domain" and "reason" fields. Return 5-8 competitors. Only return actual competitor domains, not aggregators or directories.`,
    messages: [
      {
        role: "user",
        content: `Find competitors for ${domain}. Their focus keywords: ${keywords.join(", ")}. Return JSON array.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const competitors = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
  return c.json({ competitors });
});
