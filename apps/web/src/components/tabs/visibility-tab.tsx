"use client";

import { useState, useEffect, useCallback } from "react";
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
import { CompetitorComparison } from "@/components/visibility/competitor-comparison";
import { useToast } from "@/components/ui/use-toast";
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
] as const;

const FREQUENCY_OPTIONS = [
  { value: "hourly", label: "Hourly", description: "Pro+ plans only" },
  { value: "daily", label: "Daily", description: "Every 24 hours" },
  { value: "weekly", label: "Weekly", description: "Every 7 days" },
] as const;

export default function VisibilityTab({
  projectId,
  domain,
  latestCrawlId,
}: {
  projectId: string;
  domain: string;
  latestCrawlId?: string;
}) {
  const { withAuth } = useApi();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
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

  // Load history on mount
  useEffect(() => {
    withAuth(async () => {
      const data = await api.visibility.list(projectId);
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
  }, [withAuth, projectId, toast]);

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
    if (!query.trim() || selectedProviders.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await withAuth(async () => {
        const data = await api.visibility.run({
          projectId,
          query: query.trim(),
          providers: selectedProviders,
        });
        setResults(data);
        const updated = await api.visibility.list(projectId);
        setHistory(updated);
      });
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
    frequency: "hourly" | "daily" | "weekly";
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
      {/* Platform Readiness Matrix */}
      {latestCrawlId && <PlatformReadinessMatrix crawlId={latestCrawlId} />}

      {/* Share of Voice Chart */}
      <ShareOfVoiceChart projectId={projectId} />

      {/* Competitor Comparison */}
      {history.length > 0 && competitors && (
        <CompetitorComparison
          projectId={projectId}
          results={history}
          competitorDomains={competitors.map((c) => c.domain)}
        />
      )}

      {/* Run Check Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run Visibility Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vis-query">Search Query</Label>
            <Input
              id="vis-query"
              placeholder={`e.g. "best ${domain.split(".")[0]} alternatives"`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
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
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button onClick={handleRunCheck} disabled={loading || !query.trim()}>
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
    frequency: "hourly" | "daily" | "weekly";
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
            variant={
              schedule.frequency === "hourly"
                ? "default"
                : schedule.frequency === "daily"
                  ? "outline"
                  : "secondary"
            }
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
    frequency: "hourly" | "daily" | "weekly";
  }) => Promise<void>;
}) {
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [scheduleProviders, setScheduleProviders] = useState<string[]>(
    PROVIDERS.map((p) => p.id),
  );
  const [frequency, setFrequency] = useState<"hourly" | "daily" | "weekly">(
    "daily",
  );
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
      setFrequency("daily");
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
            onValueChange={(val) =>
              setFrequency(val as "hourly" | "daily" | "weekly")
            }
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
          {frequency === "hourly" && (
            <p className="text-xs text-amber-600">
              Hourly checks are only available on Pro and Agency plans.
            </p>
          )}
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
