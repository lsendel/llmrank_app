"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlatformReadinessMatrix } from "@/components/platform-readiness-matrix";
import { ShareOfVoiceChart } from "@/components/share-of-voice-chart";
import { useApi } from "@/lib/use-api";
import { api, ApiError, type VisibilityCheck } from "@/lib/api";

const PROVIDERS = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini", label: "Gemini" },
] as const;

export default function VisibilityTab({
  projectId,
  domain,
  latestCrawlId,
}: {
  projectId: string;
  domain: string;
  latestCrawlId?: string;
}) {
  const { withToken } = useApi();
  const [query, setQuery] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>(
    PROVIDERS.map((p) => p.id),
  );
  const [results, setResults] = useState<VisibilityCheck[]>([]);
  const [history, setHistory] = useState<VisibilityCheck[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    withToken(async (token) => {
      const data = await api.visibility.list(token, projectId);
      setHistory(data);
    })
      .catch(console.error)
      .finally(() => setHistoryLoaded(true));
  }, [withToken, projectId]);

  async function handleRunCheck() {
    if (!query.trim() || selectedProviders.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await withToken(async (token) => {
        const competitorList = competitors
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        const data = await api.visibility.run(token, {
          projectId,
          query: query.trim(),
          providers: selectedProviders,
          competitors: competitorList.length > 0 ? competitorList : undefined,
        });
        setResults(data);
        const updated = await api.visibility.list(token, projectId);
        setHistory(updated);
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to run visibility check.");
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleProvider(id: string) {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform Readiness Matrix */}
      {latestCrawlId && <PlatformReadinessMatrix crawlId={latestCrawlId} />}

      {/* Share of Voice Chart */}
      <ShareOfVoiceChart projectId={projectId} />

      {/* Run Check Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run Visibility Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vis-query">Search Query</Label>
            <Input
              id="vis-query"
              placeholder={`e.g. "best ${domain.split(".")[0]} alternatives"`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vis-competitors">
              Competitor Domains (comma-separated, optional)
            </Label>
            <Input
              id="vis-competitors"
              placeholder="competitor1.com, competitor2.com"
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>LLM Providers</Label>
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <Button
                  key={p.id}
                  variant={
                    selectedProviders.includes(p.id) ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => toggleProvider(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button onClick={handleRunCheck} disabled={loading || !query.trim()}>
            {loading ? "Checking..." : "Run Check"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Results</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((r) => (
              <VisibilityResultCard key={r.id} check={r} />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {historyLoaded && history.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Previous Checks</h3>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Query</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Brand Mentioned</TableHead>
                  <TableHead>URL Cited</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((check) => (
                  <TableRow key={check.id}>
                    <TableCell className="text-sm">
                      {new Date(check.checkedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {check.query}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{check.llmProvider}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          check.brandMentioned ? "success" : "destructive"
                        }
                      >
                        {check.brandMentioned ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={check.urlCited ? "success" : "destructive"}
                      >
                        {check.urlCited ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}

function VisibilityResultCard({ check }: { check: VisibilityCheck }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base capitalize">
            {check.llmProvider}
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant={check.brandMentioned ? "success" : "destructive"}>
              {check.brandMentioned ? "Mentioned" : "Not Mentioned"}
            </Badge>
            <Badge variant={check.urlCited ? "success" : "destructive"}>
              {check.urlCited ? "Cited" : "Not Cited"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {check.citationPosition != null && (
          <p className="text-sm text-muted-foreground">
            Position:{" "}
            <span className="font-medium text-foreground">
              #{check.citationPosition}
            </span>
          </p>
        )}
        {check.responseText && (
          <div className="max-h-40 overflow-y-auto rounded-md bg-muted p-3 text-xs">
            {check.responseText.slice(0, 500)}
            {check.responseText.length > 500 && "..."}
          </div>
        )}
        {check.competitorMentions &&
          (check.competitorMentions as { domain: string; mentioned: boolean }[])
            .length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Competitors
              </p>
              <div className="flex flex-wrap gap-1">
                {(
                  check.competitorMentions as {
                    domain: string;
                    mentioned: boolean;
                    position: number | null;
                  }[]
                ).map((comp) => (
                  <Badge
                    key={comp.domain}
                    variant={comp.mentioned ? "warning" : "secondary"}
                  >
                    {comp.domain}:{" "}
                    {comp.mentioned
                      ? `Found (#${comp.position ?? "?"})`
                      : "Not found"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
