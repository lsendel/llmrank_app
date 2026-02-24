"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlatformReadinessMatrix } from "@/components/platform-readiness-matrix";
import { ShareOfVoiceChart } from "@/components/share-of-voice-chart";
import { CitedPagesTable } from "@/components/visibility/cited-pages-table";
import { BrandSentimentCard } from "@/components/visibility/brand-sentiment-card";
import { BrandPerformanceDashboard } from "@/components/visibility/brand-performance-dashboard";
import { SourceOpportunitiesTable } from "@/components/visibility/source-opportunities-table";
import { PromptResearchPanel } from "@/components/visibility/prompt-research-panel";
import { CompetitorComparison } from "@/components/visibility/competitor-comparison";
import { AIVisibilityScoreHeader } from "@/components/visibility/ai-visibility-score-header";
import { RecommendationsCard } from "@/components/visibility/recommendations-card";
import { KeywordPicker } from "@/components/visibility/keyword-picker";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useToast } from "@/components/ui/use-toast";
import { usePlan } from "@/hooks/use-plan";
import { useApi } from "@/lib/use-api";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  ApiError,
  type VisibilityCheck,
  type VisibilityGap,
  type StrategyCompetitor,
  type ScheduledQuery,
} from "@/lib/api";
import {
  Plus,
  Trash2,
  Clock,
  CalendarClock,
  Pause,
  Play,
  AlertTriangle,
} from "lucide-react";

const PROVIDERS = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
  { id: "copilot", label: "Copilot" },
  { id: "gemini_ai_mode", label: "AI Search (Gemini)" },
  { id: "grok", label: "Grok" },
] as const;

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily", description: "Every 24 hours" },
  { value: "weekly", label: "Weekly", description: "Every 7 days" },
] as const;

const REGIONS = [
  { value: "all", label: "Worldwide" },
  { value: "us", label: "US" },
  { value: "gb", label: "UK" },
  { value: "de", label: "DE" },
  { value: "fr", label: "FR" },
  { value: "es", label: "ES" },
  { value: "br", label: "BR" },
  { value: "jp", label: "JP" },
  { value: "au", label: "AU" },
  { value: "ca", label: "CA" },
  { value: "in", label: "IN" },
  { value: "it", label: "IT" },
  { value: "nl", label: "NL" },
  { value: "se", label: "SE" },
  { value: "kr", label: "KR" },
] as const;

const REGION_LANGUAGES: Record<string, string> = {
  us: "en",
  gb: "en",
  de: "de",
  fr: "fr",
  es: "es",
  br: "pt",
  jp: "ja",
  au: "en",
  ca: "en",
  in: "en",
  it: "it",
  nl: "nl",
  se: "sv",
  kr: "ko",
};

export default function VisibilityTab({
  projectId,
  domain: _domain,
  latestCrawlId,
}: {
  projectId: string;
  domain: string;
  latestCrawlId?: string;
}) {
  const { withAuth } = useApi();
  const { toast } = useToast();
  const { isFree, isPro, isAgency } = usePlan();
  const canFilterRegion = isPro || isAgency;
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(
    PROVIDERS.map((p) => p.id),
  );
  const [results, setResults] = useState<VisibilityCheck[]>([]);
  const [history, setHistory] = useState<VisibilityCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: competitors } = useApiSWR<StrategyCompetitor[]>(
    `competitors-${projectId}`,
    useCallback(() => api.strategy.getCompetitors(projectId), [projectId]),
  );

  const { data: gaps } = useApiSWR<VisibilityGap[]>(
    `visibility-gaps-${projectId}`,
    useCallback(() => api.visibility.getGaps(projectId), [projectId]),
  );

  // Scheduled checks state
  const [schedules, setSchedules] = useState<ScheduledQuery[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Compute region/language filter for API calls
  const regionFilter = useMemo(
    () =>
      selectedRegion !== "all" && canFilterRegion
        ? {
            region: selectedRegion,
            language: REGION_LANGUAGES[selectedRegion] ?? "en",
          }
        : undefined,
    [selectedRegion, canFilterRegion],
  );

  // Load history on mount and when region changes
  useEffect(() => {
    setHistoryLoaded(false);
    withAuth(async () => {
      const data = await api.visibility.list(projectId, regionFilter);
      setHistory(data);
    })
      .catch((err: unknown) => {
        toast({
          title: "Failed to load history",
          description:
            err instanceof Error
              ? err.message
              : "Could not load visibility history",
          variant: "destructive",
        });
      })
      .finally(() => setHistoryLoaded(true));
  }, [withAuth, projectId, toast, regionFilter]);

  // Load schedules on mount
  useEffect(() => {
    withAuth(async () => {
      const data = await api.visibility.schedules.list(projectId);
      setSchedules(data);
    })
      .catch((err: unknown) => {
        toast({
          title: "Failed to load schedules",
          description:
            err instanceof Error
              ? err.message
              : "Could not load scheduled checks",
          variant: "destructive",
        });
      })
      .finally(() => setSchedulesLoaded(true));
  }, [withAuth, projectId, toast]);

  async function handleRunCheck() {
    if (selectedKeywordIds.length === 0 || selectedProviders.length === 0)
      return;
    setLoading(true);
    setError(null);
    try {
      // Separate real keyword IDs from persona virtual IDs
      const realIds: string[] = [];
      const personaQueries: string[] = [];
      for (const id of selectedKeywordIds) {
        if (id.startsWith("persona:")) {
          const query = id.split(":").slice(2).join(":");
          personaQueries.push(query);
        } else {
          realIds.push(id);
        }
      }

      // Save persona queries as keywords first
      if (personaQueries.length > 0) {
        const saved = await api.keywords.createBatch(projectId, personaQueries);
        realIds.push(...saved.map((k) => k.id));
      }

      await withAuth(async () => {
        const data = await api.visibility.run({
          projectId,
          keywordIds: realIds,
          providers: selectedProviders,
          ...(regionFilter && {
            region: regionFilter.region,
            language: regionFilter.language,
          }),
        });
        setResults(data);
      });

      const updated = await api.visibility.list(projectId, regionFilter);
      setHistory(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to run visibility check.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSchedule(data: {
    query: string;
    providers: string[];
    frequency: "daily" | "weekly";
  }) {
    setScheduleError(null);
    try {
      await withAuth(async () => {
        const created = await api.visibility.schedules.create({
          projectId,
          ...data,
        });
        setSchedules((prev) => [...prev, created]);
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setScheduleError(err.message);
      } else {
        setScheduleError("Failed to create schedule.");
      }
      throw err;
    }
  }

  async function handleToggleSchedule(schedule: ScheduledQuery) {
    try {
      await withAuth(async () => {
        const updated = await api.visibility.schedules.update(schedule.id, {
          enabled: !schedule.enabled,
        });
        setSchedules((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to toggle schedule",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteSchedule(id: string) {
    try {
      await withAuth(async () => {
        await api.visibility.schedules.delete(id);
        setSchedules((prev) => prev.filter((s) => s.id !== id));
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to delete schedule",
        variant: "destructive",
      });
    }
  }

  function toggleProvider(id: string) {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      {/* Region Filter (Pro+) */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Region:</span>
          <Select
            value={selectedRegion}
            onValueChange={(v) => {
              if (!canFilterRegion && v !== "all") {
                toast({
                  title: "Pro plan required",
                  description:
                    "Regional filtering is available on Pro and Agency plans.",
                  variant: "destructive",
                });
                return;
              }
              setSelectedRegion(v);
            }}
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => (
                <SelectItem
                  key={r.value}
                  value={r.value}
                  disabled={r.value !== "all" && !canFilterRegion}
                >
                  {r.label}
                  {r.value !== "all" && !canFilterRegion && " (Pro)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* AI Visibility Score Header */}
      <AIVisibilityScoreHeader projectId={projectId} />

      {/* Brand Performance Dashboard (Starter+) */}
      {!isFree && <BrandPerformanceDashboard projectId={projectId} />}

      {isFree && (
        <UpgradePrompt
          feature="AI Visibility Tracking"
          description="Track how LLMs mention your brand across 25+ queries with scheduled monitoring."
          nextTier="Starter ($79/mo)"
          nextTierUnlocks="25 visibility checks, 5 scheduled queries, keyword discovery"
        />
      )}

      {/* Actionable Recommendations */}
      <RecommendationsCard projectId={projectId} />

      {/* Platform Readiness Matrix */}
      {latestCrawlId && <PlatformReadinessMatrix crawlId={latestCrawlId} />}

      {/* Share of Voice Chart */}
      <ShareOfVoiceChart projectId={projectId} />

      {/* Cited Pages */}
      <CitedPagesTable projectId={projectId} />

      {/* Brand Perception (Starter+) */}
      {!isFree && <BrandSentimentCard projectId={projectId} />}

      {/* Competitor Comparison */}
      {history.length > 0 && competitors && (
        <CompetitorComparison
          projectId={projectId}
          results={history}
          competitorDomains={competitors.map((c) => c.domain)}
        />
      )}

      {/* Run Check Form */}
      <KeywordPicker
        projectId={projectId}
        selectedIds={selectedKeywordIds}
        onSelectionChange={setSelectedKeywordIds}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run Visibility Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>LLM Providers</Label>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <Button
                  key={p.id}
                  variant={
                    selectedProviders.includes(p.id) ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => toggleProvider(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Cost indicator */}
          {selectedKeywordIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedKeywordIds.length} quer
              {selectedKeywordIds.length === 1 ? "y" : "ies"} x{" "}
              {selectedProviders.length} provider
              {selectedProviders.length === 1 ? "" : "s"} ={" "}
              {selectedKeywordIds.length * selectedProviders.length} checks
            </p>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button
            onClick={handleRunCheck}
            disabled={loading || selectedKeywordIds.length === 0}
          >
            {loading ? "Checking..." : "Run Check"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Results</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((r) => (
              <VisibilityResultCard key={r.id} check={r} />
            ))}
          </div>
        </div>
      )}

      {/* Schedule Suggestion Banner */}
      {results.length > 0 && schedules.length === 0 && (
        <ScheduleSuggestionBanner
          projectId={projectId}
          lastQuery={results[0]?.query ?? ""}
          lastProviders={selectedProviders}
          onCreated={(schedule) => setSchedules((prev) => [...prev, schedule])}
        />
      )}

      {/* Scheduled Checks */}
      {schedulesLoaded && (
        <ScheduledChecksSection
          schedules={schedules}
          scheduleError={scheduleError}
          onCreateSchedule={handleCreateSchedule}
          onToggleSchedule={handleToggleSchedule}
          onDeleteSchedule={handleDeleteSchedule}
        />
      )}

      {/* History */}
      {historyLoaded && history.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Previous Checks</h3>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Query</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Brand Mentioned</TableHead>
                  <TableHead>URL Cited</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((check) => (
                  <TableRow key={check.id}>
                    <TableCell className="text-sm">
                      {new Date(check.checkedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {check.query}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{check.llmProvider}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          check.brandMentioned ? "success" : "destructive"
                        }
                      >
                        {check.brandMentioned ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={check.urlCited ? "success" : "destructive"}
                      >
                        {check.urlCited ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Content Gaps */}
      {gaps && gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Content Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {gaps.map((gap) => (
              <div
                key={gap.query}
                className="rounded-lg border border-warning/20 bg-warning/5 p-4"
              >
                <p className="text-sm font-medium">&ldquo;{gap.query}&rdquo;</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Your status: Not mentioned</span>
                  <span>&bull;</span>
                  <span>
                    Competitors cited:{" "}
                    {gap.competitorsCited.map((c) => c.domain).join(", ")}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Create content targeting this query to close the gap.
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Prompt Research (Starter+) */}
      <PromptResearchPanel projectId={projectId} />

      {/* Source Opportunities (Pro+) */}
      <SourceOpportunitiesTable projectId={projectId} />
    </div>
  );
}

// ── Scheduled Checks Section ─────────────────────────────────────────

function ScheduledChecksSection({
  schedules,
  scheduleError,
  onCreateSchedule,
  onToggleSchedule,
  onDeleteSchedule,
}: {
  schedules: ScheduledQuery[];
  scheduleError: string | null;
  onCreateSchedule: (data: {
    query: string;
    providers: string[];
    frequency: "daily" | "weekly";
  }) => Promise<void>;
  onToggleSchedule: (schedule: ScheduledQuery) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Scheduled Checks</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <AddScheduleDialog
              error={scheduleError}
              onSubmit={async (data) => {
                await onCreateSchedule(data);
                setDialogOpen(false);
              }}
            />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No scheduled checks yet. Add a schedule to automatically monitor
              your visibility across LLM providers.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                onToggle={() => onToggleSchedule(schedule)}
                onDelete={() => onDeleteSchedule(schedule.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Schedule Row ─────────────────────────────────────────────────────

function ScheduleRow({
  schedule,
  onToggle,
  onDelete,
}: {
  schedule: ScheduledQuery;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle();
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium">{schedule.query}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {schedule.providers.map((provider) => (
            <Badge key={provider} variant="secondary" className="text-xs">
              {provider}
            </Badge>
          ))}
          <Badge
            variant={schedule.frequency === "weekly" ? "default" : "secondary"}
            className="text-xs"
          >
            {schedule.frequency}
          </Badge>
          {!schedule.enabled && (
            <Badge variant="destructive" className="text-xs">
              Paused
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {schedule.lastRunAt
            ? `Last run: ${new Date(schedule.lastRunAt).toLocaleString()}`
            : "Not yet run"}
          {" | "}
          Next: {new Date(schedule.nextRunAt).toLocaleString()}
        </p>
      </div>
      <div className="ml-3 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          disabled={toggling}
          title={schedule.enabled ? "Pause schedule" : "Resume schedule"}
        >
          {schedule.enabled ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-destructive hover:text-destructive"
          title="Delete schedule"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Add Schedule Dialog ──────────────────────────────────────────────

function AddScheduleDialog({
  error,
  onSubmit,
}: {
  error: string | null;
  onSubmit: (data: {
    query: string;
    providers: string[];
    frequency: "daily" | "weekly";
  }) => Promise<void>;
}) {
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [scheduleProviders, setScheduleProviders] = useState<string[]>(
    PROVIDERS.map((p) => p.id),
  );
  const [frequency, setFrequency] = useState<"daily" | "weekly">("weekly");
  const [submitting, setSubmitting] = useState(false);

  function toggleScheduleProvider(id: string) {
    setScheduleProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function handleSubmit() {
    if (!scheduleQuery.trim() || scheduleProviders.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        query: scheduleQuery.trim(),
        providers: scheduleProviders,
        frequency,
      });
      // Reset form on success
      setScheduleQuery("");
      setScheduleProviders(PROVIDERS.map((p) => p.id));
      setFrequency("weekly");
    } catch {
      // Error is displayed via the error prop
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add Scheduled Visibility Check</DialogTitle>
        <DialogDescription>
          Automatically check your brand visibility across LLM providers on a
          recurring schedule.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="schedule-query">Search Query</Label>
          <Input
            id="schedule-query"
            placeholder='e.g. "best project management tools"'
            value={scheduleQuery}
            onChange={(e) => setScheduleQuery(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>LLM Providers</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant={
                  scheduleProviders.includes(p.id) ? "default" : "outline"
                }
                size="sm"
                onClick={() => toggleScheduleProvider(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select
            value={frequency}
            onValueChange={(val) => setFrequency(val as "daily" | "weekly")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {opt.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !scheduleQuery.trim() ||
            scheduleProviders.length === 0
          }
        >
          {submitting ? "Creating..." : "Create Schedule"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Schedule Suggestion Banner ───────────────────────────────────────

const EMPTY_SUB = () => () => {};

function ScheduleSuggestionBanner({
  projectId,
  lastQuery,
  lastProviders,
  onCreated,
}: {
  projectId: string;
  lastQuery: string;
  lastProviders: string[];
  onCreated: (schedule: ScheduledQuery) => void;
}) {
  const { withAuth } = useApi();
  const [creating, setCreating] = useState(false);
  const storageKey = `schedule-suggestion-dismissed-${projectId}`;
  const isDismissedFromStorage = useSyncExternalStore(
    EMPTY_SUB,
    () => localStorage.getItem(storageKey) === "true",
    () => true,
  );
  const [manuallyDismissed, setManuallyDismissed] = useState(false);

  if (isDismissedFromStorage || manuallyDismissed || !lastQuery) return null;

  async function handleCreateWeeklySchedule() {
    setCreating(true);
    try {
      await withAuth(async () => {
        const created = await api.visibility.schedules.create({
          projectId,
          query: lastQuery,
          providers: lastProviders,
          frequency: "weekly",
        });
        onCreated(created);
      });
    } catch {
      // Error handled by withAuth toast
    } finally {
      setCreating(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(storageKey, "true");
    setManuallyDismissed(true);
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="flex items-center justify-between py-3">
        <p className="text-sm">Track your visibility weekly?</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleCreateWeeklySchedule}
            disabled={creating}
          >
            {creating ? "Creating..." : "Enable Weekly"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Visibility Result Card ───────────────────────────────────────────

function VisibilityResultCard({ check }: { check: VisibilityCheck }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base capitalize">
            {check.llmProvider}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant={check.brandMentioned ? "success" : "destructive"}>
              {check.brandMentioned ? "Mentioned" : "Not Mentioned"}
            </Badge>
            <Badge variant={check.urlCited ? "success" : "destructive"}>
              {check.urlCited ? "Cited" : "Not Cited"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {check.citationPosition != null && (
          <p className="text-sm text-muted-foreground">
            Position:{" "}
            <span className="font-medium text-foreground">
              #{check.citationPosition}
            </span>
          </p>
        )}
        {check.responseText && (
          <div className="max-h-40 overflow-y-auto rounded-md bg-muted p-3 text-xs">
            {check.responseText.slice(0, 500)}
            {check.responseText.length > 500 && "..."}
          </div>
        )}
        {check.competitorMentions &&
          (check.competitorMentions as { domain: string; mentioned: boolean }[])
            .length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Competitors
              </p>
              <div className="flex flex-wrap gap-1">
                {(
                  check.competitorMentions as {
                    domain: string;
                    mentioned: boolean;
                    position: number | null;
                  }[]
                ).map((comp) => (
                  <Badge
                    key={comp.domain}
                    variant={comp.mentioned ? "warning" : "secondary"}
                  >
                    {comp.domain}:{" "}
                    {comp.mentioned
                      ? `Found (#${comp.position ?? "?"})`
                      : "Not found"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
