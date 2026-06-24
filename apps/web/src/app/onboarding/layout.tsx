import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo-metadata";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Onboarding | LLM Rank",
  description: "Workspace onboarding flow for new LLM Rank users.",
});

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
