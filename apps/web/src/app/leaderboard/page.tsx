import type { Metadata } from "next";
import Link from "next/link";
import { LeaderboardClient } from "./client";

export const metadata: Metadata = {
  title: "AI Readiness Leaderboard | LLM Rank",
  description:
    "See which websites are most visible in ChatGPT, Claude, and Perplexity. The leaderboard ranks sites by their AI-readiness score across 37 factors.",
  openGraph: {
    title: "AI Readiness Leaderboard",
    description:
      "See which websites are most visible in ChatGPT, Claude, and Perplexity. Ranged by 37-factor AI-readiness scores.",
    url: "https://llmrank.app/leaderboard",
  },
};

export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <LeaderboardClient />

      <div className="mt-12 rounded-lg border border-border bg-muted/40 p-6">
        <h2 className="text-lg font-bold text-foreground">How we rank sites</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Direct answer: The leaderboard displays the top-performing sites that
          have opted in to share their scores publicly. Rankings are based on
          the Overall Score, which is a weighted average of four key categories:
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">
              AI Readiness (30%)
            </h3>
            <p className="text-xs text-muted-foreground">
              Evaluates citation potential, Q&A formatting, and entity clarity.
            </p>
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">
              Content Quality (30%)
            </h3>
            <p className="text-xs text-muted-foreground">
              Measures depth, readability (Flesch score), and authority signals.
            </p>
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">
              Technical SEO (25%)
            </h3>
            <p className="text-xs text-muted-foreground">
              Checks meta tags, canonicals, robots.txt, and structured data.
            </p>
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">Performance (15%)</h3>
            <p className="text-xs text-muted-foreground">
              Validates Core Web Vitals, accessibility, and mobile
              responsiveness.
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Want to see where you rank? Run a{" "}
          <Link
            href="/scan"
            className="font-medium text-primary hover:underline"
          >
            free scan
          </Link>{" "}
          to get your baseline score.
        </p>
      </div>
    </div>
  );
}
