import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your AI-Readiness Scan Results",
  description:
    "View your website's AI-readiness score across 37 factors with actionable recommendations to improve visibility in ChatGPT, Claude, and Perplexity.",
  alternates: { canonical: "/scan/results" },
  openGraph: {
    title: "AI-Readiness Scan Results | LLM Rank",
    description:
      "See how your website scores for AI search visibility across 37 factors.",
    url: "https://llmrank.app/scan/results",
  },
};

export default function ScanResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
