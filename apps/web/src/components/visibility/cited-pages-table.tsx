"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type CitedPage } from "@/lib/api";
import { ExternalLink, FileText } from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  gemini_ai_mode: "AI Search",
  grok: "Grok",
};

export function CitedPagesTable({ projectId }: { projectId: string }) {
  const { data: citedPages, isLoading } = useApiSWR<CitedPage[]>(
    `cited-pages-${projectId}`,
    useCallback(() => api.visibility.getCitedPages(projectId), [projectId]),
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cited Pages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!citedPages || citedPages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cited Pages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No citations found yet. Run visibility checks to see which of your
              pages AI platforms reference.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Cited Pages
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({citedPages.length} page{citedPages.length !== 1 ? "s" : ""})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page URL</TableHead>
              <TableHead className="text-center">Times Cited</TableHead>
              <TableHead>Platforms</TableHead>
              <TableHead className="text-center">Avg Position</TableHead>
              <TableHead>Last Cited</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {citedPages.map((page) => (
              <TableRow key={page.citedUrl}>
                <TableCell className="max-w-[300px]">
                  <a
                    href={page.citedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <span className="truncate">
                      {page.citedUrl.replace(/^https?:\/\/(www\.)?/, "")}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-medium">{page.citationCount}</span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {page.providers.map((provider) => (
                      <Badge
                        key={provider}
                        variant="secondary"
                        className="text-xs"
                      >
                        {PROVIDER_LABELS[provider] ?? provider}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {page.avgPosition != null ? (
                    <span className="font-medium">#{page.avgPosition}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(page.lastCited).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
