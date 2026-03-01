"use client";

import { Stepper } from "@/components/onboarding/stepper";
import { ScoreCircle } from "@/components/score-circle";
import { isActiveCrawlStatus } from "@/components/crawl-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, scoreColor } from "@/lib/utils";
import {
  Loader2,
  ArrowRight,
  Globe,
  RotateCcw,
  Users,
  Code,
} from "lucide-react";
import { useOnboardingWizard } from "@/hooks/use-onboarding-wizard";

const TIPS = [
  "73% of AI citations come from pages with structured data.",
  "Pages with clear H1-H3 hierarchy rank 2x better in AI responses.",
  "Sites with llms.txt get 40% more AI crawler visits.",
  "Content over 1,500 words is 3x more likely to be cited by AI.",
  "Schema markup helps AI understand your content structure.",
];

export default function OnboardingPage() {
  const {
    state,
    dispatch,
    isLoaded,
    isSignedIn,
    handleContinue,
    handleDomainChange,
    handleStartScan,
    handleRetry,
    router,
  } = useOnboardingWizard(TIPS.length);

  // Loading states
  if (!isLoaded || !state.guardChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card
        className={cn("w-full", state.step === 2 ? "max-w-xl" : "max-w-lg")}
      >
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
              {state.crawl && state.crawl.status === "complete"
                ? "Your AI-Readiness Score"
                : state.crawl && state.crawl.status === "failed"
                  ? "Scan Failed"
                  : "Scanning your site..."}
            </CardTitle>
          )}
        </CardHeader>
        <CardContent>
          {/* Step 0: Welcome + Profile */}
          {state.step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={state.name}
                  onChange={(e) =>
                    dispatch({ type: "SET_NAME", name: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleContinue();
                  }}
                />
                {state.nameError && (
                  <p className="text-sm text-destructive">{state.nameError}</p>
                )}
              </div>

              {/* Persona questions (optional) */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Optional — helps us customize your dashboard
                </p>

                {/* Q1: Work style */}
                <div className="space-y-2">
                  <Label>How do you work?</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          value: "client_reporting",
                          label: "Manage client sites",
                          Icon: Users,
                        },
                        {
                          value: "own_site_optimization",
                          label: "Optimize my site",
                          Icon: Globe,
                        },
                        {
                          value: "technical_audit",
                          label: "Technical audits",
                          Icon: Code,
                        },
                      ] as const
                    ).map((option) => (
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
                        <option.Icon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Q2: Team size (only for client_reporting) */}
                {state.workStyle === "client_reporting" && (
                  <div className="space-y-2">
                    <Label>Team size?</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { value: "solo", label: "Just me" },
                          { value: "small_team", label: "2-10" },
                          { value: "large_team", label: "10+" },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            dispatch({
                              type: "SET_TEAM_SIZE",
                              teamSize: option.value,
                            })
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

              <Button className="w-full" onClick={handleContinue}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 1: Add Your Website */}
          {state.step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="example.com"
                  value={state.domain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  type="text"
                  placeholder="My Website"
                  value={state.projectName}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_PROJECT_NAME",
                      projectName: e.target.value,
                    })
                  }
                />
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
                    {(
                      [
                        { value: "weekly", label: "Weekly (recommended)" },
                        { value: "manual", label: "Manual" },
                      ] as const
                    ).map((option) => (
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
                  onClick={handleStartScan}
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
          )}

          {/* Step 2: Crawl Progress */}
          {state.step === 2 && (
            <div className="space-y-6">
              {/* Starting crawl / dispatch error */}
              {state.startingCrawl && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Initializing scan...
                  </p>
                </div>
              )}

              {state.crawlError && !state.startingCrawl && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <p className="text-sm text-destructive">{state.crawlError}</p>
                  <Button variant="outline" onClick={handleRetry}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              )}

              {/* Active crawl */}
              {state.crawl &&
                isActiveCrawlStatus(state.crawl.status) &&
                !state.startingCrawl && (
                  <div className="flex flex-col items-center gap-6 py-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <div className="w-full space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Pages found
                        </span>
                        <span className="font-medium">
                          {state.crawl.pagesFound}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Pages crawled
                        </span>
                        <span className="font-medium">
                          {state.crawl.pagesCrawled}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Pages scored
                        </span>
                        <span className="font-medium">
                          {state.crawl.pagesScored}
                        </span>
                      </div>
                    </div>
                    <p className="text-center text-sm italic text-muted-foreground">
                      {TIPS[state.tipIndex]}
                    </p>
                  </div>
                )}

              {/* Complete */}
              {state.crawl && state.crawl.status === "complete" && (
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
                  {state.crawl.scores && (
                    <div className="grid w-full grid-cols-2 gap-4">
                      {(
                        [
                          ["Technical", state.crawl.scores.technical],
                          ["Content", state.crawl.scores.content],
                          ["AI Readiness", state.crawl.scores.aiReadiness],
                          ["Performance", state.crawl.scores.performance],
                        ] as const
                      ).map(([label, score]) => (
                        <div
                          key={label}
                          className="flex flex-col items-center rounded-lg border p-3"
                        >
                          <span className="text-xs text-muted-foreground">
                            {label}
                          </span>
                          <span
                            className={cn(
                              "text-2xl font-bold",
                              scoreColor(score),
                            )}
                          >
                            {score}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() =>
                      router.push(`/dashboard/crawl/${state.crawlId}`)
                    }
                  >
                    View Full Report
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Failed */}
              {state.crawl &&
                state.crawl.status === "failed" &&
                !state.startingCrawl && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <p className="text-sm text-destructive">
                      {state.crawl.errorMessage ?? "Crawl failed"}
                    </p>
                    <Button variant="outline" onClick={handleRetry}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
