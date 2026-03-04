"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

function getUsageColor(pct: number): {
  text: string;
  indicator: string;
} {
  if (pct > 80) {
    return { text: "text-red-600", indicator: "bg-red-600" };
  }
  if (pct > 50) {
    return { text: "text-yellow-600", indicator: "bg-yellow-500" };
  }
  return { text: "text-emerald-600", indicator: "bg-emerald-500" };
}

export function UsageMeter(): React.ReactNode {
  const { data } = useApiSWR(
    "billing-usage",
    useCallback(() => api.billing.getInfo(), []),
  );

  if (!data) return null;

  const { plan, crawlCreditsRemaining, crawlCreditsTotal } = data;
  const isUnlimited = !crawlCreditsTotal || !Number.isFinite(crawlCreditsTotal);

  const used = isUnlimited ? 0 : crawlCreditsTotal - crawlCreditsRemaining;
  const pct =
    isUnlimited || crawlCreditsTotal <= 0
      ? 0
      : Math.round((used / crawlCreditsTotal) * 100);

  const { text, indicator } = getUsageColor(pct);

  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
      <Badge variant="outline" className="capitalize">
        {plan}
      </Badge>
      {isUnlimited ? (
        <span className="text-sm text-emerald-600">Unlimited crawls</span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Crawls:</span>
          <div className="w-20">
            <Progress
              value={pct}
              className="h-2"
              indicatorClassName={indicator}
            />
          </div>
          <span className={text}>
            {used}/{crawlCreditsTotal}
          </span>
        </div>
      )}
      {!isUnlimited && pct > 80 && (
        <Link
          href="/pricing"
          className="text-xs font-medium text-primary hover:underline"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}
