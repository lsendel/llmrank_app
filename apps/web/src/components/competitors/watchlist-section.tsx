"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";
import { Eye, Plus, Trash2, Pause, Play, Loader2 } from "lucide-react";

const PROVIDERS = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
  { id: "copilot", label: "Copilot" },
  { id: "grok", label: "Grok" },
] as const;

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
] as const;

function ago(d: string) {
  const ms = Date.now() - new Date(d).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

interface WatchlistQuery {
  id: string;
  projectId: string;
  query: string;
  providers: string[];
  frequency: string;
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

interface WatchlistSectionProps {
  projectId: string;
  watchlistLimit: number;
}

export function WatchlistSection({
  projectId,
  watchlistLimit,
}: WatchlistSectionProps) {
  const { withAuth } = useApi();
  const [queries, setQueries] = useState<WatchlistQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [newQuery, setNewQuery] = useState("");
  const [newProviders, setNewProviders] = useState<string[]>([
    "chatgpt",
    "claude",
    "perplexity",
    "gemini",
  ]);
  const [newFrequency, setNewFrequency] = useState("weekly");
  const [creating, setCreating] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    try {
      const result = await withAuth(() =>
        api.competitorMonitoring.getWatchlist(projectId),
      );
      setQueries(result?.queries ?? result?.data ?? []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist");
    }
  }, [projectId, withAuth]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await withAuth(() =>
          api.competitorMonitoring.getWatchlist(projectId),
        );
        if (cancelled) return;
        setQueries(result?.queries ?? result?.data ?? []);
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load watchlist",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, withAuth]);

  async function handleCreate() {
    if (!newQuery.trim() || newProviders.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      await withAuth(() =>
        api.competitorMonitoring.createWatchlistQuery({
          projectId,
          query: newQuery.trim(),
          providers: newProviders,
          frequency: newFrequency,
        }),
      );
      setNewQuery("");
      setNewProviders(["chatgpt", "claude", "perplexity", "gemini"]);
      setNewFrequency("weekly");
      setShowForm(false);
      await fetchWatchlist();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create watchlist query",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(query: WatchlistQuery) {
    try {
      await withAuth(() =>
        api.competitorMonitoring.updateWatchlistQuery(query.id, {
          enabled: !query.enabled,
        }),
      );
      await fetchWatchlist();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update query");
    }
  }

  async function handleDelete(id: string) {
    try {
      await withAuth(() => api.competitorMonitoring.deleteWatchlistQuery(id));
      await fetchWatchlist();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete query");
    }
  }

  function toggleProvider(id: string) {
    setNewProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  // Gate: if watchlistLimit is 0, show upgrade CTA
  if (watchlistLimit === 0) {
    return (
      <UpgradePrompt
        feature="Competitor Watchlist"
        description="Track specific queries across LLM providers to monitor when competitors appear in AI-generated responses."
        nextTier="Starter ($79/mo)"
        nextTierUnlocks="3 watchlist queries, activity feed, 30-day trends"
      />
    );
  }

  const atCapacity = queries.length >= watchlistLimit;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-5 w-5 text-muted-foreground" />
              Competitor Watchlist
            </CardTitle>
            <CardDescription className="mt-1">
              Monitor specific queries to track competitor visibility in AI
              responses.
              {watchlistLimit < Infinity && (
                <span className="ml-1">
                  ({queries.length}/{watchlistLimit} queries used)
                </span>
              )}
            </CardDescription>
          </div>
          {!showForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
              disabled={atCapacity}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Query
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="watchlist-query">Search Query</Label>
              <Input
                id="watchlist-query"
                placeholder='e.g. "best project management tools"'
                value={newQuery}
                onChange={(e) => setNewQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
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
                      newProviders.includes(p.id) ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => toggleProvider(p.id)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={newFrequency} onValueChange={setNewFrequency}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={
                  creating || !newQuery.trim() || newProviders.length === 0
                }
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Query"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading watchlist...
          </div>
        )}

        {/* Empty state */}
        {!loading && queries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Eye className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No watchlist queries yet. Add a query to start monitoring
              competitor visibility in AI responses.
            </p>
          </div>
        )}

        {/* Query list */}
        {!loading &&
          queries.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium">{q.query}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {q.providers.map((provider) => (
                    <Badge
                      key={provider}
                      variant="secondary"
                      className="text-xs"
                    >
                      {provider}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs">
                    {q.frequency}
                  </Badge>
                  {!q.enabled && (
                    <Badge variant="destructive" className="text-xs">
                      Paused
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {q.lastRunAt
                    ? `Last run: ${ago(q.lastRunAt)}`
                    : "Not yet run"}
                </p>
              </div>
              <div className="ml-3 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(q)}
                  title={q.enabled ? "Pause" : "Resume"}
                >
                  {q.enabled ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(q.id)}
                  className="text-destructive hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

        {/* At capacity upgrade CTA */}
        {atCapacity && (
          <UpgradePrompt
            feature="More Watchlist Queries"
            description={`You've reached the limit of ${watchlistLimit} watchlist queries on your current plan.`}
            nextTier="Pro ($149/mo)"
            nextTierUnlocks="Up to 10 watchlist queries, 90-day trends, daily monitoring"
          />
        )}
      </CardContent>
    </Card>
  );
}
