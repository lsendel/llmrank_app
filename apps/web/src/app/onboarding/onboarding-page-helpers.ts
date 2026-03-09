import type { CrawlData } from "@/hooks/use-onboarding-wizard";

export const ONBOARDING_TIPS = [
  "73% of AI citations come from pages with structured data.",
  "Pages with clear H1-H3 hierarchy rank 2x better in AI responses.",
  "Sites with llms.txt get 40% more AI crawler visits.",
  "Content over 1,500 words is 3x more likely to be cited by AI.",
  "Schema markup helps AI understand your content structure.",
] as const;

export const ONBOARDING_WORK_STYLE_OPTIONS = [
  { value: "client_reporting", label: "Manage client sites" },
  { value: "own_site_optimization", label: "Optimize my site" },
  { value: "technical_audit", label: "Technical audits" },
] as const;

export const ONBOARDING_TEAM_SIZE_OPTIONS = [
  { value: "solo", label: "Just me" },
  { value: "small_team", label: "2-10" },
  { value: "large_team", label: "10+" },
] as const;

export const ONBOARDING_CRAWL_SCHEDULE_OPTIONS = [
  { value: "weekly", label: "Weekly (recommended)" },
  { value: "manual", label: "Manual" },
] as const;

export const ONBOARDING_SCORE_BREAKDOWN_LABELS = [
  { key: "technical", label: "Technical" },
  { key: "content", label: "Content" },
  { key: "aiReadiness", label: "AI Readiness" },
  { key: "performance", label: "Performance" },
] as const;

export function getOnboardingStepTitle(crawl: CrawlData | null): string {
  if (crawl?.status === "complete") {
    return "Your AI-Readiness Score";
  }

  if (crawl?.status === "failed") {
    return "Scan Failed";
  }

  return "Scanning your site...";
}
