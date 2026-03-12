import { type KeyboardEvent } from "react";
import {
  Ban,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import type { AdminCustomer, Promo } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getAdminCustomerStatus,
  getCustomerPlanBadgeVariant,
  getPromoSummary,
  isRestrictedCustomerStatus,
  type AdminMetricCard,
  type AdminMetrics,
  type CustomerActionDialogState,
  type DetailKey,
  type IngestCardMeta,
} from "../admin-page-helpers";
import {
  AdminCreatePromoDialog,
  AdminCustomerActionDialog,
  CancelJobDialog,
  IngestDetailDialog,
  PendingSparkline,
} from "./admin-page-dialogs";
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







export {
  AdminCreatePromoDialog,
  AdminCustomerActionDialog,
  CancelJobDialog,
  IngestDetailDialog,
};
