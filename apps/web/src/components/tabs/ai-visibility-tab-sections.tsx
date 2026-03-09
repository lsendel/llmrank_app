import { AIVisibilityScoreCard } from "@/components/ai-visibility/score-card";
import { BacklinkCard } from "@/components/ai-visibility/backlink-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StateMessage } from "@/components/ui/state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type VisibilityGap, type VisibilityCheck } from "@/lib/api";
import { relativeTimeLabel } from "@/lib/insight-metadata";
import {
  Check,
  Loader2,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  KEYWORD_PROVIDER_ORDER,
  PROVIDER_LABELS,
  type AIVisibilityScore,
  type BacklinkSummary,
  type DiscoveryResult,
  type KeywordRow,
  type ProviderMentionSummary,
  type VisibilityMeta,
} from "./ai-visibility-tab-helpers";

export function AIVisibilityFreshnessSummary({
  checks,
  visibilityMeta,
}: {
  checks: VisibilityCheck[] | undefined;
  visibilityMeta: VisibilityMeta | null;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {checks === undefined && (
            <Badge variant="secondary">Loading visibility freshness...</Badge>
          )}
          {checks !== undefined && !visibilityMeta && (
            <Badge variant="secondary">
              Run your first visibility check to establish confidence
            </Badge>
          )}
          {visibilityMeta && (
            <>
              <Badge variant="secondary">
                Last checked:{" "}
                {relativeTimeLabel(visibilityMeta.latestCheckedAt)}
              </Badge>
              <Badge variant="secondary">
                Checks sampled: {visibilityMeta.checks}
              </Badge>
              <Badge variant="secondary">
                Provider diversity: {visibilityMeta.providerCount}/
                {KEYWORD_PROVIDER_ORDER.length}
              </Badge>
              <Badge variant="secondary">
                Query coverage: {visibilityMeta.queryCount}
              </Badge>
              <Badge variant={visibilityMeta.confidence.variant}>
                Confidence: {visibilityMeta.confidence.label}
              </Badge>
            </>
          )}
        </div>
        {visibilityMeta && (
          <p className="text-xs text-muted-foreground">
            Confidence reflects repeated checks and source diversity across LLM
            and AI search providers.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AIVisibilitySummaryCards({
  score,
  scoreLoading,
  llmMentionRate,
  llmChecks,
  llmProviderCount,
  llmProviderSummary,
  aiModeRate,
  aiModeChecks,
}: {
  score: AIVisibilityScore | undefined;
  scoreLoading: boolean;
  llmMentionRate: number;
  llmChecks: VisibilityCheck[];
  llmProviderCount: number;
  llmProviderSummary: ProviderMentionSummary[];
  aiModeRate: number;
  aiModeChecks: VisibilityCheck[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <AIVisibilityScoreCard score={score ?? null} isLoading={scoreLoading} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">LLM Mentions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{llmMentionRate}%</span>
            <span className="text-sm text-muted-foreground">mention rate</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Across {llmChecks.length} checks from {llmProviderCount} providers
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {llmProviderSummary.map((provider) => (
              <Badge
                key={provider.provider}
                variant={provider.hasMentions ? "default" : "secondary"}
                className="text-xs"
              >
                {provider.hasMentions ? (
                  <Check className="mr-1 h-3 w-3" />
                ) : (
                  <X className="mr-1 h-3 w-3" />
                )}
                {provider.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

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
            <span className="text-sm text-muted-foreground">citation rate</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on {aiModeChecks.length} AI search checks (Gemini AI Mode
            proxy)
          </p>
          {aiModeChecks.length === 0 && (
            <p className="mt-2 text-xs text-amber-600">
              Enable &quot;AI Search (Gemini)&quot; in your scheduled queries to
              track AI search presence.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AIVisibilityKeywordPerformanceSection({
  keywordRows,
}: {
  keywordRows: KeywordRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Keyword Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {keywordRows.length === 0 ? (
          <StateMessage
            variant="empty"
            compact
            title="No visibility checks yet"
            description="Run a check from the Visibility tab or set up scheduled queries."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                {KEYWORD_PROVIDER_ORDER.map((provider) => (
                  <TableHead key={provider} className="text-center text-xs">
                    {PROVIDER_LABELS[provider]}
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
                  {KEYWORD_PROVIDER_ORDER.map((provider) => (
                    <TableCell key={provider} className="text-center">
                      {row.providers[provider] === true ? (
                        <Check className="mx-auto h-4 w-4 text-green-600" />
                      ) : row.providers[provider] === false ? (
                        <X className="mx-auto h-4 w-4 text-red-400" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
  );
}

export function AIVisibilityGapsSection({
  gaps,
  trackingGaps,
  onTrackGapsAsKeywords,
}: {
  gaps: VisibilityGap[] | undefined;
  trackingGaps: boolean;
  onTrackGapsAsKeywords: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingDown className="h-4 w-4 text-amber-500" />
          Visibility Gaps
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!gaps || gaps.length === 0 ? (
          <StateMessage
            variant="empty"
            compact
            title="No gaps detected"
            description="You are being mentioned in the same spaces as competitors."
          />
        ) : (
          <div className="space-y-3">
            {gaps.slice(0, 8).map((gap) => (
              <div
                key={gap.query}
                className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20"
              >
                <p className="text-sm font-medium">{gap.query}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {gap.competitorsCited.map((competitor) => (
                    <Badge
                      key={competitor.domain}
                      variant="secondary"
                      className="text-xs"
                    >
                      {competitor.domain}
                    </Badge>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Competitors cited but you&apos;re not
                </p>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={onTrackGapsAsKeywords}
              disabled={trackingGaps}
            >
              {trackingGaps
                ? "Saving..."
                : `Track ${gaps.length} gap queries as keywords`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AIVisibilityBacklinksAndDiscoverySection({
  blSummary,
  blLoading,
  discovering,
  discoveryResult,
  onDiscover,
}: {
  blSummary: BacklinkSummary | undefined;
  blLoading: boolean;
  discovering: boolean;
  discoveryResult: DiscoveryResult | null;
  onDiscover: () => Promise<void>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BacklinkCard summary={blSummary ?? null} isLoading={blLoading} />

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

          <Button onClick={onDiscover} disabled={discovering} size="sm">
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
                    {discoveryResult.gscKeywords.map((keyword) => (
                      <Badge
                        key={keyword.keyword}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/5"
                      >
                        <TrendingUp className="mr-1 h-3 w-3" />
                        {keyword.keyword}
                        {keyword.impressions && (
                          <span className="ml-1 text-muted-foreground">
                            ({keyword.impressions} imp)
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
                    {discoveryResult.llmKeywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/5"
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {discoveryResult.gscKeywords.length === 0 &&
                discoveryResult.llmKeywords.length === 0 && (
                  <StateMessage
                    variant="empty"
                    compact
                    title="No new keyword suggestions"
                    description="Try connecting GSC for data-driven discovery suggestions."
                  />
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
