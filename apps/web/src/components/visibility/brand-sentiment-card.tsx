"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type BrandSentiment } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Brain, MessageSquareQuote } from "lucide-react";

const SENTIMENT_CONFIG = {
  positive: {
    label: "Positive",
    variant: "success" as const,
    color: "text-green-600",
  },
  neutral: {
    label: "Neutral",
    variant: "secondary" as const,
    color: "text-muted-foreground",
  },
  negative: {
    label: "Negative",
    variant: "destructive" as const,
    color: "text-red-600",
  },
  mixed: {
    label: "Mixed",
    variant: "warning" as const,
    color: "text-amber-600",
  },
};

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  gemini_ai_mode: "AI Search",
  grok: "Grok",
};

export function BrandSentimentCard({ projectId }: { projectId: string }) {
  const { data: sentiment, isLoading } = useApiSWR<BrandSentiment>(
    `brand-sentiment-${projectId}`,
    useCallback(() => api.brand.getSentiment(projectId), [projectId]),
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Perception</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sentiment || sentiment.sampleSize === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Perception</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Brain className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No sentiment data yet. Run visibility checks where your brand is
              mentioned to see how AI platforms describe you.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const config = sentiment.overallSentiment
    ? SENTIMENT_CONFIG[sentiment.overallSentiment]
    : SENTIMENT_CONFIG.neutral;

  const total = sentiment.sampleSize;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Brand Perception
          </CardTitle>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sentiment score gauge */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sentiment Score</span>
            <span className={cn("font-semibold", config.color)}>
              {sentiment.sentimentScore != null
                ? sentiment.sentimentScore > 0
                  ? `+${sentiment.sentimentScore}`
                  : sentiment.sentimentScore
                : "N/A"}
            </span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="absolute left-1/2 h-full w-px bg-border"
              aria-hidden
            />
            <div
              className={cn(
                "absolute top-0 h-full rounded-full transition-all duration-500",
                (sentiment.sentimentScore ?? 0) >= 0
                  ? "left-1/2 bg-green-500"
                  : "right-1/2 bg-red-500",
              )}
              style={{
                width: `${Math.abs((sentiment.sentimentScore ?? 0) * 50)}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Negative</span>
            <span>Positive</span>
          </div>
        </div>

        {/* Distribution */}
        <div className="grid grid-cols-3 gap-3">
          {(["positive", "neutral", "negative"] as const).map((key) => (
            <div key={key} className="rounded-lg border p-2.5 text-center">
              <p className="text-lg font-semibold">
                {sentiment.distribution[key]}
              </p>
              <p className="text-xs capitalize text-muted-foreground">{key}</p>
            </div>
          ))}
        </div>

        {/* Recent brand descriptions */}
        {sentiment.recentDescriptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">How AI describes your brand</p>
            {sentiment.recentDescriptions.slice(0, 3).map((desc, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-muted/50 p-3"
              >
                <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm italic">
                    &ldquo;{desc.description}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    — {PROVIDER_LABELS[desc.provider] ?? desc.provider}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Provider breakdown */}
        {Object.keys(sentiment.providerBreakdown).length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">By Platform</p>
            <div className="space-y-1.5">
              {Object.entries(sentiment.providerBreakdown).map(
                ([provider, data]) => {
                  const pct =
                    data.total > 0
                      ? Math.round((data.positive / data.total) * 100)
                      : 0;
                  return (
                    <div
                      key={provider}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {PROVIDER_LABELS[provider] ?? provider}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5 text-xs">
                          <span className="text-green-600">
                            {data.positive}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-muted-foreground">
                            {data.neutral}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-red-600">{data.negative}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          ({pct}% positive)
                        </span>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Based on {total} check{total !== 1 ? "s" : ""} where your brand was
          mentioned
        </p>
      </CardContent>
    </Card>
  );
}
