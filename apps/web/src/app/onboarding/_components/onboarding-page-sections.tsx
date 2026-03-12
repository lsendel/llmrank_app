"use client";

import type { Dispatch, KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { isActiveCrawlStatus } from "@/components/crawl-progress";
import { Stepper } from "@/components/onboarding/stepper";
import { ScoreCircle } from "@/components/score-circle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Action, WizardState } from "@/hooks/use-onboarding-wizard";
import { cn, scoreColor } from "@/lib/utils";
import {
  ArrowRight,
  Code,
  Globe,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import {
  ONBOARDING_CRAWL_SCHEDULE_OPTIONS,
  ONBOARDING_SCORE_BREAKDOWN_LABELS,
  ONBOARDING_TEAM_SIZE_OPTIONS,
  ONBOARDING_TIPS,
  ONBOARDING_WORK_STYLE_OPTIONS,
  getOnboardingStepTitle,
} from "../onboarding-page-helpers";

const WORK_STYLE_ICONS = {
  client_reporting: Users,
  own_site_optimization: Globe,
  technical_audit: Code,
} as const;

interface OnboardingWizardCardProps {
  state: WizardState;
  dispatch: Dispatch<Action>;
  onContinue: () => void;
  onDomainChange: (value: string) => void;
  onStartScan: () => void;
  onRetry: () => void;
  onViewReport: () => void;
  onOpenStrategy: () => void;
  onOpenIntegrations: () => void;
}

export function OnboardingLoadingState() {
  return (
    <div
      aria-label="Loading onboarding"
      className="flex min-h-screen items-center justify-center bg-secondary p-4"
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function OnboardingHeader({ state }: Pick<OnboardingWizardCardProps, "state">) {
  return (
    <CardHeader className="text-center">
      <Stepper currentStep={state.step} />
      {state.step === 0 && (
        <>
          <CardTitle className="mt-4 text-2xl font-bold">
            Welcome to LLM Rank
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Let&apos;s get your first AI-readiness score in under 2 minutes.
          </p>
        </>
      )}
      {state.step === 1 && (
        <CardTitle className="mt-4 text-2xl font-bold">
          What site should we audit?
        </CardTitle>
      )}
      {state.step === 2 && (
        <CardTitle className="mt-4 text-2xl font-bold">
          {getOnboardingStepTitle(state.crawl)}
        </CardTitle>
      )}
    </CardHeader>
  );
}

function ProfileStepSection({
  state,
  dispatch,
  onContinue,
}: Pick<OnboardingWizardCardProps, "state" | "dispatch" | "onContinue">) {
  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onContinue();
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Your Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="John Doe"
          value={state.name}
          onChange={(event) =>
            dispatch({ type: "SET_NAME", name: event.target.value })
          }
          onKeyDown={handleNameKeyDown}
        />
        {state.nameError && (
          <p className="text-sm text-destructive">{state.nameError}</p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Optional — helps us customize your dashboard
        </p>
        <div className="space-y-2">
          <Label>How do you work?</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ONBOARDING_WORK_STYLE_OPTIONS.map((option) => {
              const Icon = WORK_STYLE_ICONS[option.value];

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    dispatch({
                      type: "SET_WORK_STYLE",
                      workStyle: option.value,
                    });
                    if (option.value !== "client_reporting") {
                      dispatch({ type: "SET_TEAM_SIZE", teamSize: null });
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors hover:border-primary/60",
                    state.workStyle === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {state.workStyle === "client_reporting" && (
          <div className="space-y-2">
            <Label>Team size?</Label>
            <div className="grid grid-cols-3 gap-2">
              {ONBOARDING_TEAM_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    dispatch({ type: "SET_TEAM_SIZE", teamSize: option.value })
                  }
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/60",
                    state.teamSize === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button className="w-full" onClick={onContinue}>
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function WebsiteStepSection({
  state,
  dispatch,
  onDomainChange,
  onStartScan,
}: Pick<
  OnboardingWizardCardProps,
  "state" | "dispatch" | "onDomainChange" | "onStartScan"
>) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="domain">Domain</Label>
        <Input
          id="domain"
          type="text"
          placeholder="example.com"
          value={state.domain}
          onChange={(event) => onDomainChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectName">Project Name</Label>
        <Input
          id="projectName"
          type="text"
          placeholder="My Website"
          value={state.projectName}
          onChange={(event) =>
            dispatch({
              type: "SET_PROJECT_NAME",
              projectName: event.target.value,
            })
          }
        />
      </div>
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="space-y-2">
          <Label htmlFor="siteDescription">
            What does your site do?{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="siteDescription"
            placeholder="B2B analytics platform for healthcare teams"
            value={state.siteDescription}
            onChange={(event) =>
              dispatch({
                type: "SET_SITE_DESCRIPTION",
                siteDescription: event.target.value,
              })
            }
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry">
            Industry <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="industry"
            type="text"
            placeholder="Healthcare SaaS"
            value={state.industry}
            onChange={(event) =>
              dispatch({
                type: "SET_INDUSTRY",
                industry: event.target.value,
              })
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          We use this context to improve the first-pass personas, keyword
          suggestions, and competitor discovery for your domain.
        </p>
      </div>
      {state.stepError && (
        <p className="text-sm text-destructive">{state.stepError}</p>
      )}
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <p className="text-sm font-medium">Confirm default setup</p>
        <p className="text-xs text-muted-foreground">
          Choose what should be enabled before your first crawl starts.
        </p>
        <div className="space-y-2">
          <Label className="text-xs">Crawl cadence</Label>
          <div className="grid grid-cols-2 gap-2">
            {ONBOARDING_CRAWL_SCHEDULE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "SET_DEFAULT_CRAWL_SCHEDULE",
                    schedule: option.value,
                  })
                }
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/60",
                  state.defaultCrawlSchedule === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={state.defaultAutoRunOnCrawl}
            onCheckedChange={(checked) =>
              dispatch({
                type: "SET_DEFAULT_AUTO_RUN_ON_CRAWL",
                enabled: checked === true,
              })
            }
          />
          <span>Enable post-crawl automation pipeline</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={state.defaultVisibilityScheduleEnabled}
            onCheckedChange={(checked) =>
              dispatch({
                type: "SET_DEFAULT_VISIBILITY_SCHEDULE_ENABLED",
                enabled: checked === true,
              })
            }
          />
          <span>Create weekly visibility monitoring schedule</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={state.defaultWeeklyDigestEnabled}
            onCheckedChange={(checked) =>
              dispatch({
                type: "SET_DEFAULT_WEEKLY_DIGEST_ENABLED",
                enabled: checked === true,
              })
            }
          />
          <span>Enable weekly digest if currently off</span>
        </label>
      </div>
      <div className="flex gap-3">
        <Button
          variant="ghost"
          onClick={() => dispatch({ type: "SET_STEP", step: 0 })}
          disabled={state.submitting}
        >
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={onStartScan}
          disabled={state.submitting}
        >
          {state.submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Start Scan
              <Globe className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function DiscoveryPreviewSection({
  state,
  onOpenStrategy,
  onOpenIntegrations,
}: Pick<
  OnboardingWizardCardProps,
  "state" | "onOpenStrategy" | "onOpenIntegrations"
>) {
  if (state.discoveryStatus === "loading") {
    return (
      <div className="w-full rounded-xl border border-dashed bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-primary" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Building your domain strategy</p>
            <p className="text-sm text-muted-foreground">
              Identifying likely personas, starter queries, and competitors for
              your market.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.discoveryStatus === "failed") {
    return (
      <div className="w-full rounded-xl border border-dashed bg-muted/20 p-4">
        <p className="text-sm font-medium">
          Strategy setup needs a manual pass
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.discoveryError ??
            "We could not finish the audience and competitor setup automatically."}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button className="sm:flex-1" onClick={onOpenStrategy}>
            Review Strategy Workspace
          </Button>
          <Button
            variant="outline"
            className="sm:flex-1"
            onClick={onOpenIntegrations}
          >
            Review Google Integrations
          </Button>
        </div>
      </div>
    );
  }

  if (state.discoveryStatus !== "ready" || !state.discoveryResult) {
    return null;
  }

  const topPersonas = state.discoveryResult.personas.slice(0, 3);
  const topKeywords = state.discoveryResult.keywords.slice(0, 8);
  const topCompetitors = state.discoveryResult.competitors.slice(0, 6);

  return (
    <div className="w-full space-y-4 rounded-xl border bg-muted/10 p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Domain strategy suggestions</p>
        <p className="text-sm text-muted-foreground">
          First-pass personas, search demand, and competitor signals are ready
          for review.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-background p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-primary" />
            Personas
          </div>
          <div className="space-y-2">
            {topPersonas.length > 0 ? (
              topPersonas.map((persona) => (
                <div
                  key={`${persona.name}-${persona.role}`}
                  className="space-y-1"
                >
                  <p className="text-sm font-medium leading-tight">
                    {persona.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {persona.role}
                  </p>
                  {persona.sampleQueries[0] && (
                    <p className="text-xs text-muted-foreground">
                      &ldquo;{persona.sampleQueries[0]}&rdquo;
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No personas were suggested yet.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-background p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Starter Queries
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topKeywords.length > 0 ? (
              topKeywords.map((keyword) => (
                <Badge key={keyword.keyword} variant="outline">
                  {keyword.keyword}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No starter queries were suggested yet.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-background p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4 text-primary" />
            Competitors
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topCompetitors.length > 0 ? (
              topCompetitors.map((domain) => (
                <Badge key={domain} variant="secondary">
                  {domain}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No competitors were identified yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="sm:flex-1" onClick={onOpenStrategy}>
          Review Strategy Workspace
        </Button>
        <Button
          variant="outline"
          className="sm:flex-1"
          onClick={onOpenIntegrations}
        >
          Review Google Integrations
        </Button>
      </div>
    </div>
  );
}

function CrawlProgressSection({
  state,
  onRetry,
  onViewReport,
  onOpenStrategy,
  onOpenIntegrations,
}: Pick<
  OnboardingWizardCardProps,
  "state" | "onRetry" | "onViewReport" | "onOpenStrategy" | "onOpenIntegrations"
>) {
  const crawlScores = state.crawl?.scores;

  return (
    <div className="space-y-6">
      {state.startingCrawl && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Initializing scan...</p>
        </div>
      )}

      {state.crawlError && !state.startingCrawl && (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-destructive">{state.crawlError}</p>
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      )}

      {state.crawl &&
        isActiveCrawlStatus(state.crawl.status) &&
        !state.startingCrawl && (
          <div className="flex flex-col items-center gap-6 py-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="w-full space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pages found</span>
                <span className="font-medium">{state.crawl.pagesFound}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pages crawled</span>
                <span className="font-medium">{state.crawl.pagesCrawled}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pages scored</span>
                <span className="font-medium">{state.crawl.pagesScored}</span>
              </div>
            </div>
            <p className="text-center text-sm italic text-muted-foreground">
              {ONBOARDING_TIPS[state.tipIndex]}
            </p>
          </div>
        )}

      {state.crawl?.status === "complete" && (
        <div className="flex flex-col items-center gap-6 py-4">
          <ScoreCircle
            score={state.crawl.overallScore ?? 0}
            size={140}
            label="Overall"
          />
          {state.crawl.letterGrade && (
            <p className="text-lg font-semibold text-muted-foreground">
              Grade:{" "}
              <span
                className={cn(
                  "text-2xl font-bold",
                  scoreColor(state.crawl.overallScore ?? 0),
                )}
              >
                {state.crawl.letterGrade}
              </span>
            </p>
          )}
          {crawlScores && (
            <div className="grid w-full grid-cols-2 gap-4">
              {ONBOARDING_SCORE_BREAKDOWN_LABELS.map(({ key, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center rounded-lg border p-3"
                >
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span
                    className={cn(
                      "text-2xl font-bold",
                      scoreColor(crawlScores[key]),
                    )}
                  >
                    {crawlScores[key]}
                  </span>
                </div>
              ))}
            </div>
          )}
          <DiscoveryPreviewSection
            state={state}
            onOpenStrategy={onOpenStrategy}
            onOpenIntegrations={onOpenIntegrations}
          />
          <Button className="w-full" onClick={onViewReport}>
            View Full Report
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {state.crawl?.status === "failed" && !state.startingCrawl && (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-destructive">
            {state.crawl.errorMessage ?? "Crawl failed"}
          </p>
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

export function OnboardingWizardCard(props: OnboardingWizardCardProps) {
  const { state } = props;

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card
        className={cn("w-full", state.step === 2 ? "max-w-3xl" : "max-w-lg")}
      >
        <OnboardingHeader state={state} />
        <CardContent>
          {state.step === 0 && (
            <ProfileStepSection
              state={state}
              dispatch={props.dispatch}
              onContinue={props.onContinue}
            />
          )}
          {state.step === 1 && (
            <WebsiteStepSection
              state={state}
              dispatch={props.dispatch}
              onDomainChange={props.onDomainChange}
              onStartScan={props.onStartScan}
            />
          )}
          {state.step === 2 && (
            <CrawlProgressSection
              state={state}
              onRetry={props.onRetry}
              onViewReport={props.onViewReport}
              onOpenStrategy={props.onOpenStrategy}
              onOpenIntegrations={props.onOpenIntegrations}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
