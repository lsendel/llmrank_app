import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI-Readiness Leaderboard",
  description:
    "See which websites score highest for AI-readiness. Compare domains across 37 factors and find out who leads in AI search visibility.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "AI-Readiness Leaderboard | LLM Rank",
    description:
      "Compare websites by AI-readiness score. See who leads in visibility across ChatGPT, Claude, and Perplexity.",
    url: "https://llmrank.app/leaderboard",
  },
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
