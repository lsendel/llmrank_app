"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus, Zap } from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type PortfolioPriorityItem } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

type PriorityFilter = "all" | "critical" | "high" | "medium" | "low";
type ChannelFilter = "all" | "both" | "google" | "llm";

const PRIORITY_FILTERS: PriorityFilter[] = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
];
const CHANNEL_FILTERS: ChannelFilter[] = ["all", "both", "google", "llm"];

function priorityVariant(priority: PortfolioPriorityItem["priority"]) {
  if (priority === "critical") return "destructive" as const;
  if (priority === "high") return "warning" as const;
  if (priority === "medium") return "info" as const;
  return "secondary" as const;
}

function impactVariant(impact: PortfolioPriorityItem["expectedImpact"]) {
  if (impact === "high") return "destructive" as const;
  if (impact === "medium") return "warning" as const;
  return "secondary" as const;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function PriorityFeedCard() {
  const { toast } = useToast();
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [ownerOverrides, setOwnerOverrides] = useState<Record<string, string>>(
    {},
  );
  const [runningProjectId, setRunningProjectId] = useState<string | null>(null);

  const { data, isLoading, mutate } = useApiSWR(
    "portfolio-priority-feed",
    useCallback(() => api.dashboard.getPriorityFeed(20), []),
    { refreshInterval: 60_000 },
  );

  const topItems = useMemo(() => {
    const items = data ?? [];
    return items
      .filter((item) => {
        if (priorityFilter !== "all" && item.priority !== priorityFilter) {
          return false;
        }
        if (channelFilter !== "all" && item.channel !== channelFilter) {
          return false;
        }
        return true;
      })
      .slice(0, 5);
  }, [channelFilter, data, priorityFilter]);

  function ownerLabel(item: PortfolioPriorityItem) {
    return ownerOverrides[item.id] ?? item.owner ?? "Unassigned";
  }

  function assignToMe(item: PortfolioPriorityItem) {
    setOwnerOverrides((prev) => ({ ...prev, [item.id]: "Me" }));
    toast({
      title: "Assigned",
      description: `"${item.title}" is now assigned to you.`,
    });
  }

  async function runAnalysis(item: PortfolioPriorityItem) {
    setRunningProjectId(item.projectId);
    try {
      await api.projects.rerunAutoGeneration(item.projectId);
      toast({
        title: "Analysis started",
        description: `${item.projectName} pipeline is running.`,
      });
      await mutate();
    } catch (err: unknown) {
      toast({
        title: "Could not run analysis",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRunningProjectId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Portfolio Priority Feed</CardTitle>
          <Badge variant="secondary">{(data ?? []).length} total</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={priorityFilter === filter ? "default" : "outline"}
              onClick={() => setPriorityFilter(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={channelFilter === filter ? "default" : "outline"}
              onClick={() => setChannelFilter(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading prioritized actions...
          </div>
        ) : topItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions match the selected filters.
          </p>
        ) : (
          topItems.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.projectName} · {item.projectDomain}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={priorityVariant(item.priority)}>
                    {item.priority}
                  </Badge>
                  <Badge variant={impactVariant(item.expectedImpact)}>
                    impact {item.expectedImpact}
                  </Badge>
                </div>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Why now: {item.reason}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">Owner: {ownerLabel(item)}</Badge>
                <Badge variant="outline">Due: {formatDate(item.dueDate)}</Badge>
                <Badge variant="outline">Effort: {item.effort}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={item.action}>Open</Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => assignToMe(item)}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Assign to Me
                </Button>
                <Button
                  size="sm"
                  onClick={() => runAnalysis(item)}
                  disabled={runningProjectId === item.projectId}
                >
                  {runningProjectId === item.projectId ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Run Analysis
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
