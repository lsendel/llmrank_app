"use client";

import React from "react";
import dynamic from "next/dynamic";
import { StateMessage } from "@/components/ui/state";

type ReportsTabProps = { projectId: string; crawlJobId: string | undefined; };
type CompetitorsTabProps = { projectId: string; };
type AiAnalysisTabProps = { crawlJobId?: string; };
type AiTrafficTabProps = { projectId: string; snippetEnabled: boolean; };

function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 pt-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg border bg-muted/30" />
        <div className="h-40 animate-pulse rounded-lg border bg-muted/30" />
      </div>
      <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
    </div>
  );
}

export class ProjectTabErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <StateMessage
          variant="error"
          title="This tab could not be loaded"
          description="Reload this section to continue."
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-8"
          retry={{ onClick: () => this.setState({ hasError: false }) }}
        />
      );
    }

    return this.props.children;
  }
}

export const PagesTab = dynamic(
  () => import("@/components/tabs/pages-tab").then((mod) => ({ default: mod.PagesTab })),
  { loading: () => <TabLoadingSkeleton /> },
);

export const IssuesTab = dynamic(
  () => import("@/components/tabs/issues-tab").then((mod) => ({ default: mod.IssuesTab })),
  { loading: () => <TabLoadingSkeleton /> },
);

export const HistoryTab = dynamic(
  () => import("@/components/tabs/history-tab").then((mod) => ({ default: mod.HistoryTab })),
  { loading: () => <TabLoadingSkeleton /> },
);

export const StrategyTab = dynamic(
  () => import("@/components/tabs/strategy-tab").then((mod) => ({ default: mod.StrategyTab })),
  { loading: () => <TabLoadingSkeleton /> },
);

export const VisibilityTab = dynamic(() => import("@/components/tabs/visibility-tab"), {
  loading: () => <TabLoadingSkeleton />,
});

export const IntegrationsTab = dynamic(() => import("@/components/tabs/integrations-tab"), {
  loading: () => <TabLoadingSkeleton />,
});

export const ReportsTab = dynamic<ReportsTabProps>(() => import("@/components/reports/reports-tab"), {
  loading: () => <TabLoadingSkeleton />,
});

export const LogsTab = dynamic(
  () => import("@/components/tabs/logs-tab").then((mod) => ({ default: mod.LogsTab })),
  { loading: () => <TabLoadingSkeleton /> },
);

export const AutomationTab = dynamic(
  () => import("@/components/tabs/automation-tab").then((mod) => ({ default: mod.AutomationTab })),
  { loading: () => <TabLoadingSkeleton /> },
);

export const AIVisibilityTab = dynamic(() => import("@/components/tabs/ai-visibility-tab"), {
  loading: () => <TabLoadingSkeleton />,
});

export const CompetitorsTab = dynamic<CompetitorsTabProps>(
  () => import("@/components/tabs/competitors-tab").then((mod) => ({ default: mod.CompetitorsTab })),
  { loading: () => <TabLoadingSkeleton /> },
);

export const PersonasTab = dynamic(
  () => import("@/components/tabs/personas-tab").then((mod) => ({ default: mod.PersonasTab })),
  { loading: () => <TabLoadingSkeleton /> },
);

export const KeywordsTab = dynamic(
  () => import("@/components/tabs/keywords-tab").then((mod) => ({ default: mod.KeywordsTab })),
  { loading: () => <TabLoadingSkeleton /> },
);

export const AiAnalysisTab = dynamic<AiAnalysisTabProps>(
  () => import("@/components/tabs/ai-analysis-tab").then((mod) => ({ default: mod.AiAnalysisTab })),
  { loading: () => <TabLoadingSkeleton /> },
);

export const AiTrafficTab = dynamic<AiTrafficTabProps>(
  () => import("@/components/tabs/ai-traffic-tab").then((mod) => ({ default: mod.AiTrafficTab })),
  { loading: () => <TabLoadingSkeleton /> },
);
