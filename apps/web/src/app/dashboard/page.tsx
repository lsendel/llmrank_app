"use client";

import Link from "next/link";
import { PersonaDiscoveryModal } from "@/components/persona-discovery-modal";
import { Button } from "@/components/ui/button";
import { NextStepsCard } from "@/components/cards/next-steps-card";
import { PercentileBadge } from "@/components/percentile-badge";
import { StateMessage } from "@/components/ui/state";
import {
  DashboardAiFeaturesBanner,
  DashboardHeader,
  DashboardLastProjectCard,
  DashboardMobileQuickActions,
  DashboardQuickTools,
  DashboardSinceLastVisitCard,
  DashboardWidgets,
  DashboardWorkflowCard,
} from "./_components/dashboard-page-sections";
import { useDashboardPageData } from "./_hooks/use-dashboard-page-data";

export default function DashboardPage() {
  const {
    activity,
    activityStillLoading,
    bannerDismissed,
    closePersonaModal,
    dismissBanner,
    effectiveLastVisitAt,
    firstName,
    handleWidgetClick,
    lastProjectContext,
    loading,
    personaModalOpen,
    quickToolOrder,
    sinceLastVisit,
    stats,
    widgetOrder,
  } = useDashboardPageData();

  if (loading) {
    return (
      <StateMessage
        variant="loading"
        title="Loading dashboard"
        description="Fetching portfolio stats and recent crawl activity."
        className="py-16"
      />
    );
  }

  if (!stats) {
    return (
      <StateMessage
        variant="empty"
        title="No project data yet"
        description="Create your first project to start crawl-based insights and automation."
        className="py-16"
        action={
          <Button asChild>
            <Link href="/dashboard/projects/new">Create Project</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-8">
      <DashboardHeader firstName={firstName} />
      <DashboardWorkflowCard />
      <DashboardLastProjectCard lastProjectContext={lastProjectContext} />
      <DashboardSinceLastVisitCard
        sinceLastVisit={sinceLastVisit}
        effectiveLastVisitAt={effectiveLastVisitAt}
      />
      {activityStillLoading ? (
        <StateMessage
          variant="loading"
          title="Loading activity"
          description=""
          className="py-4"
        />
      ) : (
        <>
          <NextStepsCard stats={stats} activity={activity} />
          <DashboardQuickTools
            stats={stats}
            activity={activity}
            quickToolOrder={quickToolOrder}
          />
        </>
      )}
      {stats.avgScore > 0 && <PercentileBadge avgScore={stats.avgScore} />}
      <DashboardAiFeaturesBanner
        show={stats.totalCrawls === 0 && !bannerDismissed}
        onDismiss={dismissBanner}
      />
      <DashboardWidgets
        widgetOrder={widgetOrder}
        stats={stats}
        activity={activity}
        onWidgetClick={handleWidgetClick}
      />
      <DashboardMobileQuickActions />
      <PersonaDiscoveryModal
        open={personaModalOpen}
        onClose={closePersonaModal}
        defaultDomain={undefined}
      />
    </div>
  );
}
