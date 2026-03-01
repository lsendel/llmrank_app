"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiUrl } from "@/lib/api-base-url";
import { ScrollText, Clock, Filter, ChevronDown, Loader2 } from "lucide-react";

async function orgFetcher(path: string): Promise<AuditLogResponse> {
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  actorName: string | null;
  action: string;
  resource: string;
  details: string | null;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  hasMore: boolean;
}

const ACTION_TYPES = [
  { value: "all", label: "All actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "invite", label: "Invite" },
  { value: "revoke", label: "Revoke" },
  { value: "login", label: "Login" },
] as const;

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
] as const;

const PAGE_SIZE = 50;

function getActionBadgeVariant(
  action: string,
): "success" | "info" | "destructive" | "secondary" {
  const lower = action.toLowerCase();
  if (lower.includes("create") || lower.includes("invite")) return "success";
  if (lower.includes("update")) return "info";
  if (lower.includes("delete") || lower.includes("revoke"))
    return "destructive";
  return "secondary";
}

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(),
    time: d.toLocaleTimeString(),
  };
}

function getDateRangeParam(range: string): string | null {
  const now = Date.now();
  switch (range) {
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "90d":
      return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

function buildUrl(orgId: string, actionFilter: string, dateRange: string) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: "0",
  });
  if (actionFilter !== "all") params.set("action", actionFilter);
  const since = getDateRangeParam(dateRange);
  if (since) params.set("since", since);
  return `/api/orgs/${orgId}/audit-log?${params.toString()}`;
}

export function AuditLogSection({ orgId }: { orgId: string }) {
  const [actionFilter, setActionFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [extraEntries, setExtraEntries] = useState<AuditLogEntry[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraHasMore, setExtraHasMore] = useState(false);

  const swrKey = buildUrl(orgId, actionFilter, dateRange);
  const { data, error, isLoading: loading } = useSWR(swrKey, orgFetcher);

  // Reset extra pages when filters change
  const [prevKey, setPrevKey] = useState(swrKey);
  if (swrKey !== prevKey) {
    setPrevKey(swrKey);
    setExtraEntries([]);
    setExtraHasMore(false);
  }

  const entries = [...(data?.data ?? []), ...extraEntries];
  const hasMore =
    extraEntries.length > 0 ? extraHasMore : (data?.hasMore ?? false);

  async function handleLoadMore() {
    const nextOffset = entries.length;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });
      if (actionFilter !== "all") params.set("action", actionFilter);
      const since = getDateRangeParam(dateRange);
      if (since) params.set("since", since);
      const result = await orgFetcher(
        `/api/orgs/${orgId}/audit-log?${params.toString()}`,
      );
      setExtraEntries((prev) => [...prev, ...result.data]);
      setExtraHasMore(result.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Audit Log</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading audit log...
            </span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load audit log entries.
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && entries.length === 0 && (
          <div className="py-12 text-center">
            <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No audit log entries yet.
            </p>
          </div>
        )}

        {/* Audit log table */}
        {!loading && !error && entries.length > 0 && (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const ts = formatTimestamp(entry.timestamp);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{ts.date}</div>
                              <div className="text-xs text-muted-foreground">
                                {ts.time}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {entry.actorName && (
                              <div className="font-medium">
                                {entry.actorName}
                              </div>
                            )}
                            <div className="text-muted-foreground">
                              {entry.actorEmail}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(entry.action)}>
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{entry.resource}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {entry.details ?? "-"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Load More
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
