import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Info,
  Lightbulb,
  Shield,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  getFactorRecommendation,
  type FactorCheck,
} from "./platform-guide-helpers";

type PlatformGuideHeaderProps = {
  platformIcon: string;
  displayName: string;
  description?: string;
  score?: number;
  grade?: string;
  scoreToneClass?: string | null;
};

type PlatformGuideProgressSummaryProps = {
  passCount: number;
  totalCount: number;
  passRate: number;
  criticalFailsCount: number;
  importantFailsCount: number;
  recommendedFailsCount: number;
  passingCount: number;
};

type PlatformGuideFailureSectionProps = {
  title: string;
  tone: "critical" | "important" | "recommended";
  checks: FactorCheck[];
};

export function PlatformGuideHeader({
  platformIcon,
  displayName,
  description,
  score,
  grade,
  scoreToneClass,
}: PlatformGuideHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span>{platformIcon}</span>
          {displayName} Optimization Guide
        </h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      {typeof score === "number" && grade && (
        <div className="flex shrink-0 flex-col items-end">
          <span className={cn("text-3xl font-bold", scoreToneClass)}>
            {score}
          </span>
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Grade {grade}
          </span>
        </div>
      )}
    </div>
  );
}

export function PlatformGuideProgressSummary({
  passCount,
  totalCount,
  passRate,
  criticalFailsCount,
  importantFailsCount,
  recommendedFailsCount,
  passingCount,
}: PlatformGuideProgressSummaryProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {passCount} of {totalCount} checks passing
          </span>
          <span className="font-medium">{passRate}%</span>
        </div>
        <Progress value={passRate} className="h-2" />
        <div className="mt-4 flex flex-wrap gap-3">
          {criticalFailsCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              {criticalFailsCount} critical
            </Badge>
          )}
          {importantFailsCount > 0 && (
            <Badge
              variant="secondary"
              className="gap-1 border-warning text-warning"
            >
              <AlertTriangle className="h-3 w-3" />
              {importantFailsCount} important
            </Badge>
          )}
          {recommendedFailsCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Info className="h-3 w-3" />
              {recommendedFailsCount} recommended
            </Badge>
          )}
          {passingCount > 0 && (
            <Badge
              variant="secondary"
              className="gap-1 border-success text-success"
            >
              <CheckCircle className="h-3 w-3" />
              {passingCount} passing
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PlatformGuideLoadingCard() {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Loading readiness data...
        </p>
      </CardContent>
    </Card>
  );
}

export function PlatformGuideEmptyStateCard({
  displayName,
  projectId,
}: {
  displayName: string;
  projectId: string;
}) {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Run a crawl to see your {displayName} readiness score and personalized
          recommendations.
        </p>
        <Link
          href={`/dashboard/projects/${projectId}?tab=overview`}
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          Go to project overview
        </Link>
      </CardContent>
    </Card>
  );
}

export function PlatformGuideFailureSection({
  title,
  tone,
  checks,
}: PlatformGuideFailureSectionProps) {
  if (checks.length === 0) {
    return null;
  }

  const toneConfig: Record<
    PlatformGuideFailureSectionProps["tone"],
    { icon: ReactNode; cardClassName?: string; titleClassName?: string }
  > = {
    critical: {
      icon: <XCircle className="h-4 w-4" />,
      cardClassName: "border-destructive/50",
      titleClassName: "text-destructive",
    },
    important: {
      icon: <AlertTriangle className="h-4 w-4" />,
      cardClassName: "border-warning/50",
      titleClassName: "text-warning",
    },
    recommended: {
      icon: <Info className="h-4 w-4 text-muted-foreground" />,
    },
  };

  const config = toneConfig[tone];

  return (
    <Card className={config.cardClassName}>
      <CardHeader>
        <CardTitle
          className={cn(
            "flex items-center gap-2 text-base",
            config.titleClassName,
          )}
        >
          {config.icon}
          {title} ({checks.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checks.map((check) => (
            <FactorDetail key={check.factor} check={check} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function PlatformGuidePassingSection({
  checks,
}: {
  checks: FactorCheck[];
}) {
  if (checks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-success">
          <CheckCircle className="h-4 w-4" />
          Passing Checks ({checks.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {checks.map((check) => (
            <li key={check.factor} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0 text-success" />
              <span>{check.label}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">
                {check.importance}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function PlatformGuideTipsSection({
  displayName,
  tips,
}: {
  displayName: string;
  tips: string[];
}) {
  if (tips.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-primary" />
          {displayName} Tips
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {tips.map((tip, index) => (
            <li key={index} className="flex gap-2 text-sm">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function PlatformGuideDocumentationLink({
  displayName,
  docUrl,
}: {
  displayName: string;
  docUrl?: string;
}) {
  if (!docUrl) {
    return null;
  }

  return (
    <div className="text-center">
      <a
        href={docUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {displayName} Developer Documentation
      </a>
    </div>
  );
}

function FactorDetail({ check }: { check: FactorCheck }) {
  const recommendation = getFactorRecommendation(check.factor);

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{check.label}</h4>
        <Badge
          variant={
            check.importance === "critical" ? "destructive" : "secondary"
          }
          className="text-[10px]"
        >
          {check.importance}
        </Badge>
      </div>
      {recommendation && (
        <>
          <p className="text-xs text-muted-foreground">
            {recommendation.whyItMatters}
          </p>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium">How to fix:</p>
            <p className="text-xs text-muted-foreground">
              {recommendation.howToFix}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
