"use client";

import type { ReactNode } from "react";
import {
  Brain,
  CheckCircle2,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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
}

export function SemanticGapMatrix({
  userFacts,
  competitorFacts,
  competitorDomain,
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
}: {
  title: string;
  description: string;
  icon: ReactNode;
  facts: ExtractedFact[];
  highlightMissing?: (fact: ExtractedFact) => boolean;
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
                “{fact.sourceSentence}”
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
