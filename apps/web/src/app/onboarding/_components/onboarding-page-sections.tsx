"use client";

import type { Dispatch, KeyboardEvent } from "react";
import { Stepper } from "@/components/onboarding/stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Action, WizardState } from "@/hooks/use-onboarding-wizard";
import { cn } from "@/lib/utils";
import { ArrowRight, Code, Globe, Loader2, Users } from "lucide-react";
import {
  ONBOARDING_CRAWL_SCHEDULE_OPTIONS,
  ONBOARDING_TEAM_SIZE_OPTIONS,
  ONBOARDING_WORK_STYLE_OPTIONS,
  getOnboardingStepTitle,
} from "../onboarding-page-helpers";
import { DiscoveryScreen } from "./discovery-screen";

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

export function OnboardingWizardCard(props: OnboardingWizardCardProps) {
  const { state } = props;

  // Step 2 (Discovery) uses its own full-page layout — no Card wrapper
  if (state.step === 2) {
    return <DiscoveryScreen state={state} onRetry={props.onRetry} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-lg">
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
        </CardContent>
      </Card>
    </div>
  );
}
