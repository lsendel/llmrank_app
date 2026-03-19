"use client";

import { useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Bot,
  Globe,
  ExternalLink,
  Code,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface AiTrafficSummary {
  totalPageviews: number;
  aiTraffic: {
    referral: number;
    bot: number;
    total: number;
  };
  retentionDays: number;
  trend: {
    pageviewsTrend: number | null;
    aiTrafficTrend: number | null;
  };
  byProvider?: Record<string, number>;
  topPages?: Array<{ path: string; aiVisits: number; totalVisits: number }>;
}

interface AiTrafficTabProps {
  projectId: string;
  snippetEnabled: boolean;
}

export function AiTrafficTab({ projectId, snippetEnabled }: AiTrafficTabProps) {
  const [summary, setSummary] = useState<AiTrafficSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null,
  );

  async function handleTestSnippet() {
    setTesting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/analytics/${projectId}/verify-snippet`,
        {
          credentials: "include",
        },
      );
      const json = await res.json();
      const data = json?.data;
      if (data?.installed) {
        setTestResult("success");
      } else {
        setTestResult("error");
      }
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 8000);
    }
  }

  useEffect(() => {
    api.analytics
      .getSummary(projectId)
      .then((data) => {
        setSummary({
          totalPageviews: data.totalVisits,
          aiTraffic: {
            referral: data.aiTraffic.byProvider
              .filter((p) => p.type === "referral")
              .reduce((sum, p) => sum + p.visits, 0),
            bot: data.aiTraffic.byProvider
              .filter((p) => p.type === "bot")
              .reduce((sum, p) => sum + p.visits, 0),
            total: data.aiTraffic.total,
          },
          retentionDays: 30,
          trend: data.trend,
          byProvider: Object.fromEntries(
            data.aiTraffic.byProvider.map((p) => [p.provider, p.visits]),
          ),
          topPages: data.topPages,
        });
      })
      .catch((err: unknown) =>
        setError(
          err instanceof Error ? err.message : "Failed to load analytics",
        ),
      )
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-destructive">{error}</div>
    );
  }

  if (!summary) return null;

  const trendValue = summary.trend.aiTrafficTrend ?? 0;
  const TrendIcon = trendValue >= 0 ? ArrowUp : ArrowDown;
  const providerEntries = summary.byProvider
    ? Object.entries(summary.byProvider)
    : [];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {summary.totalPageviews.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Bot className="mr-1 inline h-4 w-4" />
              AI Bot Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {summary.aiTraffic.bot.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Globe className="mr-1 inline h-4 w-4" />
              AI Referral Visits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">
                {summary.aiTraffic.referral.toLocaleString()}
              </p>
              {summary.trend.aiTrafficTrend !== null && (
                <span
                  className={cn(
                    "flex items-center text-sm",
                    trendValue >= 0 ? "text-green-600" : "text-red-600",
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {summary.trend.aiTrafficTrend}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider breakdown */}
      {providerEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Provider Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {providerEntries.map(([provider, visits]) => (
                <div
                  key={provider}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm font-medium capitalize">
                    {provider}
                  </span>
                  <span className="text-sm font-semibold">
                    {visits.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top pages */}
      {summary.topPages && summary.topPages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Pages (AI Traffic)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.topPages.map((page) => (
                <div
                  key={page.path}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="truncate text-sm font-mono">
                    {page.path}
                  </span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {page.totalVisits} total
                    </span>
                    <span className="font-semibold">{page.aiVisits} AI</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snippet CTA */}
      {snippetEnabled && summary.totalPageviews === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <Code className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              Snippet installed — waiting for traffic
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Data appears within minutes of the first visit. AI traffic from
              ChatGPT, Claude, and Perplexity will be classified automatically.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleTestSnippet}
              disabled={testing}
            >
              {testing
                ? "Checking..."
                : testResult === "success"
                  ? "✓ Snippet verified"
                  : testResult === "error"
                    ? "✗ Not found"
                    : "Verify Installation"}
            </Button>
          </CardContent>
        </Card>
      )}
      {!snippetEnabled && summary.totalPageviews === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <Code className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Not seeing data?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add the tracking snippet to your site to see AI traffic analytics.
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              <ExternalLink className="mr-1 h-3 w-3" />
              View setup instructions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
