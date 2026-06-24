import type { Metadata } from "next";
import { buildPublicMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = buildPublicMetadata({
  title: "AI-Readiness Leaderboard",
  description:
    "See which websites score highest for AI-readiness. Compare domains across 37 factors and find out who leads in AI search visibility.",
  path: "/leaderboard",
  openGraphTitle: "AI-Readiness Leaderboard | LLM Rank",
  openGraphDescription:
    "Compare websites by AI-readiness score. See who leads in visibility across ChatGPT, Claude, and Perplexity.",
});

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
