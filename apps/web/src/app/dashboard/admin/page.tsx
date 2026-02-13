"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DollarSign, TrendingUp, Users, Percent } from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type AdminStats, type AdminCustomer } from "@/lib/api";

export default function AdminPage() {
  const [search, setSearch] = useState("");

  const { data: stats, isLoading: statsLoading } = useApiSWR<AdminStats>(
    "admin-stats",
    useCallback((token: string) => api.admin.getStats(token), []),
  );

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

      {/* Stat Cards */}
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
    </div>
  );
}
