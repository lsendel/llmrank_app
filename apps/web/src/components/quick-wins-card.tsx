"use client";

import { useState, useCallback } from "react";
import {
  Zap,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { AiFixButton } from "@/components/ai-fix-button";

const EFFORT_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Quick Fix", color: "bg-success/10 text-success" },
  medium: { label: "Moderate", color: "bg-warning/10 text-warning" },
  high: { label: "Significant", color: "bg-destructive/10 text-destructive" },
};

export function QuickWinsCard({
  crawlId,
  projectId,
}: {
  crawlId: string;
  projectId?: string;
}) {
  const { data: wins, isLoading: loading } = useApiSWR(
    `quick-wins-${crawlId}`,
    useCallback(() => api.quickWins.get(crawlId), [crawlId]),
  );
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<
    Array<{
      code: string;
      fix: { generatedFix: string } | null;
      error: string | null;
    }>
  >([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleFixAll() {
    if (!projectId) return;
    setBatchLoading(true);
    try {
      const results = await api.fixes.generateBatch({
        projectId,
        crawlId,
      });
      setBatchResults(results);
      setBatchDialogOpen(true);
    } catch (err: unknown) {
      toast({
        title: "Batch fix failed",
        description:
          err instanceof Error ? err.message : "Could not generate fixes",
        variant: "destructive",
      });
    } finally {
      setBatchLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-warning" />
            Quick Wins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!wins || wins.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-warning" />
            Quick Wins
          </CardTitle>
          {projectId && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleFixAll}
              disabled={batchLoading}
              className="gap-1"
            >
              <Sparkles className="h-3 w-3" />
              {batchLoading ? "Generating..." : "Fix All"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {wins.map((win, i) => {
          const effort = EFFORT_LABELS[win.effortLevel] ?? EFFORT_LABELS.medium;
          const isExpanded = expandedCode === win.code;

          return (
            <div
              key={win.code}
              className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/30"
              onClick={() => setExpandedCode(isExpanded ? null : win.code)}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{win.message}</span>
                    <Badge
                      variant="secondary"
                      className={cn("text-xs", effort.color)}
                    >
                      {effort.label}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      +{Math.abs(win.scoreImpact)} pts
                    </Badge>
                    {win.affectedPages > 1 && (
                      <Badge variant="outline" className="text-xs">
                        {win.affectedPages} pages
                      </Badge>
                    )}
                    {projectId && (
                      <span onClick={(e) => e.stopPropagation()}>
                        <AiFixButton
                          projectId={projectId}
                          issueCode={win.code}
                          issueTitle={win.message}
                        />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {win.recommendation}
                  </p>
                  {isExpanded && win.implementationSnippet && (
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                      <code>{win.implementationSnippet}</code>
                    </pre>
                  )}
                </div>
                {win.implementationSnippet && (
                  <div className="flex-shrink-0 text-muted-foreground">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      {/* Batch fix results dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Generated Fixes ({batchResults.filter((r) => r.fix).length}/
              {batchResults.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {batchResults.map((result) => (
              <div key={result.code} className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{result.code}</span>
                  {result.fix && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(result.fix!.generatedFix)
                          .then(() => {
                            setCopiedCode(result.code);
                            setTimeout(() => setCopiedCode(null), 2000);
                          })
                          .catch(() => {
                            toast({
                              title: "Copy failed",
                              description:
                                "Could not copy to clipboard. Try selecting and copying manually.",
                              variant: "destructive",
                            });
                          });
                      }}
                    >
                      {copiedCode === result.code ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiedCode === result.code ? "Copied" : "Copy"}
                    </Button>
                  )}
                </div>
                {result.fix ? (
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                    {result.fix.generatedFix}
                  </pre>
                ) : (
                  <p className="text-xs text-destructive">{result.error}</p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
