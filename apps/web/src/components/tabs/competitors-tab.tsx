"use client";

import { useCallback, useState } from "react";
import { Plus, Trophy, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { cn, scoreColor } from "@/lib/utils";
import { CompetitorDiscoveryBanner } from "@/components/competitor-discovery-banner";

interface Props {
  projectId: string;
}

export function CompetitorsTab({ projectId }: Props) {
  const { withAuth } = useApi();
  const [newDomain, setNewDomain] = useState("");
  const [benchmarking, setBenchmarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, mutate } = useApiSWR(
    `benchmarks-${projectId}`,
    useCallback(() => api.benchmarks.list(projectId), [projectId]),
  );

  async function handleBenchmark() {
    if (!newDomain.trim()) return;
    setBenchmarking(true);
    setError(null);
    try {
      await withAuth(() =>
        api.benchmarks.trigger({
          projectId,
          competitorDomain: newDomain.trim(),
        }),
      );
      setNewDomain("");
      mutate(); // refetch
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to benchmark competitor",
      );
    } finally {
      setBenchmarking(false);
    }
  }

  const projectScores = data?.projectScores;
  const competitors = data?.competitors ?? [];

  return (
    <div className="space-y-6">
      <CompetitorDiscoveryBanner projectId={projectId} />

      {/* Add competitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Competitor Benchmarking
          </CardTitle>
          <CardDescription>
            Compare your AI-readiness scores against competitors. Enter a domain
            to benchmark.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="competitor.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBenchmark()}
              disabled={benchmarking}
            />
            <Button
              onClick={handleBenchmark}
              disabled={benchmarking || !newDomain.trim()}
            >
              {benchmarking ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-4 w-4" />
              )}
              {benchmarking ? "Benchmarking..." : "Benchmark"}
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <div className="py-8 text-center text-muted-foreground">
          Loading benchmarks...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && competitors.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">
              No competitors benchmarked yet. Add a competitor domain above to
              get started.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Competitor cards */}
      {competitors.map((comp) => (
        <Card key={comp.competitorDomain}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {comp.competitorDomain}
              </CardTitle>
              <Badge
                variant={
                  (comp.comparison.overall ?? 0) > 0
                    ? "success"
                    : (comp.comparison.overall ?? 0) < 0
                      ? "destructive"
                      : "secondary"
                }
              >
                {(comp.comparison.overall ?? 0) > 0
                  ? "You lead"
                  : (comp.comparison.overall ?? 0) < 0
                    ? "They lead"
                    : "Tied"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Benchmarked {new Date(comp.crawledAt).toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              {(
                [
                  "overall",
                  "technical",
                  "content",
                  "aiReadiness",
                  "performance",
                ] as const
              ).map((cat) => {
                const yourScore = projectScores?.[cat] ?? 0;
                const theirScore = comp.scores[cat] ?? 0;
                const delta = comp.comparison[cat] ?? 0;
                const label =
                  cat === "aiReadiness"
                    ? "AI Readiness"
                    : cat.charAt(0).toUpperCase() + cat.slice(1);

                return (
                  <div key={cat} className="text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <span
                        className={cn(
                          "text-lg font-bold",
                          scoreColor(yourScore),
                        )}
                      >
                        {Math.round(yourScore)}
                      </span>
                      <span className="text-xs text-muted-foreground">vs</span>
                      <span
                        className={cn(
                          "text-lg font-bold",
                          scoreColor(theirScore),
                        )}
                      >
                        {Math.round(theirScore)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-0.5">
                      {delta > 0 ? (
                        <TrendingUp className="h-3 w-3 text-success" />
                      ) : delta < 0 ? (
                        <TrendingDown className="h-3 w-3 text-destructive" />
                      ) : null}
                      <span
                        className={cn(
                          "text-xs font-medium",
                          delta > 0
                            ? "text-success"
                            : delta < 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                        )}
                      >
                        {delta > 0 ? "+" : ""}
                        {Math.round(delta)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
