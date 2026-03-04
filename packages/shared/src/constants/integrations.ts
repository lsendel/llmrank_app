import type { PlanTier } from "./plans";

export const INTEGRATION_PROVIDERS = [
  "gsc",
  "psi",
  "ga4",
  "clarity",
  "meta",
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_META: Record<
  IntegrationProvider,
  {
    label: string;
    authType: "oauth2" | "api_key";
    description: string;
  }
> = {
  gsc: {
    label: "Google Search Console",
    authType: "oauth2",
    description: "Indexed pages, search queries, crawl stats",
  },
  psi: {
    label: "PageSpeed Insights",
    authType: "api_key",
    description: "Core Web Vitals and lab performance scores",
  },
  ga4: {
    label: "Google Analytics 4",
    authType: "oauth2",
    description: "Engagement metrics, bounce rate, sessions",
  },
  clarity: {
    label: "Microsoft Clarity",
    authType: "api_key",
    description: "Heatmaps, dead clicks, rage clicks, scroll depth",
  },
  meta: {
    label: "Meta",
    authType: "oauth2",
    description: "Social engagement, shares, reactions, ad performance",
  },
};

export const PLAN_INTEGRATION_ACCESS: Record<PlanTier, IntegrationProvider[]> =
  {
    free: ["meta"],
    starter: ["meta"],
    pro: ["gsc", "psi", "meta"],
    agency: ["gsc", "psi", "ga4", "clarity", "meta"],
  };
