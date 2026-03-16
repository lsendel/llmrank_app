"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileDown,
  Zap,
  Shield,
  Code,
  Users,
  ListChecks,
  TrendingUp,
} from "lucide-react";

interface ActionItem {
  title: string;
  description: string;
  category: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  quadrant: string;
  estimatedScoreImpact: number;
  affectedPages: number;
  fixSnippet?: string;
  done?: boolean;
}

interface ReportSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string;
  actions?: ActionItem[];
  codeSnippets?: Array<{ label: string; code: string }>;
}

interface UnifiedReportViewProps {
  projectId: string;
  domain: string;
  overallScore: number;
  grade: string;
  sections: ReportSection[];
  onExportPdf: () => void;
}

function impactColor(impact: string) {
  switch (impact) {
    case "high":
      return "text-red-600";
    case "medium":
      return "text-amber-600";
    case "low":
      return "text-green-600";
    default:
      return "text-muted-foreground";
  }
}

function CollapsibleSection({
  section,
  onToggleAction,
}: {
  section: ReportSection;
  onToggleAction?: (index: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function copyToClipboard(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  const completedActions = section.actions?.filter((a) => a.done).length ?? 0;
  const totalActions = section.actions?.length ?? 0;

  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground">{section.icon}</div>
          <span className="font-semibold">{section.title}</span>
          {totalActions > 0 && (
            <Badge variant="secondary" className="text-xs">
              {completedActions}/{totalActions} done
            </Badge>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Narrative content */}
          <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap">
            {section.content}
          </div>

          {/* Code snippets */}
          {section.codeSnippets?.map((snippet, i) => (
            <div key={i} className="relative">
              <div className="flex items-center justify-between rounded-t bg-muted px-3 py-1.5">
                <span className="text-xs font-medium">{snippet.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => copyToClipboard(snippet.code, i)}
                >
                  {copiedIndex === i ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-b bg-muted/50 p-3 text-xs">
                {snippet.code}
              </pre>
            </div>
          ))}

          {/* Action items with checkboxes */}
          {section.actions && section.actions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Action Items</h4>
              {section.actions.map((action, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    action.done ? "opacity-60" : ""
                  }`}
                >
                  <button
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      action.done
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-muted-foreground"
                    }`}
                    onClick={() => onToggleAction?.(i)}
                  >
                    {action.done && <Check className="h-3 w-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${action.done ? "line-through" : ""}`}
                      >
                        {action.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${impactColor(action.impact)}`}
                      >
                        {action.impact} impact
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {action.effort} effort
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {action.description}
                    </p>
                    {action.estimatedScoreImpact > 0 && (
                      <p className="mt-1 text-xs text-green-600">
                        +{action.estimatedScoreImpact} points estimated
                      </p>
                    )}
                    {action.fixSnippet && (
                      <div className="mt-2 relative">
                        <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                          {action.fixSnippet}
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-6 px-2"
                          onClick={() =>
                            copyToClipboard(action.fixSnippet!, i + 100)
                          }
                        >
                          {copiedIndex === i + 100 ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function UnifiedReportView({
  domain,
  overallScore,
  grade,
  sections,
  onExportPdf,
}: UnifiedReportViewProps) {
  const [sectionState, setSectionState] = useState(sections);

  function toggleAction(sectionIndex: number, actionIndex: number) {
    setSectionState((prev) =>
      prev.map((s, si) => {
        if (si !== sectionIndex || !s.actions) return s;
        return {
          ...s,
          actions: s.actions.map((a, ai) =>
            ai === actionIndex ? { ...a, done: !a.done } : a,
          ),
        };
      }),
    );
  }

  const totalActions = sectionState.reduce(
    (sum, s) => sum + (s.actions?.length ?? 0),
    0,
  );
  const completedActions = sectionState.reduce(
    (sum, s) => sum + (s.actions?.filter((a) => a.done).length ?? 0),
    0,
  );
  const progress =
    totalActions > 0 ? (completedActions / totalActions) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Readiness Report</h1>
          <p className="text-sm text-muted-foreground">{domain}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{overallScore}</div>
            <Badge
              variant={overallScore >= 80 ? "default" : "secondary"}
              className="text-xs"
            >
              Grade {grade}
            </Badge>
          </div>
          <Button variant="outline" onClick={onExportPdf}>
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {totalActions > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Action items progress</span>
            <span>
              {completedActions}/{totalActions} completed
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {sectionState.map((section, i) => (
          <CollapsibleSection
            key={section.id}
            section={section}
            onToggleAction={(actionIndex) => toggleAction(i, actionIndex)}
          />
        ))}
      </div>
    </div>
  );
}

// Default section icons for building report sections
export const REPORT_SECTION_ICONS = {
  executive_summary: <TrendingUp className="h-5 w-5" />,
  quick_wins: <Zap className="h-5 w-5" />,
  ai_visibility: <Shield className="h-5 w-5" />,
  structured_data: <Code className="h-5 w-5" />,
  competitive_position: <Users className="h-5 w-5" />,
  action_plan: <ListChecks className="h-5 w-5" />,
};
