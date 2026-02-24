"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DollarSign,
  TrendingUp,
  Users,
  Percent,
  Activity,
  Timer,
  AlertTriangle,
  Inbox,
  ShieldCheck,
  Ban,
  UserCheck,
  Tag,
  Plus,
  Trash2,
} from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  type AdminStats,
  type AdminCustomer,
  type AdminIngestDetails,
  type CrawlJobSummary,
  type OutboxEventSummary,
  type Promo,
  type BlockedDomain,
} from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { normalizeDomain } from "@llm-boost/shared";

interface TrendPoint {
  timestamp: number;
  value: number;
}

type DetailKey = "pending" | "running" | "failed" | "outbox";

interface IngestCardMeta {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  tone: "default" | "warning" | "destructive";
  trend?: TrendPoint[];
  detailKey?: DetailKey;
}

export default function AdminPage() {
  const [search, setSearch] = useState("");
  const [detailType, setDetailType] = useState<DetailKey | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{
    jobId: string;
    projectName?: string | null;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState("Cancelled by admin");
  const { withAuth } = useApi();

  const { data: stats, error: statsError } = useApiSWR<AdminStats>(
    "admin-stats",
    useCallback(() => api.admin.getStats(), []),
    { refreshInterval: 10_000 },
  );

  const { data: metrics } = useApiSWR(
    "admin-metrics",
    useCallback(() => api.admin.getMetrics(), []),
    { refreshInterval: 5_000 },
  );

  const [pendingHistory, setPendingHistory] = useState<
    { timestamp: number; value: number }[]
  >([]);

  const pendingJobs = stats?.ingestHealth.pendingJobs;

  useEffect(() => {
    if (pendingJobs === undefined) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setPendingHistory((prev) =>
        [...prev, { timestamp: Date.now(), value: pendingJobs }].slice(-12),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [pendingJobs]);

  const { data: ingestDetails, mutate: refreshIngestDetails } =
    useApiSWR<AdminIngestDetails>(
      "admin-ingest-details",
      useCallback(() => api.admin.getIngestDetails(), []),
      { refreshInterval: 10_000 },
    );

  const [actionTarget, setActionTarget] = useState<string | null>(null);

  // Customer management state
  const [customerActionDialog, setCustomerActionDialog] = useState<{
    userId: string;
    name: string;
    action: "block" | "suspend" | "unblock" | "change-plan" | "cancel-sub";
  } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [customerActionLoading, setCustomerActionLoading] = useState(false);

  // Promo state
  const { data: promos, mutate: refreshPromos } = useApiSWR<Promo[]>(
    "admin-promos",
    useCallback(() => api.admin.listPromos(), []),
  );
  const [showCreatePromo, setShowCreatePromo] = useState(false);
  const [newPromo, setNewPromo] = useState({
    code: "",
    discountType: "percent_off" as "percent_off" | "amount_off" | "free_months",
    discountValue: 0,
    duration: "once" as "once" | "repeating" | "forever",
    durationMonths: undefined as number | undefined,
    maxRedemptions: undefined as number | undefined,
    expiresAt: "",
  });
  const [creatingPromo, setCreatingPromo] = useState(false);

  // Blocked domains state
  const [blockedDomains, setBlockedDomains] = useState<BlockedDomain[]>([]);
  const [newBlockDomain, setNewBlockDomain] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [httpFallbackEnabled, setHttpFallbackEnabled] = useState(false);

  useEffect(() => {
    api.admin
      .getBlockedDomains()
      .then((domains) => setBlockedDomains(domains))
      .catch(() => {});
    api.admin
      .getSettings()
      .then((settings) =>
        setHttpFallbackEnabled(settings.http_fallback_enabled),
      )
      .catch(() => {});
  }, []);

  const handleAddBlocked = async () => {
    const domain = normalizeDomain(newBlockDomain);
    if (!domain) return;
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
  };

  const handleRemoveBlocked = async (id: string) => {
    try {
      await api.admin.removeBlockedDomain(id);
      setBlockedDomains((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      console.error("Failed to remove blocked domain:", error);
    }
  };

  const handleToggleHttpFallback = async () => {
    const newValue = !httpFallbackEnabled;
    try {
      await api.admin.updateSetting("http_fallback_enabled", newValue);
      setHttpFallbackEnabled(newValue);
    } catch (error) {
      console.error("Failed to update HTTP fallback setting:", error);
    }
  };

  async function handleRetryJob(jobId: string) {
    setActionTarget(`job-retry-${jobId}`);
    try {
      await withAuth(() => api.admin.retryCrawlJob(jobId));
      await refreshIngestDetails();
    } catch (error) {
      console.error(error);
    } finally {
      setActionTarget(null);
    }
  }

  async function handleCancelJob(jobId: string, reason?: string) {
    setActionTarget(`job-cancel-${jobId}`);
    try {
      await withAuth(() => api.admin.cancelCrawlJob(jobId, reason));
      await refreshIngestDetails();
    } catch (error) {
      console.error(error);
    } finally {
      setActionTarget(null);
    }
  }

  function openCancelDialog(job: CrawlJobSummary) {
    setCancelDialog({ jobId: job.id, projectName: job.projectName });
    setCancelReason("Cancelled by admin");
  }

  async function handleReplayEvent(eventId: string) {
    setActionTarget(`outbox-${eventId}`);
    try {
      await withAuth(() => api.admin.replayOutboxEvent(eventId));
      await refreshIngestDetails();
    } catch (error) {
      console.error(error);
    } finally {
      setActionTarget(null);
    }
  }

  async function handleCustomerAction() {
    if (!customerActionDialog) return;
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
      setCustomerActionDialog(null);
      setActionReason("");
    } catch (err) {
      console.error(err);
    } finally {
      setCustomerActionLoading(false);
    }
  }

  async function handleCreatePromo() {
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
      setNewPromo({
        code: "",
        discountType: "percent_off",
        discountValue: 0,
        duration: "once",
        durationMonths: undefined,
        maxRedemptions: undefined,
        expiresAt: "",
      });
      await refreshPromos();
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingPromo(false);
    }
  }

  async function handleDeactivatePromo(promoId: string) {
    setActionTarget(`promo-${promoId}`);
    try {
      await withAuth(() => api.admin.deactivatePromo(promoId));
      await refreshPromos();
    } catch (err) {
      console.error(err);
    } finally {
      setActionTarget(null);
    }
  }

  const { data: customersData, isLoading: customersLoading } = useApiSWR(
    search ? `admin-customers-${search}` : "admin-customers",
    useCallback(
      () => api.admin.getCustomers({ search: search || undefined }),
      [search],
    ),
    { dedupingInterval: 500 },
  );

  const customers = customersData?.data ?? [];

  const statCards = [
    {
      title: "Monthly Recurring Revenue",
      value: stats
        ? `$${stats.mrr.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
        : "—",
      icon: DollarSign,
    },
    {
      title: "Total Revenue",
      value: stats
        ? `$${stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
        : "—",
      icon: TrendingUp,
    },
    {
      title: "Active Subscribers",
      value: stats?.activeSubscribers?.toString() ?? "—",
      icon: Users,
    },
    {
      title: "Churn Rate",
      value: stats ? `${stats.churnRate}%` : "—",
      icon: Percent,
    },
  ];

  const ingestCards: IngestCardMeta[] = stats
    ? [
        {
          title: "Pending Crawl Jobs",
          value: stats.ingestHealth.pendingJobs.toString(),
          icon: Activity,
          description: "Waiting to be dispatched",
          tone: stats.ingestHealth.pendingJobs > 50 ? "warning" : "default",
          trend: pendingHistory,
          detailKey: "pending",
        },
        {
          title: "Running Jobs",
          value: stats.ingestHealth.runningJobs.toString(),
          icon: Users,
          description: "Crawling or scoring now",
          tone: "default",
          detailKey: "running",
        },
        {
          title: "Avg Completion (24h)",
          value: `${stats.ingestHealth.avgCompletionMinutes.toFixed(1)}m`,
          icon: Timer,
          description: "From crawl start to complete",
          tone:
            stats.ingestHealth.avgCompletionMinutes > 30
              ? "warning"
              : "default",
        },
        {
          title: "Failed (24h)",
          value: stats.ingestHealth.failedLast24h.toString(),
          icon: AlertTriangle,
          description: "Jobs marked failed in last day",
          tone:
            stats.ingestHealth.failedLast24h > 0 ? "destructive" : "default",
          detailKey: "failed",
        },
        {
          title: "Outbox Queue",
          value: stats.ingestHealth.outboxPending.toString(),
          icon: Inbox,
          description: "Background tasks waiting to run",
          tone: stats.ingestHealth.outboxPending > 25 ? "warning" : "default",
          detailKey: "outbox",
        },
      ]
    : [];

  const planColors: Record<
    string,
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning"
    | "info"
  > = {
    free: "secondary",
    starter: "default",
    pro: "default",
    agency: "default",
  };

  if (statsError?.status === 403) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Admin access required
          </h1>
          <p className="mt-2 text-muted-foreground">
            You do not have permission to view this page. Contact an
            administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Business metrics and customer management.
        </p>
      </div>

      {/* Revenue + Subscriber Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Health Monitoring */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase text-primary">
                System Real-time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold">{metrics.activeCrawls}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">
                    Active Crawl Nodes
                  </p>
                </div>
                <div className="mb-2 h-2 w-2 animate-pulse rounded-full bg-success" />
              </div>
            </CardContent>
          </Card>
          <Card
            className={
              metrics.errorsLast24h > 0
                ? "border-destructive/20 bg-destructive/5"
                : ""
            }
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase">
                24h Failures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-bold ${
                  metrics.errorsLast24h > 0 ? "text-destructive" : ""
                }`}
              >
                {metrics.errorsLast24h}
              </p>
              <p className="text-[10px] uppercase text-muted-foreground">
                Critical System Errors
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase">
                Last Heartbeat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mt-2 font-mono text-sm">
                {new Date(metrics.systemTime).toLocaleTimeString()}
              </p>
              <p className="mt-1 text-[10px] uppercase text-muted-foreground">
                UTC Synchronization
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ingest / Pipeline Health */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crawl Pipeline Health</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track crawl throughput, failure rates, and background jobs over
              the last 24 hours.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ingestCards.map((card) => (
              <div
                key={card.title}
                className={`rounded-lg border p-4 ${
                  card.detailKey
                    ? "cursor-pointer transition hover:border-primary/40"
                    : ""
                }`}
                data-tone={card.tone}
                role={card.detailKey ? "button" : undefined}
                tabIndex={card.detailKey ? 0 : undefined}
                aria-label={
                  card.detailKey ? `View ${card.title} details` : undefined
                }
                onClick={
                  card.detailKey
                    ? () => setDetailType(card.detailKey ?? null)
                    : undefined
                }
                onKeyDown={
                  card.detailKey
                    ? (event: KeyboardEvent<HTMLDivElement>) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDetailType(card.detailKey ?? null);
                        }
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{card.title}</span>
                  <card.icon className="h-4 w-4" />
                </div>
                <p
                  className={`mt-2 text-2xl font-semibold ${
                    card.tone === "destructive"
                      ? "text-destructive"
                      : card.tone === "warning"
                        ? "text-warning"
                        : ""
                  }`}
                >
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
                {card.trend && <PendingSparkline data={card.trend} />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Customers</CardTitle>
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {customersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="space-y-1">
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-56 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No customers found.
            </p>
          ) : (
            <div className="divide-y">
              {customers.map((customer: AdminCustomer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {customer.name ?? "—"}
                      </p>
                      {(customer as AdminCustomer & { status?: string })
                        .status &&
                        (customer as AdminCustomer & { status?: string })
                          .status !== "active" && (
                          <Badge variant="destructive" className="text-[10px]">
                            {
                              (customer as AdminCustomer & { status?: string })
                                .status
                            }
                          </Badge>
                        )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {customer.email}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Badge variant={planColors[customer.plan] ?? "default"}>
                      {customer.plan}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      title="Change plan"
                      onClick={() => {
                        setSelectedPlan(customer.plan);
                        setCustomerActionDialog({
                          userId: customer.id,
                          name: customer.name ?? customer.email,
                          action: "change-plan",
                        });
                      }}
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                    </Button>
                    {(customer as AdminCustomer & { status?: string })
                      .status !== "banned" &&
                    (customer as AdminCustomer & { status?: string }).status !==
                      "suspended" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        title="Block user"
                        onClick={() =>
                          setCustomerActionDialog({
                            userId: customer.id,
                            name: customer.name ?? customer.email,
                            action: "block",
                          })
                        }
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-success hover:text-success"
                        title="Unblock user"
                        onClick={() =>
                          setCustomerActionDialog({
                            userId: customer.id,
                            name: customer.name ?? customer.email,
                            action: "unblock",
                          })
                        }
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <IngestDetailDialog
        type={detailType}
        onClose={() => setDetailType(null)}
        details={ingestDetails}
        actionTarget={actionTarget}
        onRetryJob={handleRetryJob}
        onCancelJob={openCancelDialog}
        onReplayEvent={handleReplayEvent}
      />
      <CancelJobDialog
        job={cancelDialog}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onClose={() => setCancelDialog(null)}
        onConfirm={() => {
          if (!cancelDialog) return;
          const trimmed = cancelReason.trim() || "Cancelled by admin";
          void handleCancelJob(cancelDialog.jobId, trimmed).then(() =>
            setCancelDialog(null),
          );
        }}
        loading={
          !!cancelDialog && actionTarget === `job-cancel-${cancelDialog.jobId}`
        }
      />

      {/* Promo Codes Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Promo Codes</CardTitle>
            </div>
            <Button size="sm" onClick={() => setShowCreatePromo(true)}>
              <Plus className="h-3.5 w-3.5" />
              Create Promo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!promos || promos.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No promo codes yet.
            </p>
          ) : (
            <div className="divide-y">
              {promos.map((promo) => (
                <div
                  key={promo.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {promo.code}
                      </span>
                      <Badge
                        variant={promo.active ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {promo.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {promo.discountType === "percent_off"
                        ? `${promo.discountValue}% off`
                        : promo.discountType === "free_months"
                          ? `${promo.discountValue} free months`
                          : `$${(promo.discountValue / 100).toFixed(2)} off`}{" "}
                      · {promo.duration}
                      {promo.durationMonths
                        ? ` (${promo.durationMonths}mo)`
                        : ""}{" "}
                      · {promo.timesRedeemed}
                      {promo.maxRedemptions
                        ? `/${promo.maxRedemptions}`
                        : ""}{" "}
                      used
                    </p>
                  </div>
                  {promo.active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      disabled={actionTarget === `promo-${promo.id}`}
                      onClick={() => handleDeactivatePromo(promo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={httpFallbackEnabled}
              onChange={handleToggleHttpFallback}
              className="h-4 w-4 rounded border-gray-300"
            />
            <div>
              <span className="font-medium">Allow HTTP Fallback</span>
              <p className="text-xs text-muted-foreground">
                When enabled, paid plan users can opt in to HTTP fallback if
                HTTPS connection fails during crawling.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Blocked Domains */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blocked Domains</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="domain.com"
              value={newBlockDomain}
              onChange={(e) => setNewBlockDomain(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Reason (optional)"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAddBlocked} size="sm">
              <Plus className="mr-1 h-3 w-3" /> Block
            </Button>
          </div>
          {blockedDomains.length === 0 ? (
            <p className="text-sm text-muted-foreground">No domains blocked.</p>
          ) : (
            <div className="space-y-2">
              {blockedDomains.map((bd) => (
                <div
                  key={bd.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{bd.domain}</span>
                    {bd.reason && (
                      <span className="ml-2 text-muted-foreground">
                        - {bd.reason}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveBlocked(bd.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Promo Dialog */}
      <Dialog open={showCreatePromo} onOpenChange={setShowCreatePromo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Promo Code</DialogTitle>
            <DialogDescription>
              Creates a coupon and promotion code in Stripe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Code</label>
              <Input
                value={newPromo.code}
                onChange={(e) =>
                  setNewPromo({ ...newPromo, code: e.target.value })
                }
                placeholder="WELCOME20"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Discount Type</label>
                <Select
                  value={newPromo.discountType}
                  onValueChange={(v) =>
                    setNewPromo({
                      ...newPromo,
                      discountType: v as typeof newPromo.discountType,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent_off">Percent Off</SelectItem>
                    <SelectItem value="amount_off">
                      Amount Off (cents)
                    </SelectItem>
                    <SelectItem value="free_months">Free Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Value</label>
                <Input
                  type="number"
                  value={newPromo.discountValue || ""}
                  onChange={(e) =>
                    setNewPromo({
                      ...newPromo,
                      discountValue: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder={
                    newPromo.discountType === "percent_off"
                      ? "20"
                      : newPromo.discountType === "free_months"
                        ? "3"
                        : "1000"
                  }
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Duration</label>
                <Select
                  value={newPromo.duration}
                  onValueChange={(v) =>
                    setNewPromo({
                      ...newPromo,
                      duration: v as typeof newPromo.duration,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="repeating">Repeating</SelectItem>
                    <SelectItem value="forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newPromo.duration === "repeating" && (
                <div>
                  <label className="text-sm font-medium">
                    Duration (months)
                  </label>
                  <Input
                    type="number"
                    value={newPromo.durationMonths ?? ""}
                    onChange={(e) =>
                      setNewPromo({
                        ...newPromo,
                        durationMonths: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="3"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">
                  Max Redemptions (optional)
                </label>
                <Input
                  type="number"
                  value={newPromo.maxRedemptions ?? ""}
                  onChange={(e) =>
                    setNewPromo({
                      ...newPromo,
                      maxRedemptions: parseInt(e.target.value) || undefined,
                    })
                  }
                  placeholder="100"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Expires At (optional)
                </label>
                <Input
                  type="date"
                  value={newPromo.expiresAt}
                  onChange={(e) =>
                    setNewPromo({ ...newPromo, expiresAt: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePromo(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePromo}
              disabled={creatingPromo || !newPromo.code.trim()}
            >
              {creatingPromo ? "Creating..." : "Create Promo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Action Dialog */}
      <Dialog
        open={!!customerActionDialog}
        onOpenChange={(open) => {
          if (!open) {
            setCustomerActionDialog(null);
            setActionReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {customerActionDialog?.action === "block"
                ? "Block User"
                : customerActionDialog?.action === "suspend"
                  ? "Suspend User"
                  : customerActionDialog?.action === "unblock"
                    ? "Unblock User"
                    : customerActionDialog?.action === "change-plan"
                      ? "Change Plan"
                      : "Cancel Subscription"}
            </DialogTitle>
            <DialogDescription>{customerActionDialog?.name}</DialogDescription>
          </DialogHeader>
          {(customerActionDialog?.action === "block" ||
            customerActionDialog?.action === "suspend") && (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="action-reason">
                Reason (optional)
              </label>
              <textarea
                id="action-reason"
                className="min-h-[80px] w-full rounded-md border border-input bg-background p-2 text-sm"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Reason for this action..."
              />
            </div>
          )}
          {customerActionDialog?.action === "change-plan" && (
            <div>
              <label className="text-sm font-medium">New Plan</label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCustomerActionDialog(null);
                setActionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant={
                customerActionDialog?.action === "unblock"
                  ? "default"
                  : "destructive"
              }
              onClick={handleCustomerAction}
              disabled={customerActionLoading}
            >
              {customerActionLoading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PendingSparkline({ data }: { data: TrendPoint[] }) {
  const width = 120;
  const height = 32;

  const points = useMemo(() => {
    if (data.length < 2) return "";
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const denom = Math.max(data.length - 1, 1);
    return data
      .map((point, idx) => {
        const x = (idx / denom) * width;
        const y = height - ((point.value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");
  }, [data]);

  if (data.length < 2 || !points) {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground">
        Gathering samples…
      </p>
    );
  }

  return (
    <svg
      className="mt-3 h-8 w-full text-primary/80"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Pending crawl jobs trend"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IngestDetailDialog({
  type,
  onClose,
  details,
  actionTarget,
  onRetryJob,
  onCancelJob,
  onReplayEvent,
}: {
  type: DetailKey | null;
  onClose: () => void;
  details?: AdminIngestDetails;
  actionTarget: string | null;
  onRetryJob: (jobId: string) => Promise<void>;
  onCancelJob: (job: CrawlJobSummary) => void;
  onReplayEvent: (eventId: string) => Promise<void>;
}) {
  const mapping = useMemo(
    () => ({
      pending: {
        title: "Pending Crawl Jobs",
        rows: details?.pendingJobs ?? [],
        empty: "No pending jobs in queue.",
      },
      running: {
        title: "Running Jobs",
        rows: details?.runningJobs ?? [],
        empty: "No active crawl jobs right now.",
      },
      failed: {
        title: "Failed Jobs",
        rows: details?.failedJobs ?? [],
        empty: "No crawl failures detected.",
      },
      outbox: {
        title: "Pending Outbox Events",
        rows: details?.outboxEvents ?? [],
        empty: "Outbox queue is clear.",
      },
    }),
    [details],
  );

  if (!type) return null;

  const data = mapping[type];

  return (
    <Dialog open={!!type} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{data.title}</DialogTitle>
          <DialogDescription>
            Live snapshot pulled from the ingestion pipeline.
          </DialogDescription>
        </DialogHeader>
        {!details ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading details…
          </p>
        ) : data.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {data.empty}
          </p>
        ) : type === "outbox" ? (
          <OutboxList
            rows={data.rows as OutboxEventSummary[]}
            actionTarget={actionTarget}
            onReplay={onReplayEvent}
          />
        ) : (
          <JobList
            rows={data.rows as CrawlJobSummary[]}
            actionTarget={actionTarget}
            onRetry={onRetryJob}
            onCancel={onCancelJob}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function JobList({
  rows,
  actionTarget,
  onRetry,
  onCancel,
}: {
  rows: CrawlJobSummary[];
  actionTarget: string | null;
  onRetry: (jobId: string) => Promise<void>;
  onCancel: (job: CrawlJobSummary) => void;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{row.projectName ?? row.projectId}</p>
              <p className="text-xs text-muted-foreground">Job {row.id}</p>
            </div>
            <Badge variant="outline">{row.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Created {new Date(row.createdAt).toLocaleString()}
          </p>
          {row.startedAt && (
            <p className="text-xs text-muted-foreground">
              Started {new Date(row.startedAt).toLocaleString()}
            </p>
          )}
          {row.errorMessage && (
            <p className="mt-2 text-xs text-destructive">{row.errorMessage}</p>
          )}
          {row.cancelReason && (
            <p className="mt-1 text-xs text-muted-foreground">
              Cancelled
              {row.cancelledAt
                ? ` ${new Date(row.cancelledAt).toLocaleString()}`
                : ""}
              {row.cancelledBy ? ` by ${row.cancelledBy}` : ""}:{" "}
              {row.cancelReason}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              <a href={`/dashboard/projects/${row.projectId}`}>Project</a>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              <a href={`/dashboard/crawl/${row.id}`}>View crawl</a>
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={actionTarget === `job-retry-${row.id}`}
              onClick={() => onRetry(row.id)}
            >
              {actionTarget === `job-retry-${row.id}` ? "Retrying..." : "Retry"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={actionTarget === `job-cancel-${row.id}`}
              onClick={() => onCancel(row)}
            >
              {actionTarget === `job-cancel-${row.id}`
                ? "Cancelling..."
                : "Cancel"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function OutboxList({
  rows,
  actionTarget,
  onReplay,
}: {
  rows: OutboxEventSummary[];
  actionTarget: string | null;
  onReplay: (eventId: string) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium">{row.type}</p>
            <Badge variant="outline">Attempts: {row.attempts}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Available {new Date(row.availableAt).toLocaleString()}
          </p>
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={actionTarget === `outbox-${row.id}`}
              onClick={() => onReplay(row.id)}
            >
              {actionTarget === `outbox-${row.id}` ? "Replaying..." : "Replay"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CancelJobDialog({
  job,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
  loading,
}: {
  job: { jobId: string; projectName?: string | null } | null;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={!!job} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel crawl job?</DialogTitle>
          <DialogDescription>
            Job {job?.jobId}
            {job?.projectName ? ` — ${job.projectName}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="cancel-reason">
            Reason
          </label>
          <textarea
            id="cancel-reason"
            className="min-h-[80px] w-full rounded-md border border-input bg-background p-2 text-sm"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Keep job
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading || !job}
          >
            {loading ? "Cancelling..." : "Confirm cancel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
