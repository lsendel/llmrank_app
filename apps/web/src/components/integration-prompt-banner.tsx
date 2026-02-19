"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { Plug, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

const EMPTY_SUB = () => () => {};
const SERVER_SNAPSHOT = true;

interface Integration {
  provider: string;
  enabled: boolean;
}

export function IntegrationPromptBanner({ projectId }: { projectId: string }) {
  const storageKey = `integration-prompt-${projectId}`;
  const isDismissedFromStorage = useSyncExternalStore(
    EMPTY_SUB,
    () => localStorage.getItem(storageKey) === "true",
    () => SERVER_SNAPSHOT,
  );
  const [manuallyDismissed, setManuallyDismissed] = useState(false);
  const dismissed = isDismissedFromStorage || manuallyDismissed;

  const { data: integrations } = useApiSWR<Integration[]>(
    dismissed ? null : `integrations-${projectId}`,
    useCallback(() => api.integrations.list(projectId), [projectId]),
  );

  if (dismissed || !integrations) return null;

  const connected = new Set(
    integrations.filter((i) => i.enabled).map((i) => i.provider),
  );
  const missing = ["psi", "clarity"].filter((p) => !connected.has(p));

  if (missing.length === 0) return null;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setManuallyDismissed(true);
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
      <CardContent className="flex items-center gap-3 py-3">
        <Plug className="h-4 w-4 text-blue-600 shrink-0" />
        <p className="text-sm flex-1">
          Connect {missing.join(" and ")} for richer performance and UX data.
        </p>
        <a
          href="?tab=integrations"
          className="text-sm text-primary font-medium hover:underline"
        >
          Connect
        </a>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleDismiss}
        >
          <X className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
