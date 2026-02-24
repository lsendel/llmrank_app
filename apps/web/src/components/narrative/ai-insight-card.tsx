"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type BillingInfo } from "@/lib/api";
import Link from "next/link";
import { Brain } from "lucide-react";

interface AiInsightCardProps {
  crawlJobId: string;
  projectId: string;
}

export function AiInsightCard({ crawlJobId, projectId }: AiInsightCardProps) {
  const { data: billing } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );

  const plan = billing?.plan ?? "free";
  const isPro = plan === "pro" || plan === "agency";

  const { data: narrative, isLoading } = useApiSWR(
    isPro ? `narrative-${crawlJobId}` : null,
    useCallback(() => api.narratives.get(crawlJobId), [crawlJobId]),
  );

  if (!isPro) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="space-y-2 text-center">
            <p className="font-semibold">AI-Powered Analysis</p>
            <p className="text-sm text-muted-foreground">
              Upgrade to Pro for AI-generated narrative reports
            </p>
            <Button size="sm" asChild>
              <Link href="/dashboard/billing">Upgrade</Link>
            </Button>
          </div>
        </div>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4" />
            AI Insight
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="select-none space-y-2 blur-sm">
            <p>
              Your site scores well in technical SEO but content quality needs
              improvement...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4" />
            AI Insight
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const execSummary = (narrative?.sections as any[])?.find(
    (s: any) => s.type === "executive_summary",
  );

  if (!execSummary) return null;

  const displayContent = execSummary.editedContent ?? execSummary.content;
  const truncated = displayContent.replace(/<[^>]*>/g, "").slice(0, 600);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Brain className="h-4 w-4 text-primary" />
          AI Insight
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            AI
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {truncated}...
        </p>
        <Button variant="link" size="sm" className="mt-2 p-0" asChild>
          <Link
            href={`/dashboard/projects/${projectId}?tab=ai-analysis&crawlId=${crawlJobId}`}
          >
            Read Full Analysis
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
