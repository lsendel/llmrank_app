"use client";

import { NarrativeViewer } from "@/components/narrative/narrative-viewer";
import { Brain } from "lucide-react";

interface AiAnalysisTabProps {
  crawlJobId?: string;
}

export function AiAnalysisTab({ crawlJobId }: AiAnalysisTabProps) {
  if (!crawlJobId) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center">
        <Brain className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">
          Run a crawl first to generate AI analysis.
        </p>
      </div>
    );
  }

  return <NarrativeViewer crawlJobId={crawlJobId} />;
}
