import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreCircle } from "@/components/score-circle";
import { cn, gradeColor, scoreBarColor } from "@/lib/utils";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { ContentRepairEditor } from "./content-repair-editor";
import { useParams } from "next/navigation";

interface PageLlmQualitySectionProps {
  scores: Record<string, number>;
}

const DIMENSIONS = [
  { key: "clarity", label: "Clarity" },
  { key: "authority", label: "Authority" },
  { key: "comprehensiveness", label: "Comprehensiveness" },
  { key: "structure", label: "Structure" },
  { key: "citation_worthiness", label: "Citation Worthiness" },
] as const;

function getTipForDimension(key: string, score: number): string {
  if (score >= 50) return "";

  switch (key) {
    case "authority":
      return "Try citing more reputable external sources or adding author credentials.";
    case "clarity":
      return "Simplify sentence structures and use more bullet points.";
    case "comprehensiveness":
      return "Cover more sub-topics or answer related user questions.";
    case "structure":
      return "Use proper H2/H3 hierarchy and schema markup.";
    case "citation_worthiness":
      return "Include unique data points or original research to be cited.";
    default:
      return "";
  }
}

export function PageLlmQualitySection({ scores }: PageLlmQualitySectionProps) {
  const params = useParams<{ pageId: string }>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedDim, setSelectedDim] = useState<string>("clarity");

  const avg = Math.round(
    DIMENSIONS.reduce((sum, d) => sum + (scores[d.key] ?? 0), 0) /
      DIMENSIONS.length,
  );

  const handleRepair = (dim: string) => {
    const dimScore = scores[dim] ?? 0;
    track("quickwin.clicked", {
      issueCode: dim,
      severity:
        dimScore < 30
          ? "critical"
          : dimScore < 50
            ? "high"
            : dimScore < 70
              ? "medium"
              : "low",
    });
    setSelectedDim(dim);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="flex items-center justify-center p-8">
          <ScoreCircle score={avg} size={140} label="LLM Quality" />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Content Quality Dimensions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {DIMENSIONS.map((dim) => {
              const score = scores[dim.key] ?? 0;
              const tip = getTipForDimension(dim.key, score);

              return (
                <div key={dim.key} className="space-y-1.5 group">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{dim.label}</span>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRepair(dim.key)}
                      >
                        <Sparkles className="mr-1 h-3 w-3 text-primary" />
                        Repair
                      </Button>
                      <span className={cn("font-semibold", gradeColor(score))}>
                        {score} / 100
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        scoreBarColor(score),
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  {tip && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                      <span className="inline-block w-1 h-1 rounded-full bg-amber-600"></span>
                      {tip}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <ContentRepairEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        pageId={params.pageId}
        initialDimension={selectedDim}
      />
    </div>
  );
}
