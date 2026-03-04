import type { Metadata } from "next";
import { ScanPageClient } from "./client";
import {
  JsonLd,
  breadcrumbSchema,
  faqSchema,
  webPageSchema,
} from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Free AI SEO Scanner | LLM Rank",
  description:
    "Check if your website is ready for AI search engines. Get a free 37-factor audit for ChatGPT, Claude, and Perplexity visibility.",
  keywords: [
    "ai seo scanner",
    "llm seo audit",
    "chatgpt seo checker",
    "ai readiness score",
    "free seo audit for ai search",
  ],
  alternates: { canonical: "/scan" },
  openGraph: {
    title: "Free AI SEO Scanner",
    description:
      "Instant AI-readiness audit. See how your site relates to ChatGPT, Claude, and Perplexity.",
    url: "https://llmrank.app/scan",
  },
};

const SCAN_FAQ = [
  {
    question: "What does the free AI SEO scan include?",
    answer:
      "The scan evaluates your site across 37 factors including technical SEO, content quality, AI readiness, and performance, then returns prioritized issues and quick wins.",
  },
  {
    question: "Do I need to sign up before running the scan?",
    answer:
      "No. The first scan runs without sign-up. You can create a workspace afterward to automate recurring crawls, visibility checks, and reporting.",
  },
  {
    question: "Which AI platforms does this audit help with?",
    answer:
      "The scoring framework is built to improve discoverability and citation potential across ChatGPT, Claude, Perplexity, Gemini, and related AI-driven search experiences.",
  },
] as const;

export default function ScanPage() {
  return (
    <>
      <JsonLd
        data={webPageSchema({
          title: "Free AI SEO Scanner | LLM Rank",
          description:
            "Run a 37-factor AI-readiness audit and get prioritized fixes for AI search visibility.",
          path: "/scan",
          type: "WebPage",
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Free AI SEO Scanner", path: "/scan" },
        ])}
      />
      <JsonLd data={faqSchema([...SCAN_FAQ])} />
      <ScanPageClient />
    </>
  );
}
