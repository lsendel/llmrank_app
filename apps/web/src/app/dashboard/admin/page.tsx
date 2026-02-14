"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
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
} from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type AdminStats,
  type AdminCustomer,
  type AdminIngestDetails,
  type CrawlJobSummary,
  type OutboxEventSummary,
} from "@/lib/api";
import { useApi } from "@/lib/use-api";

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
  const { withToken } = useApi();

  const { data: stats } = useApiSWR<AdminStats>(
    "admin-stats",
    useCallback((token: string) => api.admin.getStats(token), []),
    { refreshInterval: 10_000 },
  );

  const { data: metrics } = useApiSWR(
    "admin-metrics",
    useCallback((token: string) => api.admin.getMetrics(token), []),
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
      useCallback((token: string) => api.admin.getIngestDetails(token), []),
      { refreshInterval: 10_000 },
    );

  const [actionTarget, setActionTarget] = useState<string | null>(null);

  async function handleRetryJob(jobId: string) {
    setActionTarget(`job-retry-${jobId}`);
    try {
      await withToken((token) => api.admin.retryCrawlJob(token, jobId));
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
      await withToken((token) =>
        api.admin.cancelCrawlJob(token, jobId, reason),
      );
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
      await withToken((token) => api.admin.replayOutboxEvent(token, eventId));
      await refreshIngestDetails();
    } catch (error) {
      console.error(error);
    } finally {
      setActionTarget(null);
    }
  }

  const { data: customersData, isLoading: customersLoading } = useApiSWR(
    search ? `admin-customers-${search}` : "admin-customers",
    useCallback(
      (token: string) =>
        api.admin.getCustomers(token, { search: search || undefined }),
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
        },
        {
          title: "Running Jobs",
          value: stats.ingestHealth.runningJobs.toString(),
          icon: Users,
          description: "Crawling or scoring now",
          tone: "default",
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
        },
        {
          title: "Outbox Queue",
          value: stats.ingestHealth.outboxPending.toString(),
          icon: Inbox,
          description: "Background tasks waiting to run",
          tone: stats.ingestHealth.outboxPending > 25 ? "warning" : "default",
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
              metrics.errorsLast24h > 0 ? "border-destructive/20 bg-destructive/5" : ""
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
                className="rounded-lg border p-4"
                data-tone={card.tone}
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
                {card.detailKey && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 px-0 text-xs text-primary"
                    onClick={() => setDetailType(card.detailKey ?? null)}
                    disabled={!ingestDetails}
                  >
                    View details
                  </Button>
                )}
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
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {customer.name ?? "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {customer.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={planColors[customer.plan] ?? "default"}>
                      {customer.plan}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </span>
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
