import { useCallback, useEffect, useState } from "react";
import type {
  AdminCustomer,
  AdminIngestDetails,
  AdminStats,
  BlockedDomain,
  Promo,
} from "@/lib/api";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import { normalizeDomain } from "@llm-boost/shared";
import {
  buildAdminIngestCards,
  buildAdminStatCards,
  type AdminMetrics,
  type CancelJobDialogState,
  type CustomerActionDialogState,
  DEFAULT_CANCEL_REASON,
  DEFAULT_NEW_PROMO,
  type DetailKey,
  type NewPromoFormState,
  type TrendPoint,
} from "../admin-page-helpers";

type AdminCustomersResponse = {
  data: AdminCustomer[];
  pagination?: {
    page?: number;
    totalPages?: number;
    total?: number;
  };
};

export function useAdminPageState() {
  const { withAuth } = useApi();

  const [search, setSearch] = useState("");
  const [detailType, setDetailType] = useState<DetailKey | null>(null);
  const [cancelDialog, setCancelDialog] = useState<CancelJobDialogState | null>(
    null,
  );
  const [cancelReason, setCancelReason] = useState(DEFAULT_CANCEL_REASON);
  const [pendingHistory, setPendingHistory] = useState<TrendPoint[]>([]);
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [customerActionDialog, setCustomerActionDialog] =
    useState<CustomerActionDialogState | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [customerActionLoading, setCustomerActionLoading] = useState(false);
  const [showCreatePromo, setShowCreatePromo] = useState(false);
  const [newPromo, setNewPromo] = useState<NewPromoFormState>({
    ...DEFAULT_NEW_PROMO,
  });
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [blockedDomains, setBlockedDomains] = useState<BlockedDomain[]>([]);
  const [newBlockDomain, setNewBlockDomain] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [httpFallbackEnabled, setHttpFallbackEnabled] = useState(false);

  const { data: stats, error: statsError } = useApiSWR<AdminStats>(
    "admin-stats",
    useCallback(() => api.admin.getStats(), []),
    { refreshInterval: 10_000 },
  );

  const { data: metrics } = useApiSWR<AdminMetrics>(
    "admin-metrics",
    useCallback(() => api.admin.getMetrics(), []),
    { refreshInterval: 5_000 },
  );

  const { data: ingestDetails, mutate: refreshIngestDetails } =
    useApiSWR<AdminIngestDetails>(
      "admin-ingest-details",
      useCallback(() => api.admin.getIngestDetails(), []),
      { refreshInterval: 10_000 },
    );

  const { data: promos, mutate: refreshPromos } = useApiSWR<Promo[]>(
    "admin-promos",
    useCallback(() => api.admin.listPromos(), []),
  );

  const { data: customersData, isLoading: customersLoading } =
    useApiSWR<AdminCustomersResponse>(
      search ? `admin-customers-${search}` : "admin-customers",
      useCallback(
        () => api.admin.getCustomers({ search: search || undefined }),
        [search],
      ),
      { dedupingInterval: 500 },
    );

  const pendingJobs = stats?.ingestHealth.pendingJobs;

  useEffect(() => {
    if (pendingJobs === undefined) {
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      setPendingHistory((prev) =>
        [...prev, { timestamp: Date.now(), value: pendingJobs }].slice(-12),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [pendingJobs]);

  useEffect(() => {
    let cancelled = false;

    api.admin
      .getBlockedDomains()
      .then((domains) => {
        if (!cancelled) {
          setBlockedDomains(domains);
        }
      })
      .catch(() => {});

    api.admin
      .getSettings()
      .then((settings) => {
        if (!cancelled) {
          setHttpFallbackEnabled(settings.http_fallback_enabled);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const resetCustomerActionDialog = useCallback(() => {
    setCustomerActionDialog(null);
    setActionReason("");
  }, []);

  const openCancelDialog = useCallback(
    (jobId: string, projectName?: string | null) => {
      setCancelDialog({ jobId, projectName });
      setCancelReason(DEFAULT_CANCEL_REASON);
    },
    [],
  );

  const closeCancelDialog = useCallback(() => {
    setCancelDialog(null);
  }, []);

  const openCustomerActionDialog = useCallback(
    (dialog: CustomerActionDialogState, plan?: string) => {
      if (dialog.action === "change-plan" && plan) {
        setSelectedPlan(plan);
      }
      setCustomerActionDialog(dialog);
    },
    [],
  );

  const handleCustomerActionDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetCustomerActionDialog();
      }
    },
    [resetCustomerActionDialog],
  );

  const updateNewPromo = useCallback((patch: Partial<NewPromoFormState>) => {
    setNewPromo((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleRetryJob = useCallback(
    async (jobId: string) => {
      setActionTarget(`job-retry-${jobId}`);
      try {
        await withAuth(() => api.admin.retryCrawlJob(jobId));
        await refreshIngestDetails();
      } catch (error) {
        console.error(error);
      } finally {
        setActionTarget(null);
      }
    },
    [refreshIngestDetails, withAuth],
  );

  const handleCancelJob = useCallback(
    async (jobId: string, reason?: string) => {
      setActionTarget(`job-cancel-${jobId}`);
      try {
        await withAuth(() => api.admin.cancelCrawlJob(jobId, reason));
        await refreshIngestDetails();
      } catch (error) {
        console.error(error);
      } finally {
        setActionTarget(null);
      }
    },
    [refreshIngestDetails, withAuth],
  );

  const handleConfirmCancelJob = useCallback(async () => {
    if (!cancelDialog) {
      return;
    }

    const trimmed = cancelReason.trim() || DEFAULT_CANCEL_REASON;
    await handleCancelJob(cancelDialog.jobId, trimmed);
    setCancelDialog(null);
  }, [cancelDialog, cancelReason, handleCancelJob]);

  const handleReplayEvent = useCallback(
    async (eventId: string) => {
      setActionTarget(`outbox-${eventId}`);
      try {
        await withAuth(() => api.admin.replayOutboxEvent(eventId));
        await refreshIngestDetails();
      } catch (error) {
        console.error(error);
      } finally {
        setActionTarget(null);
      }
    },
    [refreshIngestDetails, withAuth],
  );

  const handleCustomerAction = useCallback(async () => {
    if (!customerActionDialog) {
      return;
    }

    setCustomerActionLoading(true);
    try {
      const { userId, action } = customerActionDialog;
      await withAuth(async () => {
        switch (action) {
          case "block":
            await api.admin.blockUser(userId, actionReason || undefined);
            break;
          case "suspend":
            await api.admin.suspendUser(userId, actionReason || undefined);
            break;
          case "unblock":
            await api.admin.unblockUser(userId);
            break;
          case "change-plan":
            await api.admin.changeUserPlan(userId, selectedPlan);
            break;
          case "cancel-sub":
            await api.admin.cancelUserSubscription(userId);
            break;
        }
      });
      resetCustomerActionDialog();
    } catch (error) {
      console.error(error);
    } finally {
      setCustomerActionLoading(false);
    }
  }, [
    actionReason,
    customerActionDialog,
    resetCustomerActionDialog,
    selectedPlan,
    withAuth,
  ]);

  const handleCreatePromo = useCallback(async () => {
    setCreatingPromo(true);
    try {
      await withAuth(async () => {
        await api.admin.createPromo({
          code: newPromo.code,
          discountType: newPromo.discountType,
          discountValue: newPromo.discountValue,
          duration: newPromo.duration,
          durationMonths: newPromo.durationMonths,
          maxRedemptions: newPromo.maxRedemptions,
          expiresAt: newPromo.expiresAt || undefined,
        });
      });
      setShowCreatePromo(false);
      setNewPromo({ ...DEFAULT_NEW_PROMO });
      await refreshPromos();
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingPromo(false);
    }
  }, [newPromo, refreshPromos, withAuth]);

  const handleDeactivatePromo = useCallback(
    async (promoId: string) => {
      setActionTarget(`promo-${promoId}`);
      try {
        await withAuth(() => api.admin.deactivatePromo(promoId));
        await refreshPromos();
      } catch (error) {
        console.error(error);
      } finally {
        setActionTarget(null);
      }
    },
    [refreshPromos, withAuth],
  );

  const handleAddBlocked = useCallback(async () => {
    const domain = normalizeDomain(newBlockDomain);
    if (!domain) {
      return;
    }

    try {
      const result = await api.admin.addBlockedDomain(
        domain,
        newBlockReason || undefined,
      );
      setBlockedDomains((prev) => [...prev, result]);
      setNewBlockDomain("");
      setNewBlockReason("");
    } catch (error) {
      console.error("Failed to add blocked domain:", error);
    }
  }, [newBlockDomain, newBlockReason]);

  const handleRemoveBlocked = useCallback(async (id: string) => {
    try {
      await api.admin.removeBlockedDomain(id);
      setBlockedDomains((prev) => prev.filter((domain) => domain.id !== id));
    } catch (error) {
      console.error("Failed to remove blocked domain:", error);
    }
  }, []);

  const handleToggleHttpFallback = useCallback(async () => {
    const nextValue = !httpFallbackEnabled;
    try {
      await api.admin.updateSetting("http_fallback_enabled", nextValue);
      setHttpFallbackEnabled(nextValue);
    } catch (error) {
      console.error("Failed to update HTTP fallback setting:", error);
    }
  }, [httpFallbackEnabled]);

  const customers = customersData?.data ?? [];
  const statCards = buildAdminStatCards(stats);
  const ingestCards = buildAdminIngestCards(stats, pendingHistory);

  return {
    accessDenied: statsError?.status === 403,
    stats,
    metrics,
    ingestDetails,
    promos: promos ?? [],
    customers,
    customersLoading,
    search,
    detailType,
    cancelDialog,
    cancelReason,
    actionTarget,
    customerActionDialog,
    actionReason,
    selectedPlan,
    customerActionLoading,
    showCreatePromo,
    newPromo,
    creatingPromo,
    blockedDomains,
    newBlockDomain,
    newBlockReason,
    httpFallbackEnabled,
    statCards,
    ingestCards,
    setSearch,
    setDetailType,
    setCancelReason,
    setActionReason,
    setSelectedPlan,
    setShowCreatePromo,
    setNewBlockDomain,
    setNewBlockReason,
    updateNewPromo,
    openCancelDialog,
    closeCancelDialog,
    openCustomerActionDialog,
    handleCustomerActionDialogOpenChange,
    handleRetryJob,
    handleConfirmCancelJob,
    handleReplayEvent,
    handleCustomerAction,
    handleCreatePromo,
    handleDeactivatePromo,
    handleAddBlocked,
    handleRemoveBlocked,
    handleToggleHttpFallback,
  };
}
