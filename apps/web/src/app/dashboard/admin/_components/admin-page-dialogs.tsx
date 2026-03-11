import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type {
  AdminIngestDetails,
  CrawlJobSummary,
  OutboxEventSummary,
} from "@/lib/api";
import {
  getCustomerActionDialogTitle,
  type CancelJobDialogState,
  type CustomerActionDialogState,
  type DetailKey,
  type NewPromoFormState,
  type TrendPoint,
} from "../admin-page-helpers";

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

export function PendingSparkline({ data }: { data: TrendPoint[] }) {
  const width = 120;
  const height = 32;

  const points = useMemo(() => {
    if (data.length < 2) return "";

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
              {row.cancelledBy ? ` by ${row.cancelledBy}` : ""}: {row.cancelReason}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
              <a href={`/dashboard/projects/${row.projectId}`}>Project</a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
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
              {actionTarget === `job-cancel-${row.id}` ? "Cancelling..." : "Cancel"}
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
            {job?.projectName ? ` - ${job.projectName}` : ""}
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
