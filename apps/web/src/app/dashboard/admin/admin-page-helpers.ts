import type { ComponentType } from "react";
import {
  Activity,
  AlertTriangle,
  DollarSign,
  Inbox,
  Percent,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import type { AdminCustomer, AdminStats, Promo } from "@/lib/api";

export interface TrendPoint {
  timestamp: number;
  value: number;
}

export type DetailKey = "pending" | "running" | "failed" | "outbox";

export type CustomerActionType =
  | "block"
  | "suspend"
  | "unblock"
  | "change-plan"
  | "cancel-sub";

export interface IngestCardMeta {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  tone: "default" | "warning" | "destructive";
  trend?: TrendPoint[];
  detailKey?: DetailKey;
}

export interface AdminMetricCard {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}

export interface AdminMetrics {
  activeCrawls: number;
  errorsLast24h: number;
  systemTime: string;
}

export interface CancelJobDialogState {
  jobId: string;
  projectName?: string | null;
}

export interface CustomerActionDialogState {
  userId: string;
  name: string;
  action: CustomerActionType;
}

export interface NewPromoFormState {
  code: string;
  discountType: "percent_off" | "amount_off" | "free_months";
  discountValue: number;
  duration: "once" | "repeating" | "forever";
  durationMonths: number | undefined;
  maxRedemptions: number | undefined;
  expiresAt: string;
}

export type AdminCustomerWithStatus = AdminCustomer & { status?: string };

export const DEFAULT_CANCEL_REASON = "Cancelled by admin";

export const DEFAULT_NEW_PROMO: NewPromoFormState = {
  code: "",
  discountType: "percent_off",
  discountValue: 0,
  duration: "once",
  durationMonths: undefined,
  maxRedemptions: undefined,
  expiresAt: "",
};

export const CUSTOMER_PLAN_BADGE_VARIANTS: Record<
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

export function buildAdminStatCards(stats?: AdminStats): AdminMetricCard[] {
  return [
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
}

export function buildAdminIngestCards(
  stats: AdminStats | undefined,
  pendingHistory: TrendPoint[],
): IngestCardMeta[] {
  if (!stats) {
    return [];
  }

  return [
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
        stats.ingestHealth.avgCompletionMinutes > 30 ? "warning" : "default",
    },
    {
      title: "Failed (24h)",
      value: stats.ingestHealth.failedLast24h.toString(),
      icon: AlertTriangle,
      description: "Jobs marked failed in last day",
      tone: stats.ingestHealth.failedLast24h > 0 ? "destructive" : "default",
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
  ];
}

export function getPromoSummary(promo: Promo): string {
  const discountLabel =
    promo.discountType === "percent_off"
      ? `${promo.discountValue}% off`
      : promo.discountType === "free_months"
        ? `${promo.discountValue} free months`
        : `$${(promo.discountValue / 100).toFixed(2)} off`;

  const durationLabel = `${promo.duration}${promo.durationMonths ? ` (${promo.durationMonths}mo)` : ""}`;
  const usageLabel = `${promo.timesRedeemed}${promo.maxRedemptions ? `/${promo.maxRedemptions}` : ""} used`;

  return `${discountLabel} · ${durationLabel} · ${usageLabel}`;
}

export function getCustomerActionDialogTitle(
  action?: CustomerActionType | null,
): string {
  switch (action) {
    case "block":
      return "Block User";
    case "suspend":
      return "Suspend User";
    case "unblock":
      return "Unblock User";
    case "change-plan":
      return "Change Plan";
    default:
      return "Cancel Subscription";
  }
}

export function getAdminCustomerStatus(
  customer: AdminCustomer,
): string | undefined {
  return (customer as AdminCustomerWithStatus).status;
}

export function isRestrictedCustomerStatus(status?: string): boolean {
  return status === "banned" || status === "suspended";
}

export function getCustomerPlanBadgeVariant(plan: string) {
  return CUSTOMER_PLAN_BADGE_VARIANTS[plan] ?? "default";
}
