"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type IssueHeatmapData } from "@/lib/api";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-400",
  info: "bg-blue-400",
  pass: "bg-green-200 dark:bg-green-900",
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Tech",
  content: "Content",
  ai_readiness: "AI",
  performance: "Perf",
  schema: "Schema",
  llm_visibility: "LLM",
};

export function IssueHeatmap({
  crawlId,
  projectId,
}: {
  crawlId: string;
  projectId: string;
}) {
  const { data: heatmap, isLoading } = useApiSWR<IssueHeatmapData>(
    `issue-heatmap-${crawlId}`,
    useCallback(
      (token: string) => api.crawls.getIssueHeatmap(token, crawlId),
      [crawlId],
    ),
  );

  if (isLoading || !heatmap || heatmap.pages.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Grid3x3 className="h-4 w-4" />
          Issue Heatmap
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            Top {heatmap.pages.length} pages by issue count
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground pb-2 pr-4 min-w-[200px]">
                Page
              </th>
              {heatmap.categories.map((cat) => (
                <th
                  key={cat}
                  className="text-center font-medium text-muted-foreground pb-2 px-1 min-w-[50px]"
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.pages.map((page) => (
              <tr key={page.pageId} className="border-t border-border">
                <td className="py-1.5 pr-4 truncate max-w-[250px]">
                  <Link
                    href={`/dashboard/projects/${projectId}/pages/${page.pageId}`}
                    className="hover:underline text-foreground"
                  >
                    {new URL(page.url).pathname}
                  </Link>
                </td>
                {heatmap.categories.map((cat) => (
                  <td key={cat} className="py-1.5 px-1 text-center">
                    <div
                      className={cn(
                        "mx-auto h-4 w-4 rounded-sm",
                        SEVERITY_STYLES[page.issues[cat] ?? "pass"],
                      )}
                      title={`${cat}: ${page.issues[cat] ?? "pass"}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
