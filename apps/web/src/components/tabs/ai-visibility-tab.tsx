"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api, type VisibilityGap } from "@/lib/api";
import { AIVisibilityScoreCard } from "@/components/ai-visibility/score-card";
import { BacklinkCard } from "@/components/ai-visibility/backlink-card";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Search,
  Loader2,
} from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  gemini_ai_mode: "AI Search",
};

export default function AIVisibilityTab({
  projectId,
}: {
  projectId: string;
  domain: string;
}) {
  const { withAuth } = useApi();
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<{
    gscKeywords: {
      keyword: string;
      source: string;
      clicks?: number;
      impressions?: number;
    }[];
    llmKeywords: string[];
  } | null>(null);

  // Fetch all data
  const { data: score, isLoading: scoreLoading } = useApiSWR(
    `ai-score-${projectId}`,
    useCallback(() => api.visibility.getAIScore(projectId), [projectId]),
  );

  const { data: checks } = useApiSWR(
    `vis-checks-${projectId}`,
    useCallback(() => api.visibility.list(projectId), [projectId]),
  );

  const { data: gaps } = useApiSWR(
    `vis-gaps-${projectId}`,
    useCallback(() => api.visibility.getGaps(projectId), [projectId]),
  );

  const { data: blSummary, isLoading: blLoading } = useApiSWR(
    `backlinks-${projectId}`,
    useCallback(() => api.backlinks.getSummary(projectId), [projectId]),
  );

  // Compute LLM vs AI Mode stats from checks
  const llmChecks = (checks ?? []).filter(
    (c) => c.llmProvider !== "gemini_ai_mode",
  );
  const aiModeChecks = (checks ?? []).filter(
    (c) => c.llmProvider === "gemini_ai_mode",
  );

  const llmMentionRate =
    llmChecks.length > 0
      ? Math.round(
          (llmChecks.filter((c) => c.brandMentioned).length /
            llmChecks.length) *
            100,
        )
      : 0;

  const aiModeRate =
    aiModeChecks.length > 0
      ? Math.round(
          (aiModeChecks.filter((c) => c.brandMentioned).length /
            aiModeChecks.length) *
            100,
        )
      : 0;

  // Group checks by query for keyword performance table
  const queryMap = new Map<
    string,
    { query: string; providers: Record<string, boolean> }
  >();
  for (const check of checks ?? []) {
    const existing = queryMap.get(check.query) ?? {
      query: check.query,
      providers: {},
    };
    existing.providers[check.llmProvider] = check.brandMentioned ?? false;
    queryMap.set(check.query, existing);
  }
  const keywordRows = Array.from(queryMap.values()).slice(0, 20);

  async function handleDiscover() {
    setDiscovering(true);
    try {
      await withAuth(async () => {
        const result = await api.visibility.discoverKeywords(projectId);
        setDiscoveryResult(result);
      });
    } catch {
      // Error handled by withAuth toast
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Row: Score + Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <AIVisibilityScoreCard score={score ?? null} isLoading={scoreLoading} />

        {/* LLM Mentions Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">LLM Mentions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{llmMentionRate}%</span>
              <span className="text-sm text-muted-foreground">
                mention rate
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Across {llmChecks.length} checks from{" "}
              {new Set(llmChecks.map((c) => c.llmProvider)).size} providers
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["chatgpt", "claude", "perplexity", "gemini", "copilot"].map(
                (p) => {
                  const pChecks = llmChecks.filter((c) => c.llmProvider === p);
                  const mentioned = pChecks.filter(
                    (c) => c.brandMentioned,
                  ).length;
                  const hasMentions = mentioned > 0;
                  return (
                    <Badge
                      key={p}
                      variant={hasMentions ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {hasMentions ? (
                        <Check className="mr-1 h-3 w-3" />
                      ) : (
                        <X className="mr-1 h-3 w-3" />
                      )}
                      {PROVIDER_LABELS[p] ?? p}
                    </Badge>
                  );
                },
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Search Presence */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              AI Search Presence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{aiModeRate}%</span>
              <span className="text-sm text-muted-foreground">
                citation rate
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Based on {aiModeChecks.length} AI search checks (Gemini AI Mode
              proxy)
            </p>
            {aiModeChecks.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Enable &quot;AI Search (Gemini)&quot; in your scheduled queries
                to track AI search presence.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Keyword Performance + Gaps */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Keyword Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Keyword Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {keywordRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No visibility checks yet. Run a check from the Visibility tab or
                set up scheduled queries.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    {Object.keys(PROVIDER_LABELS).map((p) => (
                      <TableHead key={p} className="text-center text-xs">
                        {PROVIDER_LABELS[p]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywordRows.map((row) => (
                    <TableRow key={row.query}>
                      <TableCell className="max-w-[200px] truncate text-sm font-medium">
                        {row.query}
                      </TableCell>
                      {Object.keys(PROVIDER_LABELS).map((p) => (
                        <TableCell key={p} className="text-center">
                          {row.providers[p] === true ? (
                            <Check className="mx-auto h-4 w-4 text-green-600" />
                          ) : row.providers[p] === false ? (
                            <X className="mx-auto h-4 w-4 text-red-400" />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Visibility Gaps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              Visibility Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!gaps || gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No gaps detected. You&apos;re being mentioned where competitors
                are.
              </p>
            ) : (
              <div className="space-y-3">
                {gaps.slice(0, 8).map((gap: VisibilityGap) => (
                  <div
                    key={gap.query}
                    className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20"
                  >
                    <p className="text-sm font-medium">{gap.query}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {gap.competitorsCited.map((c) => (
                        <Badge
                          key={c.domain}
                          variant="secondary"
                          className="text-xs"
                        >
                          {c.domain}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Competitors cited but you&apos;re not
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Backlinks + Keyword Discovery */}
      <div className="grid gap-4 md:grid-cols-2">
        <BacklinkCard summary={blSummary ?? null} isLoading={blLoading} />

        {/* Keyword Discovery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Keyword Discovery
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Discover new keywords to track based on your search traffic and AI
              analysis.
            </p>

            <Button onClick={handleDiscover} disabled={discovering} size="sm">
              {discovering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {discovering ? "Discovering..." : "Discover Keywords"}
            </Button>

            {discoveryResult && (
              <div className="mt-4 space-y-3">
                {discoveryResult.gscKeywords.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">
                      From Search Traffic (GSC)
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {discoveryResult.gscKeywords.map((kw) => (
                        <Badge
                          key={kw.keyword}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/5"
                        >
                          <TrendingUp className="mr-1 h-3 w-3" />
                          {kw.keyword}
                          {kw.impressions && (
                            <span className="ml-1 text-muted-foreground">
                              ({kw.impressions} imp)
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {discoveryResult.llmKeywords.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">
                      AI-Suggested Keywords
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {discoveryResult.llmKeywords.map((kw) => (
                        <Badge
                          key={kw}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/5"
                        >
                          <Sparkles className="mr-1 h-3 w-3" />
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {discoveryResult.gscKeywords.length === 0 &&
                  discoveryResult.llmKeywords.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No new keyword suggestions found. Try connecting GSC for
                      data-driven suggestions.
                    </p>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
