import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shouldShowPersonaModal } from "@/components/persona-discovery-modal";
import { useUser } from "@/lib/auth-hooks";
import { api } from "@/lib/api";
import { useApiSWR } from "@/lib/use-api-swr";
import { useDashboardStats, useRecentActivity } from "@/hooks/use-dashboard";
import { usePersonaLayout } from "@/hooks/use-persona-layout";
import { track } from "@/lib/telemetry";
import {
  getLastProjectContext,
  normalizeLastProjectContext,
  pickMostRecentProjectContext,
  saveLastProjectContext,
} from "@/lib/workflow-memory";
import {
  normalizeVisitTimestamp,
  pickMostRecentVisitTimestamp,
} from "@/lib/visit-memory";
import {
  resolveDashboardQuickToolOrder,
  type DashboardQuickToolId,
} from "@/lib/personalization-layout";
import {
  buildSinceLastVisitSummary,
  DASHBOARD_LAST_VISIT_KEY,
} from "../dashboard-page-helpers";
import type { DashboardWidgetId } from "@llm-boost/shared";

const AI_FEATURES_BANNER_DISMISSED_KEY = "ai-features-banner-dismissed";

export function useDashboardPageData() {
  const { user } = useUser();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(AI_FEATURES_BANNER_DISMISSED_KEY) === "1";
  });
  const hasSyncedDashboardVisitRef = useRef(false);
  const [lastVisitAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;

    const previous = normalizeVisitTimestamp(
      window.localStorage.getItem(DASHBOARD_LAST_VISIT_KEY),
    );
    window.localStorage.setItem(
      DASHBOARD_LAST_VISIT_KEY,
      new Date().toISOString(),
    );
    return previous;
  });
  const [localLastProjectContext] = useState(() => getLastProjectContext());
  const [personaDismissed, setPersonaDismissed] = useState(false);

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();
  const { data: accountPreferences, isLoading: accountPreferencesLoading } =
    useApiSWR(
      "account-preferences",
      useCallback(() => api.account.getPreferences(), []),
    );
  const { data: accountData } = useApiSWR(
    "account-me",
    useCallback(() => api.account.getMe(), []),
  );

  const effectiveLastVisitAt = useMemo(
    () =>
      pickMostRecentVisitTimestamp([
        lastVisitAt,
        normalizeVisitTimestamp(accountPreferences?.dashboardLastVisitedAt),
      ]),
    [accountPreferences?.dashboardLastVisitedAt, lastVisitAt],
  );
  const serverLastProjectContext = useMemo(
    () => normalizeLastProjectContext(accountPreferences?.lastProjectContext),
    [accountPreferences?.lastProjectContext],
  );
  const lastProjectContext = useMemo(
    () =>
      pickMostRecentProjectContext([
        localLastProjectContext,
        serverLastProjectContext,
      ]),
    [localLastProjectContext, serverLastProjectContext],
  );

  useEffect(() => {
    if (!serverLastProjectContext) return;
    if (!localLastProjectContext) {
      saveLastProjectContext(serverLastProjectContext);
      return;
    }
    const latest = pickMostRecentProjectContext([
      localLastProjectContext,
      serverLastProjectContext,
    ]);
    if (latest?.visitedAt === serverLastProjectContext.visitedAt) {
      saveLastProjectContext(serverLastProjectContext);
    }
  }, [localLastProjectContext, serverLastProjectContext]);

  useEffect(() => {
    if (hasSyncedDashboardVisitRef.current) return;
    if (accountPreferencesLoading || typeof window === "undefined") return;

    hasSyncedDashboardVisitRef.current = true;
    const currentVisitAt =
      normalizeVisitTimestamp(
        window.localStorage.getItem(DASHBOARD_LAST_VISIT_KEY),
      ) ?? new Date().toISOString();
    void api.account
      .updatePreferences({ dashboardLastVisitedAt: currentVisitAt })
      .catch(() => {
        // Keep local-only baseline when server sync is unavailable.
      });
  }, [accountPreferencesLoading]);

  const personaModalOpen =
    !personaDismissed &&
    !!accountData &&
    !accountData.persona &&
    !!stats &&
    stats.totalProjects > 0 &&
    shouldShowPersonaModal();

  const { widgetOrder, isPersonalized } = usePersonaLayout(
    accountData?.persona,
  );
  const quickToolOrder = resolveDashboardQuickToolOrder({
    persona: accountData?.persona,
    isAdmin: accountData?.isAdmin ?? false,
  });

  useEffect(() => {
    if (!stats || !accountData) return;
    track("dashboard_loaded", {
      persona: accountData.persona,
      isPersonalized,
      widgetOrder: widgetOrder.join(","),
    });
  }, [accountData, isPersonalized, stats, widgetOrder]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AI_FEATURES_BANNER_DISMISSED_KEY, "1");
    }
  }, []);

  const closePersonaModal = useCallback(() => {
    setPersonaDismissed(true);
  }, []);

  const handleWidgetClick = useCallback(
    (widgetId: DashboardWidgetId) => {
      track("dashboard_widget_clicked", {
        widgetId,
        persona: accountData?.persona,
        isPersonalized,
      });
    },
    [accountData?.persona, isPersonalized],
  );

  const loading = statsLoading;
  const activityStillLoading = activityLoading;
  const normalizedActivity = useMemo(() => activity ?? [], [activity]);
  const sinceLastVisit = useMemo(
    () => buildSinceLastVisitSummary(normalizedActivity, effectiveLastVisitAt),
    [effectiveLastVisitAt, normalizedActivity],
  );

  return {
    activity: normalizedActivity,
    bannerDismissed,
    closePersonaModal,
    dismissBanner,
    effectiveLastVisitAt,
    firstName,
    handleWidgetClick,
    isPersonalized,
    lastProjectContext,
    activityStillLoading,
    loading,
    personaModalOpen,
    quickToolOrder: quickToolOrder as DashboardQuickToolId[],
    sinceLastVisit,
    stats,
    widgetOrder,
  };
}
