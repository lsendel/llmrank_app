"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";

const EMPTY_SUB = () => () => {};
const SERVER_SNAPSHOT = true;

export function CompetitorDiscoveryBanner({
  projectId,
}: {
  projectId: string;
}) {
  const params = useParams<{ id: string }>();
  const storageKey = `competitor-discovery-${projectId}`;
  const isDismissedFromStorage = useSyncExternalStore(
    EMPTY_SUB,
    () => localStorage.getItem(storageKey) === "true",
    () => SERVER_SNAPSHOT,
  );
  const [manuallyDismissed, setManuallyDismissed] = useState(false);
  const dismissed = isDismissedFromStorage || manuallyDismissed;

  const { data } = useApiSWR(
    dismissed ? null : `benchmarks-${projectId}`,
    useCallback(() => api.benchmarks.list(projectId), [projectId]),
  );

  if (dismissed || !data || data.competitors.length === 0) return null;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setManuallyDismissed(true);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4 text-primary" />
            We found {data.competitors.length} competitor
            {data.competitors.length !== 1 ? "s" : ""} for you
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="space-y-1">
          {data.competitors.map((c) => (
            <li
              key={c.competitorDomain}
              className="flex items-center gap-2 text-sm"
            >
              <span className="font-medium">{c.competitorDomain}</span>
              {c.scores?.overall != null && (
                <Badge variant="secondary" className="text-[10px]">
                  {Math.round(c.scores.overall)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="default" onClick={handleDismiss}>
            Looks Good
          </Button>
          <Link href={`/dashboard/projects/${params.id}?tab=settings`}>
            <Button size="sm" variant="outline">
              Edit in Settings
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
