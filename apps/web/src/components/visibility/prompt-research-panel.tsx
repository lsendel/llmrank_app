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
import { Sparkles, Loader2, Trash2, Search } from "lucide-react";
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

export function PromptResearchPanel({ projectId }: { projectId: string }) {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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

  const filtered =
    categoryFilter === "all"
      ? prompts
      : prompts.filter((p) => p.category === categoryFilter);

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
              <TableHead className="w-[40px]" />
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(prompt.id)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
