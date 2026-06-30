import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type EngineMode = "live_retrieval" | "recall" | null | undefined;

const ENGINE_MODE_COPY: Record<
  "live_retrieval" | "recall",
  { label: string; variant: "success" | "warning"; tip: string }
> = {
  live_retrieval: {
    label: "Live web",
    variant: "success",
    tip: "Grounded on a live web search, so a cited source reflects the real web.",
  },
  recall: {
    label: "Recall",
    variant: "warning",
    tip: "Answered from model memory with no live web search — any cited URL reflects training recall and may be unverified or fabricated.",
  },
};

/**
 * Shows how a visibility check's answer was produced — a live web search vs the
 * model recalling from memory — so a recalled (possibly hallucinated) citation
 * isn't read as a measured fact. Renders nothing for older, untagged rows.
 */
export function EngineModeBadge({ mode }: { mode: EngineMode }) {
  if (mode !== "live_retrieval" && mode !== "recall") return null;
  const { label, variant, tip } = ENGINE_MODE_COPY[mode];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="cursor-help">
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px]">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
