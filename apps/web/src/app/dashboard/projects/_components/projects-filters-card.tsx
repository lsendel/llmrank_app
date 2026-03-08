import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PageSummary = {
  good: number;
  needsWork: number;
  poor: number;
  inProgress: number;
};

type PresetButton = {
  key: string;
  label: string;
  active: boolean;
};

type ShortcutTarget = {
  id: string;
  name: string;
  href: string;
};

type Shortcut = {
  title: string;
  description: string;
  cta: string;
};

export function ProjectsFiltersCard({
  searchInput,
  onSearchInputChange,
  healthFilter,
  onHealthChange,
  sortBy,
  onSortChange,
  onReset,
  presetButtons,
  onApplyPreset,
  canSaveDefaultPreset,
  savingDefaultPreset,
  onSaveDefaultPreset,
  usingAnomalyView,
  anomalyFilter,
  totalFiltered,
  pageSummary,
  activeAnomalyShortcut,
  anomalyShortcutTargets,
  additionalAnomalyMatchCount,
}: {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  healthFilter: string;
  onHealthChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  onReset: () => void;
  presetButtons: PresetButton[];
  onApplyPreset: (preset: string) => void;
  canSaveDefaultPreset: boolean;
  savingDefaultPreset: boolean;
  onSaveDefaultPreset: () => void;
  usingAnomalyView: boolean;
  anomalyFilter: string;
  totalFiltered: number;
  pageSummary: PageSummary;
  activeAnomalyShortcut: Shortcut | null;
  anomalyShortcutTargets: ShortcutTarget[];
  additionalAnomalyMatchCount: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects by name or domain"
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={healthFilter} onValueChange={onHealthChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Health States</SelectItem>
              <SelectItem value="good">Good (80+)</SelectItem>
              <SelectItem value="needs_work">Needs Work (60-79)</SelectItem>
              <SelectItem value="poor">Poor (&lt;60)</SelectItem>
              <SelectItem value="in_progress">Crawl In Progress</SelectItem>
              <SelectItem value="failed">Last Crawl Failed</SelectItem>
              <SelectItem value="no_crawl">No Crawls Yet</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activity_desc">Latest Activity</SelectItem>
              <SelectItem value="score_desc">Score: High to Low</SelectItem>
              <SelectItem value="score_asc">Score: Low to High</SelectItem>
              <SelectItem value="name_asc">Name: A to Z</SelectItem>
              <SelectItem value="name_desc">Name: Z to A</SelectItem>
              <SelectItem value="created_desc">Newest Created</SelectItem>
              <SelectItem value="created_asc">Oldest Created</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={onReset}>
            Reset
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {presetButtons.map((preset) => (
            <Button
              key={preset.key}
              size="sm"
              variant={preset.active ? "default" : "outline"}
              onClick={() => onApplyPreset(preset.key)}
            >
              {preset.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={!canSaveDefaultPreset || savingDefaultPreset}
            onClick={onSaveDefaultPreset}
          >
            {savingDefaultPreset ? "Saving..." : "Set As Default View"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {usingAnomalyView && (
            <Badge variant="default">
              anomaly: {anomalyFilter.replace(/_/g, " ")}
            </Badge>
          )}
          <Badge variant="secondary">{totalFiltered} matching</Badge>
          <Badge variant="success">{pageSummary.good} good (page)</Badge>
          <Badge variant="warning">
            {pageSummary.needsWork} needs work (page)
          </Badge>
          <Badge variant="destructive">{pageSummary.poor} poor (page)</Badge>
          <Badge variant="info">
            {pageSummary.inProgress} in progress (page)
          </Badge>
        </div>

        {activeAnomalyShortcut && (
          <div className="rounded-lg border border-dashed p-3">
            <p className="text-sm font-medium">{activeAnomalyShortcut.title}</p>
            <p className="text-xs text-muted-foreground">
              {activeAnomalyShortcut.description}
            </p>
            {anomalyShortcutTargets.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {anomalyShortcutTargets.map((project) => (
                  <Button key={project.id} size="sm" variant="outline" asChild>
                    <Link href={project.href}>
                      {activeAnomalyShortcut.cta}: {project.name}
                    </Link>
                  </Button>
                ))}
                {additionalAnomalyMatchCount > 0 && (
                  <Badge variant="secondary">
                    +{additionalAnomalyMatchCount} more matching projects
                  </Badge>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No projects match this anomaly and search query.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
