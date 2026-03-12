"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Crosshair,
  Loader2,
  MessageSquare,
  Search,
  Tag,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isActiveCrawlStatus } from "@/components/crawl-progress";
import { api } from "@/lib/api";
import { PLAN_LIMITS } from "@llm-boost/shared";
import type { WizardState } from "@/hooks/use-onboarding-wizard";
import { useDiscoveryCompletion } from "@/hooks/use-discovery-completion";
import { useCompetitorSuggestions } from "@/hooks/use-competitor-suggestions";
import { useDiscoverySave } from "@/hooks/use-discovery-save";
import { DiscoveryCard } from "./discovery-card";
import { DiscoveryProgressPills } from "./discovery-progress-pills";
import { DiscoveryLaunchFooter } from "./discovery-launch-footer";
import { GoalsCardContent } from "./goals-card-content";
import { PersonasCardContent } from "./personas-card-content";
import { KeywordsCardContent } from "./keywords-card-content";
import { CompetitorsCardContent } from "./competitors-card-content";
import { ONBOARDING_TIPS } from "../onboarding-page-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscoveryScreenProps {
  state: WizardState;
  onRetry: () => void;
}

type CardId = "goals" | "personas" | "keywords" | "competitors";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiscoveryScreen({ state, onRetry }: DiscoveryScreenProps) {
  const router = useRouter();

  // ---- Local discovery state (not in the wizard reducer) -----------------
  const [businessGoal, setBusinessGoal] = useState<string | null>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<
    Array<{
      label: string;
      role: string;
      custom: boolean;
      jobToBeDone?: string;
    }>
  >([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [openCard, setOpenCard] = useState<CardId | null>("goals");
  const [userPlan, setUserPlan] = useState<string>("free");

  // Fetch user plan on mount
  useEffect(() => {
    api.account
      .getMe()
      .then((me) => setUserPlan(me.plan))
      .catch(() => {});
  }, []);

  const planLimits =
    PLAN_LIMITS[userPlan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
  const isFree = userPlan === "free";
  const crawlComplete = state.crawl?.status === "complete";
  const crawlActive = state.crawl
    ? isActiveCrawlStatus(state.crawl.status)
    : false;

  // ---- Completion tracking -----------------------------------------------
  const completion = useDiscoveryCompletion({
    businessGoal,
    selectedPersonas,
    keywords,
    selectedCompetitors,
    isFree,
    crawlComplete,
  });

  // ---- Competitor suggestions ---------------------------------------------
  const competitorSuggestions = useCompetitorSuggestions(state.projectId);

  // Auto-fetch suggestions when crawl completes
  useEffect(() => {
    if (crawlComplete && state.projectId) {
      competitorSuggestions.fetch(keywords, businessGoal ?? undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crawlComplete, state.projectId]);

  // ---- Save hook ----------------------------------------------------------
  const { saving, error: saveError, save } = useDiscoverySave();

  // ---- Card auto-advance --------------------------------------------------
  useEffect(() => {
    // Auto-open the first active card
    const activeCard = (
      ["goals", "personas", "keywords", "competitors"] as CardId[]
    ).find((id) => completion.cardStatuses[id] === "active");
    if (activeCard && openCard !== activeCard) {
      // Small delay to let animations settle
      const timer = setTimeout(() => setOpenCard(activeCard), 200);
      return () => clearTimeout(timer);
    }
  }, [completion.cardStatuses, openCard]);

  // ---- Handlers -----------------------------------------------------------
  const handleToggleCard = useCallback(
    (id: CardId) => {
      if (completion.cardStatuses[id] === "locked") return;
      setOpenCard((prev) => (prev === id ? null : id));
    },
    [completion.cardStatuses],
  );

  const handleTogglePersona = useCallback(
    (persona: {
      label: string;
      role: string;
      custom: boolean;
      jobToBeDone?: string;
    }) => {
      setSelectedPersonas((prev) => {
        const exists = prev.some(
          (p) => p.label === persona.label && p.role === persona.role,
        );
        if (exists)
          return prev.filter(
            (p) => !(p.label === persona.label && p.role === persona.role),
          );
        return [...prev, persona];
      });
    },
    [],
  );

  const handleAddCustomPersona = useCallback(
    (persona: { label: string; role: string }) => {
      setSelectedPersonas((prev) => [
        ...prev,
        {
          ...persona,
          custom: true,
          jobToBeDone: `${persona.role} — evaluating solutions`,
        },
      ]);
    },
    [],
  );

  const handleToggleCompetitor = useCallback((domain: string) => {
    setSelectedCompetitors((prev) =>
      prev.includes(domain)
        ? prev.filter((d) => d !== domain)
        : [...prev, domain],
    );
  }, []);

  const handleAddManualCompetitor = useCallback((domain: string) => {
    setSelectedCompetitors((prev) =>
      prev.includes(domain) ? prev : [...prev, domain],
    );
  }, []);

  const handleLaunch = useCallback(async () => {
    if (!state.projectId) return;

    await save({
      projectId: state.projectId,
      businessGoal,
      personas: selectedPersonas,
      keywords,
      competitors: selectedCompetitors,
    });

    // Navigate to dashboard regardless of partial failures
    router.push(`/dashboard/projects/${state.projectId}`);
  }, [
    state.projectId,
    businessGoal,
    selectedPersonas,
    keywords,
    selectedCompetitors,
    save,
    router,
  ]);

  // ---- Goal summary text --------------------------------------------------
  const goalSummary = useMemo(() => {
    const labels: Record<string, string> = {
      ai_mentions: "Get mentioned in AI responses",
      lead_gen: "Generate leads from AI search",
      outrank: "Outrank competitors in AI",
      brand_understanding: "Understand AI brand perception",
    };
    return businessGoal ? (labels[businessGoal] ?? businessGoal) : undefined;
  }, [businessGoal]);

  // ---- Pill data ----------------------------------------------------------
  const pills = [
    { id: "goals", label: "Goals", status: completion.cardStatuses.goals },
    {
      id: "personas",
      label: "Personas",
      status: completion.cardStatuses.personas,
    },
    {
      id: "keywords",
      label: "Keywords",
      status: completion.cardStatuses.keywords,
    },
    {
      id: "competitors",
      label: "Competitors",
      status: completion.cardStatuses.competitors,
    },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      {/* Crawl progress banner */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {crawlActive && (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              <span className="text-sm">
                Crawling {state.domain || "your site"} &mdash;{" "}
                {state.crawl?.pagesCrawled ?? 0} of ~
                {state.crawl?.pagesFound ?? "?"} pages
              </span>
              <div className="ml-auto h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{
                    width: `${state.crawl?.pagesFound ? Math.min(100, ((state.crawl.pagesCrawled ?? 0) / state.crawl.pagesFound) * 100) : 0}%`,
                  }}
                />
              </div>
            </>
          )}
          {crawlComplete && state.crawl?.overallScore != null && (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              <span className="text-sm font-medium">
                Crawl complete &mdash; Score: {state.crawl.overallScore} /{" "}
                {state.crawl.letterGrade}
              </span>
            </>
          )}
          {state.crawl?.status === "failed" && (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-sm text-destructive">
                Crawl failed
                {state.crawl.errorMessage
                  ? `: ${state.crawl.errorMessage}`
                  : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={onRetry}
              >
                Retry
              </Button>
            </>
          )}
          {!state.crawl && state.startingCrawl && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Starting crawl...
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold">Set up your domain strategy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us about your goals while we finish scanning. Everything is
            optional &mdash; you can always update later.
          </p>
        </div>

        {/* Progress pills */}
        <DiscoveryProgressPills cards={pills as any} />

        {/* Discovery cards */}
        <div className="mt-6 space-y-3">
          <div id="card-goals">
            <DiscoveryCard
              id="goals"
              title="Business Goals"
              icon={<Crosshair className="h-4 w-4" />}
              status={completion.cardStatuses.goals as any}
              summary={goalSummary}
              isOpen={openCard === "goals"}
              onToggle={() => handleToggleCard("goals")}
            >
              <GoalsCardContent
                selected={businessGoal}
                onSelect={setBusinessGoal}
              />
            </DiscoveryCard>
          </div>

          <div id="card-personas">
            <DiscoveryCard
              id="personas"
              title="Target Personas"
              icon={<Users className="h-4 w-4" />}
              status={completion.cardStatuses.personas as any}
              summary={
                selectedPersonas.length > 0
                  ? `${selectedPersonas.length} persona${selectedPersonas.length > 1 ? "s" : ""} selected`
                  : undefined
              }
              isOpen={openCard === "personas"}
              onToggle={() => handleToggleCard("personas")}
            >
              <PersonasCardContent
                workStyle={state.workStyle}
                selectedPersonas={selectedPersonas}
                onToggle={handleTogglePersona}
                onAddCustom={handleAddCustomPersona}
              />
            </DiscoveryCard>
          </div>

          <div id="card-keywords">
            <DiscoveryCard
              id="keywords"
              title="Target Keywords"
              icon={<Tag className="h-4 w-4" />}
              status={completion.cardStatuses.keywords as any}
              summary={
                keywords.length > 0
                  ? `${keywords.length} keyword${keywords.length > 1 ? "s" : ""}`
                  : undefined
              }
              isOpen={openCard === "keywords"}
              onToggle={() => handleToggleCard("keywords")}
            >
              <KeywordsCardContent
                keywords={keywords}
                onAdd={(kw) =>
                  setKeywords((prev) =>
                    prev.includes(kw) ? prev : [...prev, kw],
                  )
                }
                onRemove={(kw) =>
                  setKeywords((prev) => prev.filter((k) => k !== kw))
                }
              />
            </DiscoveryCard>
          </div>

          <div id="card-competitors">
            <DiscoveryCard
              id="competitors"
              title="Competitors"
              icon={<Search className="h-4 w-4" />}
              status={completion.cardStatuses.competitors as any}
              summary={
                selectedCompetitors.length > 0
                  ? `${selectedCompetitors.length} competitor${selectedCompetitors.length > 1 ? "s" : ""}`
                  : undefined
              }
              lockedReason="Waiting for crawl data to generate suggestions..."
              isOpen={openCard === "competitors"}
              onToggle={() => handleToggleCard("competitors")}
            >
              <CompetitorsCardContent
                suggestions={competitorSuggestions.suggestions}
                suggestionsLoading={competitorSuggestions.loading}
                suggestionsError={competitorSuggestions.error}
                selected={selectedCompetitors}
                onToggle={handleToggleCompetitor}
                onAddManual={handleAddManualCompetitor}
                planLimit={planLimits.competitorsPerProject}
                isFree={isFree}
                onRetry={() =>
                  competitorSuggestions.retry(
                    keywords,
                    businessGoal ?? undefined,
                  )
                }
              />
            </DiscoveryCard>
          </div>
        </div>

        {saveError && (
          <p className="mt-4 text-center text-sm text-destructive">
            {saveError}
          </p>
        )}

        {/* Crawl tip while scanning */}
        {crawlActive && (
          <div className="mt-6 rounded-lg border bg-muted/30 p-3 text-center text-sm text-muted-foreground">
            <MessageSquare className="mr-1 inline h-3.5 w-3.5" />
            {ONBOARDING_TIPS[state.tipIndex % ONBOARDING_TIPS.length]}
          </div>
        )}
      </div>

      {/* Footer */}
      <DiscoveryLaunchFooter
        completedCount={completion.completedCount}
        totalCards={completion.totalCards}
        saving={saving}
        onLaunch={handleLaunch}
      />
    </div>
  );
}
