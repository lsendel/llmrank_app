"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Search, Users, Zap, Loader2 } from "lucide-react";

interface LaunchStepProps {
  name: string;
  domain: string;
  keywordCount: number;
  pageLimit: number;
  crawlDepth: number;
  crawlSchedule: string;
  enablePipeline: boolean;
  enableVisibility: boolean;
  competitorCount: number;
  launching: boolean;
  onBack: () => void;
  onLaunch: () => void;
}

export function LaunchStep({
  name,
  domain,
  keywordCount,
  pageLimit,
  crawlDepth,
  crawlSchedule,
  enablePipeline,
  enableVisibility,
  competitorCount,
  launching,
  onBack,
  onLaunch,
}: LaunchStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review & Launch</h2>
        <p className="text-sm text-muted-foreground">
          Everything looks good? Start your first crawl.
        </p>
      </div>

      <div className="space-y-3">
        <SummaryRow
          icon={<Globe className="h-4 w-4" />}
          label="Project"
          value={`${name} (${domain})`}
        />
        <SummaryRow
          icon={<Search className="h-4 w-4" />}
          label="Keywords"
          value={`${keywordCount} keywords tracked`}
        />
        <SummaryRow
          icon={<Zap className="h-4 w-4" />}
          label="Crawl Scope"
          value={`${pageLimit} pages, ${crawlDepth} levels deep, ${crawlSchedule}`}
        />
        <SummaryRow
          icon={<Users className="h-4 w-4" />}
          label="Competitors"
          value={`${competitorCount} selected`}
        />

        <div className="flex gap-2 pt-2">
          {enablePipeline && (
            <Badge variant="secondary">AI Analysis Pipeline</Badge>
          )}
          {enableVisibility && (
            <Badge variant="secondary">Visibility Tracking</Badge>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={launching}>
          ← Back
        </Button>
        <Button onClick={onLaunch} disabled={launching}>
          {launching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating project...
            </>
          ) : (
            "Start Crawl"
          )}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
