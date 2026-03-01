"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, ApiError, type AIPrompt } from "@/lib/api";
import {
  Sparkles,
  Loader2,
  Trash2,
  Search,
  Download,
  Radar,
  CalendarClock,
} from "lucide-react";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useToast } from "@/components/ui/use-toast";

const CATEGORY_COLORS: Record<string, string> = {
  comparison: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "how-to": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  recommendation:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  review: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  general: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

function DifficultyBar({ value }: { value: number }) {
  const color =
    value >= 70 ? "bg-red-500" : value >= 40 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

export function PromptResearchPanel({
  projectId,
  filters,
}: {
  projectId: string;
  filters?: { region?: string; language?: string };
}) {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [mentionedFilter, setMentionedFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [runningPromptId, setRunningPromptId] = useState<string | null>(null);
  const [trackingPromptId, setTrackingPromptId] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    data: result,
    isLoading,
    error,
    mutate,
  } = useApiSWR<{ data: AIPrompt[]; meta: { limit: number; plan: string } }>(
    `prompt-research-${projectId}`,
    useCallback(() => api.promptResearch.list(projectId), [projectId]),
  );

  // Plan gate
  if (error instanceof ApiError && error.status === 403) {
    return (
      <UpgradePrompt
        feature="Prompt Research"
        description="Discover what questions people ask AI about your industry — find prompt opportunities before your competitors."
        nextTier="Starter ($79/mo)"
        nextTierUnlocks="Up to 20 discovered prompts, visibility tracking, 100 pages/crawl"
      />
    );
  }

  const prompts = result?.data ?? [];
  const meta = result?.meta;

  const filtered = prompts.filter((prompt) => {
    if (categoryFilter !== "all" && prompt.category !== categoryFilter) {
      return false;
    }
    if (mentionedFilter === "all") {
      return true;
    }
    if (mentionedFilter === "mentioned") {
      return Boolean(prompt.yourMentioned);
    }
    if (mentionedFilter === "not_mentioned" && prompt.yourMentioned !== false) {
      return false;
    }

    if (difficultyFilter === "all" || prompt.difficulty == null) {
      return true;
    }

    if (difficultyFilter === "easy") {
      return prompt.difficulty <= 33;
    }
    if (difficultyFilter === "medium") {
      return prompt.difficulty > 33 && prompt.difficulty <= 66;
    }
    if (difficultyFilter === "hard") {
      return prompt.difficulty > 66;
    }

    return true;
  });

  async function handleDiscover() {
    setIsDiscovering(true);
    try {
      await api.promptResearch.discover(projectId);
      await mutate();
      toast({
        title: "Prompts discovered",
        description: "New AI prompts have been added.",
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to discover prompts";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsDiscovering(false);
    }
  }

  async function handleDelete(promptId: string) {
    try {
      await api.promptResearch.remove(projectId, promptId);
      await mutate();
    } catch {
      toast({
        title: "Error",
        description: "Failed to remove prompt",
        variant: "destructive",
      });
    }
  }

  async function handleRunCheck(prompt: AIPrompt) {
    setRunningPromptId(prompt.id);
    try {
      const result = await api.promptResearch.check({
        projectId,
        promptId: prompt.id,
        ...(filters?.region ? { region: filters.region } : {}),
        ...(filters?.language ? { language: filters.language } : {}),
      });
      await mutate();
      toast({
        title: "Prompt check complete",
        description: result.yourMentioned
          ? "Your brand was mentioned in this prompt."
          : "Your brand is not mentioned yet for this prompt.",
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to run prompt check";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setRunningPromptId(null);
    }
  }

  async function handleTrackPrompt(prompt: AIPrompt) {
    setTrackingPromptId(prompt.id);
    try {
      await api.visibility.schedules.create({
        projectId,
        query: prompt.prompt,
        providers: ["chatgpt", "claude", "perplexity", "gemini"],
        frequency: "weekly",
      });
      toast({
        title: "Tracking enabled",
        description: "Added weekly visibility tracking for this prompt.",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to create tracking schedule";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setTrackingPromptId(null);
    }
  }

  function handleExportCsv() {
    if (filtered.length === 0) return;

    const escape = (value: string | number | null | undefined) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "Prompt",
      "Category",
      "EstimatedVolume",
      "Difficulty",
      "Intent",
      "DiscoveredAt",
    ];
    const rows = filtered.map((prompt) => [
      prompt.prompt,
      prompt.category,
      prompt.estimatedVolume,
      prompt.difficulty,
      prompt.intent,
      prompt.discoveredAt,
    ]);

    const csv = [headers, ...rows].map((row) => row.map(escape).join(","));
    const blob = new Blob([csv.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `prompt-research-${projectId}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);

    toast({
      title: "CSV exported",
      description: `${filtered.length} prompt${filtered.length === 1 ? "" : "s"} exported.`,
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prompt Research</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (prompts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Prompt Research
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="mb-4 text-sm text-muted-foreground">
              Discover what questions people ask AI about your industry.
            </p>
            <Button onClick={handleDiscover} disabled={isDiscovering}>
              {isDiscovering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Discover Prompts
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Prompt Research
            <span className="text-sm font-normal text-muted-foreground">
              ({prompts.length}
              {meta ? `/${meta.limit}` : ""})
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="comparison">Comparison</SelectItem>
                <SelectItem value="how-to">How-to</SelectItem>
                <SelectItem value="recommendation">Recommendation</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Select value={mentionedFilter} onValueChange={setMentionedFilter}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue placeholder="Mentioned status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All prompts</SelectItem>
                <SelectItem value="mentioned">Mentioned</SelectItem>
                <SelectItem value="not_mentioned">Not mentioned</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={difficultyFilter}
              onValueChange={setDifficultyFilter}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All difficulty</SelectItem>
                <SelectItem value="easy">Easy (0-33)</SelectItem>
                <SelectItem value="medium">Medium (34-66)</SelectItem>
                <SelectItem value="hard">Hard (67-100)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
            >
              <Download className="mr-1 h-3 w-3" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDiscover}
              disabled={isDiscovering}
            >
              {isDiscovering ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-3 w-3" />
              )}
              Discover More
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prompt</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Est. Volume</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Intent</TableHead>
              <TableHead>Mentioned</TableHead>
              <TableHead className="w-[280px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((prompt) => (
              <TableRow key={prompt.id}>
                <TableCell className="max-w-[300px] text-sm font-medium">
                  <span className="line-clamp-2">{prompt.prompt}</span>
                </TableCell>
                <TableCell>
                  {prompt.category && (
                    <Badge
                      variant="secondary"
                      className={`text-xs ${CATEGORY_COLORS[prompt.category] ?? ""}`}
                    >
                      {prompt.category}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {prompt.estimatedVolume?.toLocaleString() ?? "-"}
                </TableCell>
                <TableCell>
                  {prompt.difficulty != null ? (
                    <DifficultyBar value={prompt.difficulty} />
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {prompt.intent && (
                    <Badge variant="outline" className="text-xs">
                      {prompt.intent}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      prompt.yourMentioned === true
                        ? "success"
                        : prompt.yourMentioned === false
                          ? "outline"
                          : "secondary"
                    }
                    className="text-xs"
                  >
                    {prompt.yourMentioned === true
                      ? "Yes"
                      : prompt.yourMentioned === false
                        ? "No"
                        : "Unknown"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRunCheck(prompt)}
                      disabled={runningPromptId === prompt.id}
                    >
                      {runningPromptId === prompt.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Radar className="mr-1 h-3 w-3" />
                      )}
                      Run Check
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTrackPrompt(prompt)}
                      disabled={trackingPromptId === prompt.id}
                    >
                      {trackingPromptId === prompt.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <CalendarClock className="mr-1 h-3 w-3" />
                      )}
                      Track Weekly
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(prompt.id)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
