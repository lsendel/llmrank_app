import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Your AI-Readiness Scan Results",
  description:
    "View your website's AI-readiness score across 37 factors with actionable recommendations to improve visibility in ChatGPT, Claude, and Perplexity.",
});

export default function ScanResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
