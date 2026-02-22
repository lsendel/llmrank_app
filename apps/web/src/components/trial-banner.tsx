"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

export function TrialBanner() {
  const { data, mutate } = useApiSWR(
    "trial-status",
    useCallback(() => api.trial.status(), []),
  );
  const [starting, setStarting] = useState(false);

  if (!data) return null;

  const { eligible, active, daysRemaining } = data;

  if (active) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>
          Pro Trial: <strong>{daysRemaining} days remaining</strong>
        </span>
        <Link href="/pricing" className="ml-auto">
          <Button size="sm" variant="outline" className="gap-1">
            Subscribe to keep access <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    );
  }

  if (eligible) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Try all Pro features free for 14 days</span>
        <Button
          size="sm"
          className="ml-auto gap-1"
          disabled={starting}
          onClick={async () => {
            setStarting(true);
            try {
              await api.trial.start();
              mutate();
            } finally {
              setStarting(false);
            }
          }}
        >
          {starting ? "Starting..." : "Start Free Trial"}
        </Button>
      </div>
    );
  }

  return null;
}
