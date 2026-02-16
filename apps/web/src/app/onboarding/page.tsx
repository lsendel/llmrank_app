"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-hooks";
import { api, ApiError } from "@/lib/api";
import { Stepper } from "@/components/onboarding/stepper";
import { ScoreCircle } from "@/components/score-circle";
import { isActiveCrawlStatus } from "@/components/crawl-progress";
import type { CrawlStatus } from "@/components/crawl-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, scoreColor } from "@/lib/utils";
import { Loader2, ArrowRight, Globe, RotateCcw } from "lucide-react";

const TIPS = [
  "73% of AI citations come from pages with structured data.",
  "Pages with clear H1-H3 hierarchy rank 2x better in AI responses.",
  "Sites with llms.txt get 40% more AI crawler visits.",
  "Content over 1,500 words is 3x more likely to be cited by AI.",
  "Schema markup helps AI understand your content structure.",
];

interface CrawlData {
  id: string;
  status: CrawlStatus;
  pagesFound: number;
  pagesCrawled: number;
  pagesScored: number;
  overallScore: number | null;
  letterGrade: string | null;
  scores: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  } | null;
  errorMessage: string | null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  // Guard state
  const [guardChecked, setGuardChecked] = useState(false);

  // Step state
  const [step, setStep] = useState(0);

  // Step 0 state
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  // Step 1 state
  const [domain, setDomain] = useState("");
  const [projectName, setProjectName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Step 2 state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [crawlId, setCrawlId] = useState<string | null>(null);
  const [crawl, setCrawl] = useState<CrawlData | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [startingCrawl, setStartingCrawl] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef(3000);

  // Tips rotation
  const [tipIndex, setTipIndex] = useState(0);

  // Guard: redirect if not signed in or already has projects
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    let cancelled = false;
    api.projects
      .list()
      .then((res) => {
        if (cancelled) return;
        if (res.pagination.total > 0) {
          router.push("/dashboard");
        } else {
          setGuardChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) setGuardChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router]);

  // Tips rotation interval
  useEffect(() => {
    if (step !== 2 || !crawl || !isActiveCrawlStatus(crawl.status)) return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [step, crawl]);

  // Start crawl when entering step 2
  const startCrawl = useCallback(async (pid: string) => {
    setCrawlError(null);
    setStartingCrawl(true);
    try {
      const job = await api.crawls.start(pid);
      setCrawlId(job.id);
      setCrawl(job as CrawlData);
      intervalRef.current = 3000;
    } catch (err) {
      if (err instanceof ApiError) {
        setCrawlError(err.message);
      } else {
        setCrawlError("Failed to start scan. Please try again.");
      }
    } finally {
      setStartingCrawl(false);
    }
  }, []);

  // Polling effect
  useEffect(() => {
    if (!crawlId || !crawl) return;
    if (!isActiveCrawlStatus(crawl.status)) return;

    const poll = async () => {
      try {
        const updated = await api.crawls.get(crawlId);
        setCrawl(updated as CrawlData);

        if (isActiveCrawlStatus(updated.status as CrawlStatus)) {
          intervalRef.current = Math.min(intervalRef.current * 1.5, 30000);
          pollingRef.current = setTimeout(poll, intervalRef.current);
        }
      } catch (_err) {
        console.warn("Crawl polling failed, retrying with backoff:", _err);
        intervalRef.current = Math.min(intervalRef.current * 1.5, 30000);
        pollingRef.current = setTimeout(poll, intervalRef.current);
      }
    };

    pollingRef.current = setTimeout(poll, intervalRef.current);

    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [crawlId, crawl?.status]);

  // Auto-start crawl when step becomes 2
  useEffect(() => {
    if (step === 2 && projectId && !crawlId && !startingCrawl) {
      startCrawl(projectId);
    }
  }, [step, projectId, crawlId, startingCrawl, startCrawl]);

  // Loading states
  if (!isLoaded || !guardChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  // Step 0: Welcome + Profile
  const handleContinue = () => {
    setNameError(null);
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setStep(1);
  };

  // Step 1: Add Website
  const handleDomainChange = (value: string) => {
    setDomain(value);
    // Auto-fill project name from hostname
    try {
      let hostname = value.trim();
      if (hostname && !hostname.startsWith("http")) {
        hostname = `https://${hostname}`;
      }
      const url = new URL(hostname);
      setProjectName(url.hostname);
    } catch (err) {
      console.warn("URL parsing failed during domain input:", err);
      if (value.trim()) {
        setProjectName(value.trim());
      }
    }
  };

  const handleStartScan = async () => {
    setStepError(null);

    if (!domain.trim()) {
      setStepError("Domain is required");
      return;
    }
    if (!projectName.trim()) {
      setStepError("Project name is required");
      return;
    }

    setSubmitting(true);
    try {
      // Update profile with name and mark onboarding complete
      await api.account.updateProfile({
        name: name.trim(),
        onboardingComplete: true,
      });

      // Normalize domain
      let normalizedDomain = domain.trim();
      if (
        !normalizedDomain.startsWith("http://") &&
        !normalizedDomain.startsWith("https://")
      ) {
        normalizedDomain = `https://${normalizedDomain}`;
      }

      // Create project
      const project = await api.projects.create({
        name: projectName.trim(),
        domain: normalizedDomain,
      });

      setProjectId(project.id);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError) {
        setStepError(err.message);
      } else {
        setStepError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Retry crawl
  const handleRetry = () => {
    if (!projectId) return;
    setCrawlId(null);
    setCrawl(null);
    setCrawlError(null);
    startCrawl(projectId);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className={cn("w-full", step === 2 ? "max-w-xl" : "max-w-lg")}>
        <CardHeader className="text-center">
          <Stepper currentStep={step} />
          {step === 0 && (
            <>
              <CardTitle className="mt-4 text-2xl font-bold">
                Welcome to LLM Boost
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Let&apos;s get your first AI-readiness score in under 2 minutes.
              </p>
            </>
          )}
          {step === 1 && (
            <CardTitle className="mt-4 text-2xl font-bold">
              What site should we audit?
            </CardTitle>
          )}
          {step === 2 && (
            <CardTitle className="mt-4 text-2xl font-bold">
              {crawl && crawl.status === "complete"
                ? "Your AI-Readiness Score"
                : crawl && crawl.status === "failed"
                  ? "Scan Failed"
                  : "Scanning your site..."}
            </CardTitle>
          )}
        </CardHeader>
        <CardContent>
          {/* Step 0: Welcome + Profile */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleContinue();
                  }}
                />
                {nameError && (
                  <p className="text-sm text-destructive">{nameError}</p>
                )}
              </div>
              <Button className="w-full" onClick={handleContinue}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 1: Add Your Website */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  type="text"
                  placeholder="My Website"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              {stepError && (
                <p className="text-sm text-destructive">{stepError}</p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep(0)}
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleStartScan}
                  disabled={submitting}
                >
                  {submitting ? (
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
          {step === 2 && (
            <div className="space-y-6">
              {/* Starting crawl / dispatch error */}
              {startingCrawl && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Initializing scan...
                  </p>
                </div>
              )}

              {crawlError && !startingCrawl && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <p className="text-sm text-destructive">{crawlError}</p>
                  <Button variant="outline" onClick={handleRetry}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              )}

              {/* Active crawl */}
              {crawl && isActiveCrawlStatus(crawl.status) && !startingCrawl && (
                <div className="flex flex-col items-center gap-6 py-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div className="w-full space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pages found</span>
                      <span className="font-medium">{crawl.pagesFound}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Pages crawled
                      </span>
                      <span className="font-medium">{crawl.pagesCrawled}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Pages scored
                      </span>
                      <span className="font-medium">{crawl.pagesScored}</span>
                    </div>
                  </div>
                  <p className="text-center text-sm italic text-muted-foreground">
                    {TIPS[tipIndex]}
                  </p>
                </div>
              )}

              {/* Complete */}
              {crawl && crawl.status === "complete" && (
                <div className="flex flex-col items-center gap-6 py-4">
                  <ScoreCircle
                    score={crawl.overallScore ?? 0}
                    size={140}
                    label="Overall"
                  />
                  {crawl.letterGrade && (
                    <p className="text-lg font-semibold text-muted-foreground">
                      Grade:{" "}
                      <span
                        className={cn(
                          "text-2xl font-bold",
                          scoreColor(crawl.overallScore ?? 0),
                        )}
                      >
                        {crawl.letterGrade}
                      </span>
                    </p>
                  )}
                  {crawl.scores && (
                    <div className="grid w-full grid-cols-2 gap-4">
                      {(
                        [
                          ["Technical", crawl.scores.technical],
                          ["Content", crawl.scores.content],
                          ["AI Readiness", crawl.scores.aiReadiness],
                          ["Performance", crawl.scores.performance],
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
                    onClick={() => router.push(`/dashboard/crawl/${crawlId}`)}
                  >
                    View Full Report
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Failed */}
              {crawl && crawl.status === "failed" && !startingCrawl && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <p className="text-sm text-destructive">
                    {crawl.errorMessage ?? "Crawl failed"}
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
