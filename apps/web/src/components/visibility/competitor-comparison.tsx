"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, BrainCircuit, Target } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/use-api";
import {
  api,
  type VisibilityCheck,
  type GapAnalysisResult,
  type SemanticGapResponse,
} from "@/lib/api";
import { SemanticGapMatrix } from "./semantic-gap-matrix";

interface CompetitorComparisonProps {
  projectId: string;
  results: VisibilityCheck[];
  competitorDomains: string[];
}

type SemanticAnalysis = SemanticGapResponse & { competitor: string };

export function CompetitorComparison({
  projectId,
  results,
  competitorDomains,
}: CompetitorComparisonProps) {
  const { withToken } = useApi();
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [gapData, setGapData] = useState<Record<string, GapAnalysisResult>>({});
  const [semanticData, setSemanticData] = useState<SemanticAnalysis | null>(
    null,
  );
  const [analyzingSemantic, setAnalyzingSemantic] = useState<string | null>(
    null,
  );

  async function handleAnalyzeSemantic(competitor: string) {
    setAnalyzingSemantic(competitor);
    const firstResult = results[0] as
      | (VisibilityCheck & { pageId?: string })
      | undefined;
    const targetPageId = firstResult?.pageId ?? "";
    if (!targetPageId) {
      setAnalyzingSemantic(null);
      return;
    }

    try {
      const res = await withToken((token) =>
        api.strategy.semanticGap(token, {
          projectId,
          competitorDomain: competitor,
          pageId: targetPageId,
        }),
      );
      setSemanticData({ ...res, competitor });
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzingSemantic(null);
    }
  }

  // Group by query
  const queryMap = results.reduce<Record<string, VisibilityCheck[]>>(
    (acc, r) => {
      acc[r.query] = acc[r.query] || [];
      acc[r.query].push(r);
      return acc;
    },
    {},
  );

  async function handleAnalyzeGap(query: string, competitor: string) {
    const key = `${query}-${competitor}`;
    setAnalyzing(key);
    try {
      const res = await withToken((token) =>
        api.strategy.gapAnalysis(token, {
          projectId,
          competitorDomain: competitor,
          query,
        }),
      );
      setGapData((prev) => ({ ...prev, [key]: res }));
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Competitor Comparison Matrix
          </CardTitle>
          <CardDescription>
            Comparing citation status across providers for your tracked domains.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 text-left font-medium">Search Query</th>
                  <th className="py-3 text-center font-medium">Your Site</th>
                  {competitorDomains.map((d) => (
                    <th
                      key={d}
                      className="py-3 text-center font-medium truncate max-w-[120px]"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="truncate w-full">{d}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[9px] text-muted-foreground hover:text-primary"
                          disabled={!!analyzingSemantic}
                          onClick={() => handleAnalyzeSemantic(d)}
                        >
                          {analyzingSemantic === d ? "..." : "Fact Check"}
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(queryMap).map(([query, providerResults]) => {
                  // Heuristic: Cited if any provider cited it
                  const isUserCited = providerResults.some((r) => r.urlCited);

                  return (
                    <tr
                      key={query}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="py-4 font-medium">{query}</td>
                      <td className="py-4 text-center">
                        {isUserCited ? (
                          <CheckCircle2 className="mx-auto h-5 w-5 text-success" />
                        ) : (
                          <XCircle className="mx-auto h-5 w-5 text-muted-foreground/30" />
                        )}
                      </td>
                      {competitorDomains.map((domain) => {
                        const isCompCited = providerResults.some((r) =>
                          r.competitorMentions?.some(
                            (cm) =>
                              cm.domain === domain &&
                              (cm.mentioned || cm.position !== null),
                          ),
                        );
                        const key = `${query}-${domain}`;
                        const hasGapData = gapData[key];

                        return (
                          <td key={domain} className="py-4 text-center">
                            <div className="flex flex-col items-center gap-2">
                              {isCompCited ? (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              ) : (
                                <XCircle className="h-5 w-5 text-muted-foreground/30" />
                              )}

                              {isCompCited && !isUserCited && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] text-primary"
                                  disabled={analyzing === key}
                                  onClick={() =>
                                    handleAnalyzeGap(query, domain)
                                  }
                                >
                                  {analyzing === key ? "..." : "Why them?"}
                                </Button>
                              )}
                            </div>

                            {hasGapData && (
                              <div className="mt-2 text-left bg-primary/5 p-3 rounded-md border border-primary/10 max-w-[250px] mx-auto">
                                <div className="flex items-center gap-1.5 mb-1 text-primary">
                                  <BrainCircuit className="h-3 w-3" />
                                  <span className="text-[10px] font-bold uppercase">
                                    AI Strategy
                                  </span>
                                </div>
                                <p className="text-[11px] leading-tight mb-2">
                                  {hasGapData.recommendation}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {hasGapData.missingElements.map((el) => (
                                    <Badge
                                      key={el}
                                      variant="outline"
                                      className="text-[9px] py-0"
                                    >
                                      {el}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {semanticData && (
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Information Gap Analysis: {semanticData.competitor}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSemanticData(null)}
            >
              Close
            </Button>
          </div>
          <SemanticGapMatrix
            userFacts={semanticData.userFacts}
            competitorFacts={semanticData.competitorFacts}
            competitorDomain={semanticData.competitor}
          />
        </div>
      )}
    </div>
  );
}
