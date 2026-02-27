"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";
import { Activity, Loader2 } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "score_change", label: "Score Changes" },
  { value: "ai_readiness", label: "AI Readiness" },
] as const;

function ago(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

interface FeedEvent {
  id: string;
  competitorDomain: string;
  type: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  data: Record<string, unknown>;
  createdAt: string;
}

interface ActivityFeedProps {
  projectId: string;
  feedLimit: number;
  domains?: string[];
}

export function ActivityFeed({
  projectId,
  feedLimit,
  domains = [],
}: ActivityFeedProps) {
  const { withAuth } = useApi();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const buildOpts = useCallback(
    (offset: number) => {
      const opts: {
        limit: number;
        offset: number;
        severity?: string;
        type?: string;
        domain?: string;
      } = { limit: 20, offset };

      if (filter === "critical") opts.severity = "critical";
      else if (filter === "score_change") opts.type = "score_change";
      else if (filter === "ai_readiness") opts.type = "ai_readiness";

      if (domainFilter !== "all") opts.domain = domainFilter;
      return opts;
    },
    [filter, domainFilter],
  );

  // Initial load and when filters change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await withAuth(() =>
          api.competitorMonitoring.getFeed(projectId, buildOpts(0)),
        );
        if (cancelled) return;
        const newEvents: FeedEvent[] = result?.events ?? result?.data ?? [];
        setEvents(newEvents);
        setHasMore(
          newEvents.length === 20 && (feedLimit === Infinity || 20 < feedLimit),
        );
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load activity feed",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, buildOpts, feedLimit, withAuth]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const result = await withAuth(() =>
        api.competitorMonitoring.getFeed(projectId, buildOpts(events.length)),
      );
      if (!mountedRef.current) return;
      const newEvents: FeedEvent[] = result?.events ?? result?.data ?? [];
      setEvents((prev) => [...prev, ...newEvents]);
      setHasMore(
        newEvents.length === 20 &&
          (feedLimit === Infinity || events.length + 20 < feedLimit),
      );
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to load more events",
      );
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }

  const isCapped = feedLimit <= 5 && events.length >= feedLimit;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}

        {domains.length > 0 && (
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All domains</SelectItem>
              {domains.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading activity...
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">
              No competitor activity detected yet. Events will appear here as
              competitors are monitored.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {!loading && events.length > 0 && (
        <div className="space-y-3">
          {events.map((event) => (
            <Card
              key={event.id}
              className="overflow-hidden"
              style={{
                borderLeftWidth: "4px",
                borderLeftColor:
                  SEVERITY_COLORS[event.severity] ?? SEVERITY_COLORS.info,
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {event.competitorDomain}
                      </span>
                      <Badge
                        variant={
                          event.severity === "critical"
                            ? "destructive"
                            : event.severity === "warning"
                              ? "warning"
                              : "secondary"
                        }
                        className="text-xs"
                      >
                        {event.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {event.type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.summary}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {ago(event.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !isCapped && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}

      {/* Upgrade CTA for free tier */}
      {isCapped && (
        <UpgradePrompt
          feature="Full Activity Feed"
          description="Free tier shows only the 5 most recent events. Upgrade for unlimited competitor activity history."
          nextTier="Starter ($79/mo)"
          nextTierUnlocks="Unlimited feed events, score trend charts, watchlist queries"
        />
      )}
    </div>
  );
}
