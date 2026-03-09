import { useMemo, type KeyboardEvent } from "react";
import {
  Ban,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import type {
  AdminCustomer,
  AdminIngestDetails,
  CrawlJobSummary,
  OutboxEventSummary,
  Promo,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAdminCustomerStatus,
  getCustomerActionDialogTitle,
  getCustomerPlanBadgeVariant,
  getPromoSummary,
  isRestrictedCustomerStatus,
  type AdminMetricCard,
  type AdminMetrics,
  type CancelJobDialogState,
  type CustomerActionDialogState,
  type DetailKey,
  type IngestCardMeta,
  type NewPromoFormState,
  type TrendPoint,
} from "../admin-page-helpers";

export function AdminAccessDeniedState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          Admin access required
        </h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to view this page. Contact an administrator
          if you believe this is an error.
        </p>
      </div>
    </div>
  );
}

export function AdminPageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
      <p className="mt-1 text-muted-foreground">
        Business metrics and customer management.
      </p>
    </div>
  );
}

export function AdminStatsGrid({
  statCards,
}: {
  statCards: AdminMetricCard[];
}) {
  return (
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
  );
}

export function AdminSystemHealthGrid({
  metrics,
}: {
  metrics: AdminMetrics | undefined;
}) {
  if (!metrics) {
    return null;
  }

  return (
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
            className={`text-3xl font-bold ${metrics.errorsLast24h > 0 ? "text-destructive" : ""}`}
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
  );
}

export function AdminPipelineHealthCard({
  ingestCards,
  onOpenDetail,
}: {
  ingestCards: IngestCardMeta[];
  onOpenDetail: (detail: DetailKey) => void;
}) {
  if (ingestCards.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Crawl Pipeline Health</CardTitle>
        <p className="text-sm text-muted-foreground">
          Track crawl throughput, failure rates, and background jobs over the
          last 24 hours.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ingestCards.map((card) => (
          <div
            key={card.title}
            className={`rounded-lg border p-4 ${card.detailKey ? "cursor-pointer transition hover:border-primary/40" : ""}`}
            data-tone={card.tone}
            role={card.detailKey ? "button" : undefined}
            tabIndex={card.detailKey ? 0 : undefined}
            aria-label={
              card.detailKey ? `View ${card.title} details` : undefined
            }
            onClick={
              card.detailKey ? () => onOpenDetail(card.detailKey!) : undefined
            }
            onKeyDown={
              card.detailKey
                ? (event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenDetail(card.detailKey!);
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
            <p className="text-xs text-muted-foreground">{card.description}</p>
            {card.trend && <PendingSparkline data={card.trend} />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AdminCustomersCard({
  customers,
  customersLoading,
  search,
  onSearchChange,
  onOpenCustomerAction,
}: {
  customers: AdminCustomer[];
  customersLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenCustomerAction: (
    dialog: CustomerActionDialogState,
    plan?: string,
  ) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Customers</CardTitle>
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="max-w-xs"
          />
        </div>
      </CardHeader>
      <CardContent>
        {customersLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2"
              >
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
            {customers.map((customer) => {
              const status = getAdminCustomerStatus(customer);
              const isRestricted = isRestrictedCustomerStatus(status);

              return (
                <div
                  key={customer.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {customer.name ?? "—"}
                      </p>
                      {status && status !== "active" ? (
                        <Badge variant="destructive" className="text-[10px]">
                          {status}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {customer.email}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Badge variant={getCustomerPlanBadgeVariant(customer.plan)}>
                      {customer.plan}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      title="Change plan"
                      onClick={() =>
                        onOpenCustomerAction(
                          {
                            userId: customer.id,
                            name: customer.name ?? customer.email,
                            action: "change-plan",
                          },
                          customer.plan,
                        )
                      }
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                    </Button>
                    {!isRestricted ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        title="Block user"
                        onClick={() =>
                          onOpenCustomerAction({
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
                          onOpenCustomerAction({
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminPromoCodesCard({
  promos,
  actionTarget,
  onOpenCreatePromo,
  onDeactivatePromo,
}: {
  promos: Promo[];
  actionTarget: string | null;
  onOpenCreatePromo: () => void;
  onDeactivatePromo: (promoId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Promo Codes</CardTitle>
          </div>
          <Button size="sm" onClick={onOpenCreatePromo}>
            <Plus className="h-3.5 w-3.5" />
            Create Promo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {promos.length === 0 ? (
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
                    {getPromoSummary(promo)}
                  </p>
                </div>
                {promo.active ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    disabled={actionTarget === `promo-${promo.id}`}
                    onClick={() => onDeactivatePromo(promo.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminSettingsCard({
  httpFallbackEnabled,
  onToggleHttpFallback,
}: {
  httpFallbackEnabled: boolean;
  onToggleHttpFallback: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={httpFallbackEnabled}
            onChange={onToggleHttpFallback}
            className="h-4 w-4 rounded border-gray-300"
          />
          <div>
            <span className="font-medium">Allow HTTP Fallback</span>
            <p className="text-xs text-muted-foreground">
              When enabled, paid plan users can opt in to HTTP fallback if HTTPS
              connection fails during crawling.
            </p>
          </div>
        </label>
      </CardContent>
    </Card>
  );
}

export function AdminBlockedDomainsCard({
  blockedDomains,
  newBlockDomain,
  newBlockReason,
  onNewBlockDomainChange,
  onNewBlockReasonChange,
  onAddBlocked,
  onRemoveBlocked,
}: {
  blockedDomains: Array<{ id: string; domain: string; reason: string | null }>;
  newBlockDomain: string;
  newBlockReason: string;
  onNewBlockDomainChange: (value: string) => void;
  onNewBlockReasonChange: (value: string) => void;
  onAddBlocked: () => void;
  onRemoveBlocked: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Blocked Domains</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-2">
          <Input
            placeholder="domain.com"
            value={newBlockDomain}
            onChange={(event) => onNewBlockDomainChange(event.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Reason (optional)"
            value={newBlockReason}
            onChange={(event) => onNewBlockReasonChange(event.target.value)}
            className="flex-1"
          />
          <Button onClick={onAddBlocked} size="sm">
            <Plus className="mr-1 h-3 w-3" /> Block
          </Button>
        </div>
        {blockedDomains.length === 0 ? (
          <p className="text-sm text-muted-foreground">No domains blocked.</p>
        ) : (
          <div className="space-y-2">
            {blockedDomains.map((blockedDomain) => (
              <div
                key={blockedDomain.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <div>
                  <span className="font-medium">{blockedDomain.domain}</span>
                  {blockedDomain.reason ? (
                    <span className="ml-2 text-muted-foreground">
                      - {blockedDomain.reason}
                    </span>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveBlocked(blockedDomain.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminCreatePromoDialog({
  open,
  newPromo,
  creatingPromo,
  onOpenChange,
  onNewPromoChange,
  onCreatePromo,
}: {
  open: boolean;
  newPromo: NewPromoFormState;
  creatingPromo: boolean;
  onOpenChange: (open: boolean) => void;
  onNewPromoChange: (patch: Partial<NewPromoFormState>) => void;
  onCreatePromo: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onChange={(event) =>
                onNewPromoChange({ code: event.target.value })
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
                onValueChange={(value) =>
                  onNewPromoChange({
                    discountType: value as NewPromoFormState["discountType"],
                  })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent_off">Percent Off</SelectItem>
                  <SelectItem value="amount_off">Amount Off (cents)</SelectItem>
                  <SelectItem value="free_months">Free Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Value</label>
              <Input
                type="number"
                value={newPromo.discountValue || ""}
                onChange={(event) =>
                  onNewPromoChange({
                    discountValue: parseInt(event.target.value, 10) || 0,
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
                onValueChange={(value) =>
                  onNewPromoChange({
                    duration: value as NewPromoFormState["duration"],
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
            {newPromo.duration === "repeating" ? (
              <div>
                <label className="text-sm font-medium">Duration (months)</label>
                <Input
                  type="number"
                  value={newPromo.durationMonths ?? ""}
                  onChange={(event) =>
                    onNewPromoChange({
                      durationMonths:
                        parseInt(event.target.value, 10) || undefined,
                    })
                  }
                  placeholder="3"
                  className="mt-1"
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">
                Max Redemptions (optional)
              </label>
              <Input
                type="number"
                value={newPromo.maxRedemptions ?? ""}
                onChange={(event) =>
                  onNewPromoChange({
                    maxRedemptions:
                      parseInt(event.target.value, 10) || undefined,
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
                onChange={(event) =>
                  onNewPromoChange({ expiresAt: event.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onCreatePromo}
            disabled={creatingPromo || !newPromo.code.trim()}
          >
            {creatingPromo ? "Creating..." : "Create Promo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCustomerActionDialog({
  customerActionDialog,
  actionReason,
  selectedPlan,
  customerActionLoading,
  onOpenChange,
  onActionReasonChange,
  onSelectedPlanChange,
  onCancel,
  onConfirm,
}: {
  customerActionDialog: CustomerActionDialogState | null;
  actionReason: string;
  selectedPlan: string;
  customerActionLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onActionReasonChange: (value: string) => void;
  onSelectedPlanChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!customerActionDialog} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {getCustomerActionDialogTitle(customerActionDialog?.action)}
          </DialogTitle>
          <DialogDescription>{customerActionDialog?.name}</DialogDescription>
        </DialogHeader>

        {customerActionDialog?.action === "block" ||
        customerActionDialog?.action === "suspend" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="action-reason">
              Reason (optional)
            </label>
            <textarea
              id="action-reason"
              className="min-h-[80px] w-full rounded-md border border-input bg-background p-2 text-sm"
              value={actionReason}
              onChange={(event) => onActionReasonChange(event.target.value)}
              placeholder="Reason for this action..."
            />
          </div>
        ) : null}

        {customerActionDialog?.action === "change-plan" ? (
          <div>
            <label className="text-sm font-medium">New Plan</label>
            <Select value={selectedPlan} onValueChange={onSelectedPlanChange}>
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
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={
              customerActionDialog?.action === "unblock"
                ? "default"
                : "destructive"
            }
            onClick={onConfirm}
            disabled={customerActionLoading}
          >
            {customerActionLoading ? "Processing..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PendingSparkline({ data }: { data: TrendPoint[] }) {
  const width = 120;
  const height = 32;

  const points = useMemo(() => {
    if (data.length < 2) {
      return "";
    }

    const values = data.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const denom = Math.max(data.length - 1, 1);

    return data
      .map((point, index) => {
        const x = (index / denom) * width;
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

export function IngestDetailDialog({
  type,
  details,
  actionTarget,
  onClose,
  onRetryJob,
  onCancelJob,
  onReplayEvent,
}: {
  type: DetailKey | null;
  details: AdminIngestDetails | undefined;
  actionTarget: string | null;
  onClose: () => void;
  onRetryJob: (jobId: string) => Promise<void>;
  onCancelJob: (jobId: string, projectName?: string | null) => void;
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

  if (!type) {
    return null;
  }

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
  onCancel: (jobId: string, projectName?: string | null) => void;
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
          {row.startedAt ? (
            <p className="text-xs text-muted-foreground">
              Started {new Date(row.startedAt).toLocaleString()}
            </p>
          ) : null}
          {row.errorMessage ? (
            <p className="mt-2 text-xs text-destructive">{row.errorMessage}</p>
          ) : null}
          {row.cancelReason ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Cancelled
              {row.cancelledAt
                ? ` ${new Date(row.cancelledAt).toLocaleString()}`
                : ""}
              {row.cancelledBy ? ` by ${row.cancelledBy}` : ""}:{" "}
              {row.cancelReason}
            </p>
          ) : null}
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
              onClick={() => onCancel(row.id, row.projectName)}
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

export function CancelJobDialog({
  job,
  reason,
  loading,
  onReasonChange,
  onClose,
  onConfirm,
}: {
  job: CancelJobDialogState | null;
  reason: string;
  loading: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
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
            onChange={(event) => onReasonChange(event.target.value)}
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
