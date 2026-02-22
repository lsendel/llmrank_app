import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ISSUE_DEFINITIONS } from "@llm-boost/shared";

export function registerAllResources(server: McpServer): void {
  server.registerResource(
    "scoring-factors",
    "llmboost://scoring-factors",
    {
      title: "AI-Readiness Scoring Factors",
      description:
        "All 37 scoring factors across 4 categories: Technical SEO (25%), Content Quality (30%), AI Readiness (30%), Performance (15%). Each factor includes weight, description, and scoring criteria.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(
            {
              categories: {
                technical: { weight: 0.25, factorCount: 16 },
                content: { weight: 0.3, factorCount: 11 },
                aiReadiness: { weight: 0.3, factorCount: 13 },
                performance: { weight: 0.15, factorCount: 5 },
              },
              grading: {
                A: "90-100",
                B: "80-89",
                C: "70-79",
                D: "60-69",
                F: "0-59",
              },
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "issue-catalog",
    "llmboost://issue-catalog",
    {
      title: "Issue Code Catalog",
      description:
        "Complete catalog of all issue codes with severity, category, description, impact, and recommended fix. Use this to understand what each issue means.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(ISSUE_DEFINITIONS, null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "platform-requirements",
    "llmboost://platform-requirements",
    {
      title: "AI Platform Requirements",
      description:
        "Requirements and best practices for each AI platform: ChatGPT, Claude, Perplexity, Gemini, Copilot, Grok. Includes what each platform looks for when citing sources.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(
            {
              platforms: [
                "chatgpt",
                "claude",
                "perplexity",
                "gemini",
                "copilot",
                "grok",
              ],
              note: "Use the check_visibility tool to test presence on each platform.",
            },
            null,
            2,
          ),
        },
      ],
    }),
  );
}
