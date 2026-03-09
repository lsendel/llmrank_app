import type { LogAnalysisSummary, LogUpload } from "@/lib/api";

export const BOT_COLORS: Record<string, string> = {
  "GPTBot (OpenAI)": "bg-green-100 text-green-800",
  "ChatGPT-User": "bg-green-100 text-green-800",
  "ClaudeBot (Anthropic)": "bg-purple-100 text-purple-800",
  Anthropic: "bg-purple-100 text-purple-800",
  PerplexityBot: "bg-blue-100 text-blue-800",
  "Google Extended": "bg-yellow-100 text-yellow-800",
  Googlebot: "bg-yellow-100 text-yellow-800",
  Bingbot: "bg-cyan-100 text-cyan-800",
  Applebot: "bg-gray-100 text-gray-800",
};

export function botBadgeClass(bot: string) {
  return BOT_COLORS[bot] ?? "";
}

export function formatAiBotRate(
  summary: Pick<LogAnalysisSummary, "totalRequests" | "crawlerRequests">,
) {
  if (summary.totalRequests <= 0) return "0%";
  return `${((summary.crawlerRequests / summary.totalRequests) * 100).toFixed(1)}%`;
}

export function resolveLogSummary({
  latestSummary,
  uploads,
}: {
  latestSummary: LogAnalysisSummary | null;
  uploads?: LogUpload[];
}): LogAnalysisSummary | null {
  return latestSummary ?? uploads?.[0]?.summary ?? null;
}
