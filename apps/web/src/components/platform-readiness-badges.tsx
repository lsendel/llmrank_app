"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type PlatformReadinessResult } from "@/lib/api";

const PLATFORM_ICONS: Record<string, string> = {
  ChatGPT: "\u{1F916}",
  Claude: "\u{1F7E0}",
  Perplexity: "\u{1F50D}",
  Gemini: "\u{1F48E}",
  "Gemini AI Mode": "\u2728",
  Copilot: "\u{1F537}",
  Grok: "\u26A1",
};

function gradeColor(grade: string) {
  if (grade === "A") return "text-success";
  if (grade === "B") return "text-success/80";
  if (grade === "C") return "text-warning";
  return "text-destructive";
}

export function PlatformReadinessBadges({ crawlId }: { crawlId: string }) {
  const { data: matrix } = useApiSWR<PlatformReadinessResult[]>(
    `platform-readiness-${crawlId}`,
    useCallback(() => api.platformReadiness.get(crawlId), [crawlId]),
  );

  if (!matrix || matrix.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {matrix.map((p) => (
        <div
          key={p.platform}
          className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
        >
          <span>{PLATFORM_ICONS[p.platform] ?? "\u{1F539}"}</span>
          <span className="font-medium">{p.platform}</span>
          <span className={cn("font-bold", gradeColor(p.grade))}>
            {p.grade}
          </span>
        </div>
      ))}
    </div>
  );
}
