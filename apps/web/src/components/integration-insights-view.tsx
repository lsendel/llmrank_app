"use client";

import type { IntegrationInsights } from "@/lib/api";
import { buildSummaryItems } from "./integration-insights-view-helpers";
import {
  ClaritySection,
  ConnectToUnlockCard,
  Ga4Section,
  GscIndexStatusSection,
  GscQueriesSection,
  IntegrationInsightsSummaryBanner,
  MetaSection,
  PsiSection,
} from "./integration-insights-view-sections";

interface Props {
  insights: IntegrationInsights;
  connectedProviders?: string[];
}

export function IntegrationInsightsView({
  insights,
  connectedProviders = [],
}: Props) {
  if (!insights.integrations) return null;

  const { gsc, ga4, clarity, meta, psi } = insights.integrations;
  const summaryItems = buildSummaryItems(insights.integrations);

  return (
    <div className="space-y-6">
      <IntegrationInsightsSummaryBanner summaryItems={summaryItems} />

      {gsc && gsc.topQueries.length > 0 && <GscQueriesSection gsc={gsc} />}
      {gsc && gsc.topQueries.length === 0 && (
        <GscIndexStatusSection gsc={gsc} />
      )}
      {ga4 && <Ga4Section ga4={ga4} />}

      {!gsc && (
        <ConnectToUnlockCard
          provider="Google Search Console"
          description="See your top queries, impressions, clicks, and search positions"
          isConnected={connectedProviders.includes("gsc")}
        />
      )}
      {!ga4 && (
        <ConnectToUnlockCard
          provider="Google Analytics 4"
          description="Track bounce rate, engagement time, and top landing pages"
          isConnected={connectedProviders.includes("ga4")}
        />
      )}

      {meta && <MetaSection meta={meta} />}
      {!meta && (
        <ConnectToUnlockCard
          provider="Meta"
          description="See social engagement, shares, reactions, and ad performance data"
          isConnected={connectedProviders.includes("meta")}
        />
      )}

      {clarity && <ClaritySection clarity={clarity} />}
      {!clarity && (
        <ConnectToUnlockCard
          provider="Microsoft Clarity"
          description="Monitor UX scores and detect rage clicks"
          isConnected={connectedProviders.includes("clarity")}
        />
      )}

      {psi ? (
        <PsiSection psi={psi} />
      ) : (
        <ConnectToUnlockCard
          provider="PageSpeed Insights"
          description="See Core Web Vitals and lab performance scores"
          isConnected={connectedProviders.includes("psi")}
        />
      )}
    </div>
  );
}
