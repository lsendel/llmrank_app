import type { Metadata } from "next";
import { ScanPageClient } from "./client";

export const metadata: Metadata = {
  title: "Free AI SEO Scanner | LLM Rank",
  description:
    "Check if your website is ready for AI search engines. Get a free 37-factor audit for ChatGPT, Claude, and Perplexity visibility.",
  openGraph: {
    title: "Free AI SEO Scanner",
    description:
      "Instant AI-readiness audit. See how your site relates to ChatGPT, Claude, and Perplexity.",
    url: "https://llmrank.app/scan",
  },
};

export default function ScanPage() {
  return <ScanPageClient />;
}
