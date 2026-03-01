"use client";

import { NarrativeViewer } from "@/components/narrative/narrative-viewer";
import { Brain } from "lucide-react";
import { StateCard } from "@/components/ui/state";

interface AiAnalysisTabProps {
  crawlJobId?: string;
}

export function AiAnalysisTab({ crawlJobId }: AiAnalysisTabProps) {
  if (!crawlJobId) {
    return (
      <StateCard
        variant="empty"
        icon={<Brain className="h-8 w-8 text-muted-foreground" />}
        title="No AI analysis yet"
        description="Run a crawl first to generate AI analysis."
        contentClassName="p-0"
      />
    );
  }

  return <NarrativeViewer crawlJobId={crawlJobId} />;
}
