export const API_TOKEN_LIMITS: Record<string, number> = {
  free: 0,
  starter: 0,
  pro: 5,
  agency: 20,
};

export const API_TOKEN_SCOPES = [
  { value: "metrics:read", label: "Metrics (read)" },
  { value: "scores:read", label: "Scores (read)" },
  { value: "visibility:read", label: "Visibility (read)" },
] as const;

export const MCP_SETUP_SNIPPETS = {
  "Claude Code": `claude mcp add llm-boost \\
  --env LLM_BOOST_API_TOKEN=__VALUE__ \\
  -- npx -y @llmrank.app/mcp`,
  "Claude Code (team)": `claude mcp add llm-boost --scope project \\
  --env LLM_BOOST_API_TOKEN \\
  -- npx -y @llmrank.app/mcp`,
  "Cursor / Claude Desktop / Windsurf": `{
  "mcpServers": {
    "llm-boost": {
      "command": "npx",
      "args": ["-y", "@llmrank.app/mcp"],
      "env": {
        "LLM_BOOST_API_TOKEN": "__VALUE__"
      }
    }
  }
}`,
  "VS Code (Copilot)": `{
  "servers": {
    "llm-boost": {
      "command": "npx",
      "args": ["-y", "@llmrank.app/mcp"],
      "env": {
        "LLM_BOOST_API_TOKEN": "__VALUE__"
      }
    }
  }
}`,
} as const;

export function getMaxApiTokens(plan: string | null | undefined): number {
  return API_TOKEN_LIMITS[plan ?? "free"] ?? 0;
}

export function canManageApiTokens(plan: string | null | undefined): boolean {
  return plan === "pro" || plan === "agency";
}

export function resolveMcpSetupSnippets(plaintext: string) {
  return Object.entries(MCP_SETUP_SNIPPETS).map(([name, snippet]) => ({
    name,
    snippet: snippet.replace(/__VALUE__/g, plaintext),
  }));
}

export function formatTokenDate(
  timestamp: string | null | undefined,
): string | null {
  if (!timestamp) return null;

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString();
}

export function getTokenCreatedLabel(createdAt: string): string {
  return `Created ${formatTokenDate(createdAt) ?? "unknown"}`;
}

export function getTokenLastUsedLabel(lastUsedAt: string | null): string {
  return lastUsedAt
    ? `Last used ${formatTokenDate(lastUsedAt) ?? "unknown"}`
    : "Never used";
}
