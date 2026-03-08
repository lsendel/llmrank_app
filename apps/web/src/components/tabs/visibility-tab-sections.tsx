import { useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StateMessage } from "@/components/ui/state";
import { useApi } from "@/lib/use-api";
import { api, type ScheduledQuery, type VisibilityCheck } from "@/lib/api";
import { CalendarClock, Clock, Pause, Play, Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_PROVIDER_IDS,
  FREQUENCY_OPTIONS,
  PROVIDERS,
  type ScheduleFrequency,
} from "./visibility-tab-helpers";

export function ScheduledChecksSection({
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
    frequency: ScheduleFrequency;
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
          <StateMessage
            variant="empty"
            title="No scheduled checks yet"
            description="Add a schedule to automatically monitor your visibility across LLM providers."
            icon={<Clock className="h-10 w-10 text-muted-foreground/50" />}
          />
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

function AddScheduleDialog({
  error,
  onSubmit,
}: {
  error: string | null;
  onSubmit: (data: {
    query: string;
    providers: string[];
    frequency: ScheduleFrequency;
  }) => Promise<void>;
}) {
  const [scheduleQuery, setScheduleQuery] = useState("");
  const [scheduleProviders, setScheduleProviders] =
    useState<string[]>(DEFAULT_PROVIDER_IDS);
  const [frequency, setFrequency] = useState<ScheduleFrequency>("weekly");
  const [submitting, setSubmitting] = useState(false);

  function toggleScheduleProvider(id: string) {
    setScheduleProviders((prev) =>
      prev.includes(id)
        ? prev.filter((provider) => provider !== id)
        : [...prev, id],
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
      setScheduleQuery("");
      setScheduleProviders(DEFAULT_PROVIDER_IDS);
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
            onChange={(event) => setScheduleQuery(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>LLM Providers</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant={
                  scheduleProviders.includes(provider.id)
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => toggleScheduleProvider(provider.id)}
              >
                {provider.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select
            value={frequency}
            onValueChange={(value) => setFrequency(value as ScheduleFrequency)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && (
          <StateMessage
            variant="error"
            compact
            title="Schedule creation failed"
            description={error}
            className="rounded-md border border-destructive/20 bg-destructive/5 py-3"
          />
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

const EMPTY_SUB = () => () => {};

export function ScheduleSuggestionBanner({
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

export function VisibilityResultCard({ check }: { check: VisibilityCheck }) {
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
                ).map((competitor) => (
                  <Badge
                    key={competitor.domain}
                    variant={competitor.mentioned ? "warning" : "secondary"}
                  >
                    {competitor.domain}:{" "}
                    {competitor.mentioned
                      ? `Found (#${competitor.position ?? "?"})`
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
