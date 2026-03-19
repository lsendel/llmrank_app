"use client";

import { useState } from "react";
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
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Gauge,
  MousePointerClick,
  Search,
  Share2,
} from "lucide-react";

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <Icon className="h-4 w-4 text-primary" />
        {title}
        {open ? (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="border-t">{children}</div>}
    </div>
  );
}

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

  // Determine which is the first provider with data so it opens by default
  const firstWithData = gsc
    ? "gsc"
    : ga4
      ? "ga4"
      : meta
        ? "meta"
        : clarity
          ? "clarity"
          : psi
            ? "psi"
            : null;

  return (
    <div className="space-y-6">
      <IntegrationInsightsSummaryBanner summaryItems={summaryItems} />

      {gsc ? (
        <CollapsibleSection
          title="Google Search Console"
          icon={Search}
          defaultOpen={firstWithData === "gsc"}
        >
          {gsc.topQueries.length > 0 ? (
            <GscQueriesSection gsc={gsc} />
          ) : (
            <GscIndexStatusSection gsc={gsc} />
          )}
        </CollapsibleSection>
      ) : (
        <ConnectToUnlockCard
          provider="Google Search Console"
          description="See your top queries, impressions, clicks, and search positions"
          isConnected={connectedProviders.includes("gsc")}
        />
      )}

      {ga4 ? (
        <CollapsibleSection
          title="Google Analytics 4"
          icon={Activity}
          defaultOpen={firstWithData === "ga4"}
        >
          <Ga4Section ga4={ga4} />
        </CollapsibleSection>
      ) : (
        <ConnectToUnlockCard
          provider="Google Analytics 4"
          description="Track bounce rate, engagement time, and top landing pages"
          isConnected={connectedProviders.includes("ga4")}
        />
      )}

      {meta ? (
        <CollapsibleSection
          title="Meta"
          icon={Share2}
          defaultOpen={firstWithData === "meta"}
        >
          <MetaSection meta={meta} />
        </CollapsibleSection>
      ) : (
        <ConnectToUnlockCard
          provider="Meta"
          description="See social engagement, shares, reactions, and ad performance data"
          isConnected={connectedProviders.includes("meta")}
        />
      )}

      {clarity ? (
        <CollapsibleSection
          title="Microsoft Clarity"
          icon={MousePointerClick}
          defaultOpen={firstWithData === "clarity"}
        >
          <ClaritySection clarity={clarity} />
        </CollapsibleSection>
      ) : (
        <ConnectToUnlockCard
          provider="Microsoft Clarity"
          description="Monitor UX scores and detect rage clicks"
          isConnected={connectedProviders.includes("clarity")}
        />
      )}

      {psi ? (
        <CollapsibleSection
          title="PageSpeed Insights"
          icon={Gauge}
          defaultOpen={firstWithData === "psi"}
        >
          <PsiSection psi={psi} />
        </CollapsibleSection>
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
