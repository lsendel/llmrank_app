import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeDomain } from "@llm-boost/shared";
import { api, ApiError, type PublicScanResult } from "@/lib/api";
import { useUser } from "@/lib/auth-hooks";
import { confidenceFromPageSample } from "@/lib/insight-metadata";
import {
  applyProjectWorkspaceDefaults,
  deriveProjectName,
} from "@/lib/project-workspace-defaults";
import { track } from "@/lib/telemetry";
import {
  getPagesSampled,
  getRecurringScanDestination,
  getVisibilityChecks,
  type ScanResultCta,
  type ScanResultCtaPlacement,
} from "../scan-results-helpers";

export function useScanResultsState() {
  const { push, replace } = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useUser();
  const scanId = searchParams.get("id");
  const entrySource = searchParams.get("source") ?? "direct";

  const [result, setResult] = useState<PublicScanResult | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [unlockToken, setUnlockToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const id = searchParams.get("id");
    if (!id) return null;
    return localStorage.getItem(`scan-unlocked-${id}`);
  });

  const fetchResult = useCallback(async (id: string, token?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.public.getScanResult(id, token ?? undefined);
      setResult(data);
      setIsUnlocked(!!data.quickWins);
    } catch {
      setError("Failed to load scan results. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (scanId) {
      void fetchResult(scanId, unlockToken);
      return;
    }

    const stored =
      typeof window === "undefined"
        ? null
        : sessionStorage.getItem("scanResult");
    if (!stored) {
      replace("/scan");
      return;
    }

    const parsed: PublicScanResult = JSON.parse(stored);
    setResult(parsed);
    setIsUnlocked(true);
    setLoading(false);
    track("scan.completed", {
      domain: parsed.url,
      grade: parsed.scores.letterGrade,
      score: parsed.scores.overall,
    });
  }, [fetchResult, replace, scanId, unlockToken]);

  useEffect(() => {
    if (result && scanId) {
      track("scan.completed", {
        domain: result.url ?? result.domain,
        grade: result.scores?.letterGrade,
        score: result.scores?.overall,
      });
    }
  }, [result, scanId]);

  const domain = result?.url ?? result?.domain ?? "";
  const normalizedDomain = domain ? normalizeDomain(domain) : "";
  const pagesSampled = result ? getPagesSampled(result) : 1;
  const sampleConfidence = confidenceFromPageSample(pagesSampled);
  const visibilityChecks = useMemo(
    () => (result ? getVisibilityChecks(result.visibility) : []),
    [result],
  );
  const visibilityProviders = useMemo(
    () =>
      Array.from(
        new Set(visibilityChecks.map((item) => item.provider).filter(Boolean)),
      ),
    [visibilityChecks],
  );
  const anyVisibilityMention = useMemo(
    () => visibilityChecks.some((item) => item.brandMentioned),
    [visibilityChecks],
  );
  const recurringScanDestination = getRecurringScanDestination(isSignedIn);

  const trackCtaClick = useCallback(
    (
      cta: ScanResultCta,
      destination: string,
      placement: ScanResultCtaPlacement,
    ) => {
      track("scan_result_cta_clicked", {
        cta,
        destination,
        placement,
        scanResultId: scanId ?? "session-storage",
        domain,
        entrySource,
      });
    },
    [domain, entrySource, scanId],
  );

  const handleEmailCaptured = useCallback(
    (leadId: string) => {
      if (scanId) {
        localStorage.setItem(`scan-unlocked-${scanId}`, leadId);
        setUnlockToken(leadId);
        void fetchResult(scanId, leadId);
        return;
      }

      setIsUnlocked(true);
    },
    [fetchResult, scanId],
  );

  const handleCreateWorkspaceFromScan = useCallback(async () => {
    if (creatingWorkspace || !result || !domain) return;

    setCreatingWorkspace(true);
    setWorkspaceError(null);
    trackCtaClick(
      "create_project",
      "/dashboard/projects/from-scan",
      "results_next_actions",
    );

    try {
      const project = await api.projects.create({
        name: deriveProjectName(domain, result.meta?.title),
        domain: normalizedDomain,
      });

      const defaults = await applyProjectWorkspaceDefaults({
        projectId: project.id,
        domainOrUrl: domain,
        title: result.meta?.title,
      });

      track("scan_result_workspace_created", {
        scanResultId: scanId ?? "session-storage",
        domain: normalizedDomain,
        projectId: project.id,
      });
      if (defaults.failed.length > 0) {
        track("scan_result_workspace_defaults_partial_failure", {
          projectId: project.id,
          failed: defaults.failed.join(","),
        });
      }
      push(`/dashboard/projects/${project.id}?tab=overview&source=scan`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not create a workspace from this scan.";
      setWorkspaceError(message);
    } finally {
      setCreatingWorkspace(false);
    }
  }, [
    creatingWorkspace,
    domain,
    normalizedDomain,
    push,
    result,
    scanId,
    trackCtaClick,
  ]);

  return {
    scanId,
    result,
    isUnlocked,
    loading,
    error,
    isSignedIn,
    creatingWorkspace,
    workspaceError,
    pagesSampled,
    sampleConfidence,
    visibilityChecks,
    visibilityProviders,
    anyVisibilityMention,
    recurringScanDestination,
    handleEmailCaptured,
    handleCreateWorkspaceFromScan,
    trackCtaClick,
  };
}
