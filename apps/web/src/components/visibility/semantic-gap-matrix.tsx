"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Brain,
  CheckCircle2,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ExtractedFact } from "@/lib/api";

interface SemanticGapMatrixProps {
  userFacts: ExtractedFact[];
  competitorFacts: ExtractedFact[];
  competitorDomain: string;
  pageId?: string;
}

export function SemanticGapMatrix({
  userFacts,
  competitorFacts,
  competitorDomain,
  pageId,
}: SemanticGapMatrixProps) {
  const average = (facts: ExtractedFact[]) =>
    Math.round(
      facts.reduce((sum, fact) => sum + fact.citabilityScore, 0) /
        (facts.length || 1),
    );

  const userScore = average(userFacts);
  const competitorScore = average(competitorFacts);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-2 border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                Semantic Information Gap
              </h3>
              <p className="text-sm text-muted-foreground">
                Comparing “fact density” and predicted citability.
              </p>
            </div>
          </div>
          <div className="flex gap-8">
            <ScoreStat
              label="Your Citability"
              value={userScore}
              trendIcon={
                userScore < competitorScore ? (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-success" />
                )
              }
            />
            <ScoreStat label="Competitor" value={competitorScore} />
          </div>
        </CardContent>
      </Card>

      <FactList
        title="Your Content Claims"
        description="Structured facts extracted from your page."
        icon={<CheckCircle2 className="h-4 w-4 text-success" />}
        facts={userFacts}
      />

      <FactList
        title={`${competitorDomain} Claims`}
        description="Facts that likely earn the competitor citations."
        icon={<Target className="h-4 w-4 text-primary" />}
        facts={competitorFacts}
        highlightMissing={(fact) =>
          !userFacts.some(
            (uf) =>
              uf.type === fact.type &&
              uf.content
                .toLowerCase()
                .includes(fact.content.toLowerCase().split(" ")[0]),
          )
        }
        pageId={pageId}
      />
    </div>
  );
}

function ScoreStat({
  label,
  value,
  trendIcon,
}: {
  label: string;
  value: number;
  trendIcon?: ReactNode;
}) {
  return (
    <div className="text-center">
      <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center justify-center gap-2">
        <span className="text-2xl font-bold">{value}%</span>
        {trendIcon}
      </div>
    </div>
  );
}

function FactList({
  title,
  description,
  icon,
  facts,
  highlightMissing,
  pageId,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  facts: ExtractedFact[];
  highlightMissing?: (fact: ExtractedFact) => boolean;
  pageId?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {facts.map((fact, index) => {
          const missing = highlightMissing?.(fact) ?? false;
          return (
            <div
              key={`${fact.content}-${index}`}
              className={`rounded-lg border p-3 ${
                missing ? "bg-primary/5 border-primary/30" : "bg-muted/30"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <Badge
                  variant={missing ? "default" : "outline"}
                  className="text-[9px] uppercase"
                >
                  {fact.type}
                </Badge>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {fact.citabilityScore}% cite-rate
                </span>
              </div>
              <p className="text-sm font-medium">{fact.content}</p>
              <p className="mt-1 text-[11px] italic text-muted-foreground">
                &ldquo;{fact.sourceSentence}&rdquo;
              </p>
              {missing && pageId && (
                <ApplyFixButton pageId={pageId} fact={fact} />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ApplyFixButton({
  pageId,
  fact,
}: {
  pageId: string;
  fact: ExtractedFact;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    suggestedSnippet: string;
    placementAdvice: string;
    citabilityBoost: number;
  } | null>(null);

  async function handleApply() {
    setLoading(true);
    try {
      const data = await api.strategy.applyFix({
        pageId,
        missingFact: fact.content,
        factType: fact.type,
      });
      setResult(data);
    } catch (err) {
      console.error("Apply fix failed:", err);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="mt-2 rounded-md bg-green-50 border border-green-200 p-3 space-y-2">
        <p className="text-xs font-semibold text-green-800">
          Suggested Content (+{result.citabilityBoost}pts)
        </p>
        <p className="text-sm text-green-900">{result.suggestedSnippet}</p>
        <p className="text-xs text-green-700 italic">
          {result.placementAdvice}
        </p>
      </div>
    );
  }

  return (
    // Labeled "Draft citable snippet" — NOT "AI Fix". This is a separate feature
    // from the issue-card AI Fix: it drafts an ephemeral content snippet to close
    // a competitor fact gap, and is not saved. Distinct label avoids confusion.
    <button
      onClick={handleApply}
      disabled={loading}
      className="mt-2 text-xs font-medium text-primary hover:underline disabled:opacity-50"
    >
      {loading ? "Drafting snippet..." : "Draft citable snippet →"}
    </button>
  );
}
