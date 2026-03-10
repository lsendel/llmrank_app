import {
  CalendarClock,
  Download,
  Loader2,
  Radar,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AIPrompt } from "@/lib/api";
import {
  CATEGORY_COLORS,
  getDifficultyBarClassName,
  getMentionedBadgeProps,
  PROMPT_CATEGORY_OPTIONS,
  PROMPT_DIFFICULTY_OPTIONS,
  PROMPT_MENTION_OPTIONS,
  type PromptCategoryFilter,
  type PromptDifficultyFilter,
  type PromptMentionedFilter,
} from "./prompt-research-panel-helpers";

function DifficultyBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${getDifficultyBarClassName(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

export function PromptResearchLoadingCard() {
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

export function PromptResearchEmptyStateCard({
  isDiscovering,
  onDiscover,
}: {
  isDiscovering: boolean;
  onDiscover: () => void;
}) {
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
          <Button onClick={onDiscover} disabled={isDiscovering}>
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

export function PromptResearchResultsCard({
  prompts,
  filteredPrompts,
  meta,
  categoryFilter,
  mentionedFilter,
  difficultyFilter,
  isDiscovering,
  runningPromptId,
  trackingPromptId,
  onCategoryFilterChange,
  onMentionedFilterChange,
  onDifficultyFilterChange,
  onExportCsv,
  onDiscover,
  onRunCheck,
  onTrackPrompt,
  onDelete,
}: {
  prompts: AIPrompt[];
  filteredPrompts: AIPrompt[];
  meta?: { limit: number; plan: string };
  categoryFilter: PromptCategoryFilter;
  mentionedFilter: PromptMentionedFilter;
  difficultyFilter: PromptDifficultyFilter;
  isDiscovering: boolean;
  runningPromptId: string | null;
  trackingPromptId: string | null;
  onCategoryFilterChange: (value: string) => void;
  onMentionedFilterChange: (value: string) => void;
  onDifficultyFilterChange: (value: string) => void;
  onExportCsv: () => void;
  onDiscover: () => void;
  onRunCheck: (prompt: AIPrompt) => void;
  onTrackPrompt: (prompt: AIPrompt) => void;
  onDelete: (promptId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Prompt Research
            <span className="text-sm font-normal text-muted-foreground">
              ({prompts.length}
              {meta ? `/${meta.limit}` : ""})
            </span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={categoryFilter}
              onValueChange={onCategoryFilterChange}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={mentionedFilter}
              onValueChange={onMentionedFilterChange}
            >
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue placeholder="Mentioned status" />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_MENTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={difficultyFilter}
              onValueChange={onDifficultyFilterChange}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_DIFFICULTY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={onExportCsv}
              disabled={filteredPrompts.length === 0}
            >
              <Download className="mr-1 h-3 w-3" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDiscover}
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
            {filteredPrompts.map((prompt) => {
              const mentionedBadge = getMentionedBadgeProps(
                prompt.yourMentioned,
              );

              return (
                <TableRow key={prompt.id}>
                  <TableCell className="max-w-[300px] text-sm font-medium">
                    <span className="line-clamp-2">{prompt.prompt}</span>
                  </TableCell>
                  <TableCell>
                    {prompt.category ? (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${CATEGORY_COLORS[prompt.category] ?? ""}`}
                      >
                        {prompt.category}
                      </Badge>
                    ) : null}
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
                    {prompt.intent ? (
                      <Badge variant="outline" className="text-xs">
                        {prompt.intent}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={mentionedBadge.variant} className="text-xs">
                      {mentionedBadge.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRunCheck(prompt)}
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
                        onClick={() => onTrackPrompt(prompt)}
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
                        aria-label={`Delete ${prompt.prompt}`}
                        onClick={() => onDelete(prompt.id)}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
