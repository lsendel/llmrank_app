"use client";

import { useReducer, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-hooks";
import { api, ApiError } from "@/lib/api";
import { track } from "@/lib/telemetry";
import { isActiveCrawlStatus } from "@/components/crawl-progress";
import type { CrawlStatus } from "@/components/crawl-progress";
import { applyProjectWorkspaceDefaults } from "@/lib/project-workspace-defaults";

// ---------------------------------------------------------------------------
// CrawlData (duplicated from page — rendering concern lives in the page,
// but the hook also needs the shape for state management)
// ---------------------------------------------------------------------------

export interface CrawlData {
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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface WizardState {
  guardChecked: boolean;
  step: number;
  // Step 0
  name: string;
  nameError: string | null;
  workStyle: string | null;
  teamSize: string | null;
  // Step 1
  domain: string;
  projectName: string;
  defaultCrawlSchedule: "manual" | "daily" | "weekly" | "monthly";
  defaultAutoRunOnCrawl: boolean;
  defaultVisibilityScheduleEnabled: boolean;
  defaultWeeklyDigestEnabled: boolean;
  submitting: boolean;
  stepError: string | null;
  // Step 2
  projectId: string | null;
  crawlId: string | null;
  crawl: CrawlData | null;
  crawlError: string | null;
  startingCrawl: boolean;
  // Tips
  tipIndex: number;
}

const initialState: WizardState = {
  guardChecked: false,
  step: 0,
  name: "",
  nameError: null,
  workStyle: null,
  teamSize: null,
  domain: "",
  projectName: "",
  defaultCrawlSchedule: "weekly",
  defaultAutoRunOnCrawl: true,
  defaultVisibilityScheduleEnabled: true,
  defaultWeeklyDigestEnabled: true,
  submitting: false,
  stepError: null,
  projectId: null,
  crawlId: null,
  crawl: null,
  crawlError: null,
  startingCrawl: false,
  tipIndex: 0,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Action =
  | { type: "SET_GUARD_CHECKED"; checked: boolean }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_NAME_ERROR"; error: string | null }
  | { type: "SET_WORK_STYLE"; workStyle: string | null }
  | { type: "SET_TEAM_SIZE"; teamSize: string | null }
  | { type: "SET_DOMAIN"; domain: string }
  | { type: "SET_PROJECT_NAME"; projectName: string }
  | {
      type: "SET_DEFAULT_CRAWL_SCHEDULE";
      schedule: "manual" | "daily" | "weekly" | "monthly";
    }
  | { type: "SET_DEFAULT_AUTO_RUN_ON_CRAWL"; enabled: boolean }
  | { type: "SET_DEFAULT_VISIBILITY_SCHEDULE_ENABLED"; enabled: boolean }
  | { type: "SET_DEFAULT_WEEKLY_DIGEST_ENABLED"; enabled: boolean }
  | { type: "SET_SUBMITTING"; submitting: boolean }
  | { type: "SET_STEP_ERROR"; error: string | null }
  | { type: "SET_PROJECT_ID"; projectId: string }
  | { type: "SET_CRAWL_ID"; crawlId: string | null }
  | { type: "SET_CRAWL"; crawl: CrawlData | null }
  | { type: "SET_CRAWL_ERROR"; error: string | null }
  | { type: "SET_STARTING_CRAWL"; starting: boolean }
  | { type: "SET_TIP_INDEX"; index: number }
  | { type: "ADVANCE_TIP"; tipsLength: number }
  | { type: "RESET_CRAWL" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_SUCCESS"; projectId: string }
  | { type: "SUBMIT_FAIL"; error: string }
  | { type: "CRAWL_START" }
  | { type: "CRAWL_DISPATCHED"; crawlId: string; crawl: CrawlData }
  | { type: "CRAWL_DISPATCH_FAIL"; error: string }
  | { type: "CRAWL_DISPATCH_DONE" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_GUARD_CHECKED":
      return { ...state, guardChecked: action.checked };
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_NAME":
      return { ...state, name: action.name };
    case "SET_NAME_ERROR":
      return { ...state, nameError: action.error };
    case "SET_WORK_STYLE":
      return { ...state, workStyle: action.workStyle };
    case "SET_TEAM_SIZE":
      return { ...state, teamSize: action.teamSize };
    case "SET_DOMAIN":
      return { ...state, domain: action.domain };
    case "SET_PROJECT_NAME":
      return { ...state, projectName: action.projectName };
    case "SET_DEFAULT_CRAWL_SCHEDULE":
      return { ...state, defaultCrawlSchedule: action.schedule };
    case "SET_DEFAULT_AUTO_RUN_ON_CRAWL":
      return { ...state, defaultAutoRunOnCrawl: action.enabled };
    case "SET_DEFAULT_VISIBILITY_SCHEDULE_ENABLED":
      return { ...state, defaultVisibilityScheduleEnabled: action.enabled };
    case "SET_DEFAULT_WEEKLY_DIGEST_ENABLED":
      return { ...state, defaultWeeklyDigestEnabled: action.enabled };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.submitting };
    case "SET_STEP_ERROR":
      return { ...state, stepError: action.error };
    case "SET_PROJECT_ID":
      return { ...state, projectId: action.projectId };
    case "SET_CRAWL_ID":
      return { ...state, crawlId: action.crawlId };
    case "SET_CRAWL":
      return { ...state, crawl: action.crawl };
    case "SET_CRAWL_ERROR":
      return { ...state, crawlError: action.error };
    case "SET_STARTING_CRAWL":
      return { ...state, startingCrawl: action.starting };
    case "SET_TIP_INDEX":
      return { ...state, tipIndex: action.index };
    case "ADVANCE_TIP":
      return {
        ...state,
        tipIndex: (state.tipIndex + 1) % action.tipsLength,
      };
    case "RESET_CRAWL":
      return {
        ...state,
        crawlId: null,
        crawl: null,
        crawlError: null,
      };
    case "SUBMIT_START":
      return { ...state, stepError: null, submitting: true };
    case "SUBMIT_SUCCESS":
      return {
        ...state,
        submitting: false,
        projectId: action.projectId,
        step: 2,
      };
    case "SUBMIT_FAIL":
      return { ...state, submitting: false, stepError: action.error };
    case "CRAWL_START":
      return { ...state, crawlError: null, startingCrawl: true };
    case "CRAWL_DISPATCHED":
      return {
        ...state,
        crawlId: action.crawlId,
        crawl: action.crawl,
        startingCrawl: false,
      };
    case "CRAWL_DISPATCH_FAIL":
      return { ...state, crawlError: action.error, startingCrawl: false };
    case "CRAWL_DISPATCH_DONE":
      return { ...state, startingCrawl: false };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOnboardingWizard(tipsLength: number) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef(3000);

  // ---- Guard: redirect if not signed in or already has projects -----------
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
          dispatch({ type: "SET_GUARD_CHECKED", checked: true });
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "SET_GUARD_CHECKED", checked: true });
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router]);

  // ---- Tips rotation ------------------------------------------------------
  useEffect(() => {
    if (
      state.step !== 2 ||
      !state.crawl ||
      !isActiveCrawlStatus(state.crawl.status)
    )
      return;
    const interval = setInterval(() => {
      dispatch({ type: "ADVANCE_TIP", tipsLength });
    }, 5000);
    return () => clearInterval(interval);
  }, [state.step, state.crawl, tipsLength]);

  // ---- Start crawl --------------------------------------------------------
  const startCrawl = useCallback(async (pid: string) => {
    dispatch({ type: "CRAWL_START" });
    try {
      const job = await api.crawls.start(pid);
      dispatch({
        type: "CRAWL_DISPATCHED",
        crawlId: job.id,
        crawl: job as CrawlData,
      });
      intervalRef.current = 3000;
    } catch (err) {
      if (err instanceof ApiError) {
        dispatch({ type: "CRAWL_DISPATCH_FAIL", error: err.message });
      } else {
        dispatch({
          type: "CRAWL_DISPATCH_FAIL",
          error: "Failed to start scan. Please try again.",
        });
      }
    }
  }, []);

  // ---- Polling effect -----------------------------------------------------
  useEffect(() => {
    if (!state.crawlId || !state.crawl) return;
    if (!isActiveCrawlStatus(state.crawl.status)) return;

    const crawlId = state.crawlId;

    const poll = async () => {
      try {
        const updated = await api.crawls.get(crawlId);
        dispatch({ type: "SET_CRAWL", crawl: updated as CrawlData });

        if (isActiveCrawlStatus(updated.status as CrawlStatus)) {
          intervalRef.current = Math.min(intervalRef.current * 1.5, 30000);
          pollingRef.current = setTimeout(poll, intervalRef.current);
        } else if (updated.status === "complete" && state.projectId) {
          // Non-blocking: trigger auto-discovery after crawl completes
          api.discovery.run(state.projectId).catch(() => {});
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
    // We intentionally depend on crawl?.status (not the full crawl object)
    // to avoid restarting the polling loop on every poll update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.crawlId, state.crawl?.status]);

  // ---- Auto-start crawl when step becomes 2 ------------------------------
  useEffect(() => {
    if (
      state.step === 2 &&
      state.projectId &&
      !state.crawlId &&
      !state.startingCrawl
    ) {
      startCrawl(state.projectId);
    }
  }, [
    state.step,
    state.projectId,
    state.crawlId,
    state.startingCrawl,
    startCrawl,
  ]);

  // ---- Handlers -----------------------------------------------------------

  const handleContinue = useCallback(() => {
    dispatch({ type: "SET_NAME_ERROR", error: null });
    if (!state.name.trim()) {
      dispatch({ type: "SET_NAME_ERROR", error: "Name is required" });
      return;
    }
    dispatch({ type: "SET_STEP", step: 1 });
  }, [state.name]);

  const handleDomainChange = useCallback((value: string) => {
    dispatch({ type: "SET_DOMAIN", domain: value });
    // Auto-fill project name from hostname
    try {
      let hostname = value.trim();
      if (hostname && !hostname.startsWith("http")) {
        hostname = `https://${hostname}`;
      }
      const url = new URL(hostname);
      dispatch({ type: "SET_PROJECT_NAME", projectName: url.hostname });
    } catch (err) {
      console.warn("URL parsing failed during domain input:", err);
      if (value.trim()) {
        dispatch({ type: "SET_PROJECT_NAME", projectName: value.trim() });
      }
    }
  }, []);

  const handleStartScan = useCallback(async () => {
    dispatch({ type: "SET_STEP_ERROR", error: null });

    if (!state.domain.trim()) {
      dispatch({ type: "SET_STEP_ERROR", error: "Domain is required" });
      return;
    }
    if (!state.projectName.trim()) {
      dispatch({
        type: "SET_STEP_ERROR",
        error: "Project name is required",
      });
      return;
    }

    dispatch({ type: "SUBMIT_START" });
    try {
      // Normalize domain
      let normalizedDomain = state.domain.trim();
      if (
        !normalizedDomain.startsWith("http://") &&
        !normalizedDomain.startsWith("https://")
      ) {
        normalizedDomain = `https://${normalizedDomain}`;
      }

      // Fire profile update + project creation + optional persona classification
      // Persona is best-effort — use allSettled so it never blocks onboarding
      const projectCreationPromise = api.projects
        .create({
          name: state.projectName.trim(),
          domain: normalizedDomain,
        })
        .then(async (project) => {
          const defaults = await applyProjectWorkspaceDefaults({
            projectId: project.id,
            domainOrUrl: normalizedDomain,
            defaults: {
              schedule: state.defaultCrawlSchedule,
              autoRunOnCrawl: state.defaultAutoRunOnCrawl,
              enableVisibilitySchedule: state.defaultVisibilityScheduleEnabled,
              enableWeeklyDigest: state.defaultWeeklyDigestEnabled,
            },
          });
          if (defaults.failed.length > 0) {
            track("onboarding_workspace_defaults_partial_failure", {
              projectId: project.id,
              failed: defaults.failed.join(","),
            });
          }
          return project;
        });

      const promises: Promise<unknown>[] = [
        api.account.updateProfile({
          name: state.name.trim(),
          onboardingComplete: true,
        }),
        projectCreationPromise,
      ];

      if (state.workStyle) {
        promises.push(
          api.account
            .classifyPersona({
              teamSize: state.teamSize ?? "solo",
              primaryGoal: state.workStyle,
              domain: normalizedDomain,
            })
            .then((result) => {
              track("persona_classified", {
                persona: result.persona,
                source: "onboarding",
                confidence: result.confidence,
              });
            }),
        );
      }

      const results = await Promise.allSettled(promises);

      // Profile update (index 0) — if it failed, we can still continue
      // Project creation (index 1) — must succeed to advance
      const projectResult = results[1];
      if (projectResult.status === "rejected") {
        throw projectResult.reason;
      }

      const project = projectResult.value as { id: string };
      dispatch({ type: "SUBMIT_SUCCESS", projectId: project.id });
    } catch (err) {
      if (err instanceof ApiError) {
        dispatch({ type: "SUBMIT_FAIL", error: err.message });
      } else {
        dispatch({
          type: "SUBMIT_FAIL",
          error: "Something went wrong. Please try again.",
        });
      }
    }
  }, [
    state.domain,
    state.projectName,
    state.name,
    state.workStyle,
    state.teamSize,
    state.defaultCrawlSchedule,
    state.defaultAutoRunOnCrawl,
    state.defaultVisibilityScheduleEnabled,
    state.defaultWeeklyDigestEnabled,
  ]);

  const handleRetry = useCallback(() => {
    if (!state.projectId) return;
    dispatch({ type: "RESET_CRAWL" });
    startCrawl(state.projectId);
  }, [state.projectId, startCrawl]);

  return {
    state,
    dispatch,
    isLoaded,
    isSignedIn,
    handleContinue,
    handleDomainChange,
    handleStartScan,
    handleRetry,
    router,
  };
}
