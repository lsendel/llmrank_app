"use client";

import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface CrawlStepProps {
  pageLimit: number;
  crawlDepth: number;
  crawlSchedule: "manual" | "daily" | "weekly" | "monthly";
  enablePipeline: boolean;
  enableVisibility: boolean;
  planMaxPages: number;
  onUpdate: (data: Partial<CrawlStepData>) => void;
  onBack: () => void;
  onNext: () => void;
}

interface CrawlStepData {
  pageLimit: number;
  crawlDepth: number;
  crawlSchedule: "manual" | "daily" | "weekly" | "monthly";
  enablePipeline: boolean;
  enableVisibility: boolean;
}

function estimateCrawlTime(pages: number): string {
  const minutes = Math.ceil(pages * 0.5);
  if (minutes < 60) return `~${minutes} min`;
  return `~${Math.round((minutes / 60) * 10) / 10} hr`;
}

export function CrawlStep({
  pageLimit,
  crawlDepth,
  crawlSchedule,
  enablePipeline,
  enableVisibility,
  planMaxPages,
  onUpdate,
  onBack,
  onNext,
}: CrawlStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Crawl Scope</h2>
        <p className="text-sm text-muted-foreground">
          Configure how many pages to crawl and how often.
        </p>
      </div>

      <div className="space-y-6">
        {/* Page limit slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Pages to crawl: {pageLimit}
            </label>
            <span className="text-xs text-muted-foreground">
              {estimateCrawlTime(pageLimit)} estimated
            </span>
          </div>
          <Slider
            value={[pageLimit]}
            onValueChange={([val]) => onUpdate({ pageLimit: val })}
            min={1}
            max={planMaxPages}
            step={planMaxPages <= 10 ? 1 : 10}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>{planMaxPages} (plan max)</span>
          </div>
          {pageLimit >= planMaxPages && (
            <p className="text-xs text-amber-600">
              You&apos;ve reached your plan limit.{" "}
              <a href="/dashboard/billing" className="underline">
                Upgrade
              </a>{" "}
              for more pages.
            </p>
          )}
        </div>

        {/* Crawl depth */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Crawl depth</label>
          <Select
            value={String(crawlDepth)}
            onValueChange={(v) => onUpdate({ crawlDepth: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} level{d > 1 ? "s" : ""} deep
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Schedule */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Crawl schedule</label>
          <Select
            value={crawlSchedule}
            onValueChange={(v) =>
              onUpdate({ crawlSchedule: v as CrawlStepData["crawlSchedule"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual only</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Pipeline toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">AI Analysis Pipeline</p>
            <p className="text-xs text-muted-foreground">
              Run scoring, fix generation, and narrative analysis after crawl
            </p>
          </div>
          <Switch
            checked={enablePipeline}
            onCheckedChange={(v) => onUpdate({ enablePipeline: v })}
          />
        </div>

        {/* Visibility toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">AI Visibility Tracking</p>
            <p className="text-xs text-muted-foreground">
              Check if AI engines cite your content for saved keywords
            </p>
          </div>
          <Switch
            checked={enableVisibility}
            onCheckedChange={(v) => onUpdate({ enableVisibility: v })}
          />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onNext}>Next: Competitors →</Button>
      </div>
    </div>
  );
}
