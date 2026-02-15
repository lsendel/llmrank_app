"use client";

import { useCallback, useState } from "react";
import { Users, Target, Plus, Trash2, Sparkles, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api, type StrategyPersona, type StrategyCompetitor } from "@/lib/api";
import { TopicClusterGraph } from "../strategy/topic-cluster-graph";
import { CrawlerTimelineChart } from "@/components/charts/crawler-timeline-chart";

export function StrategyTab({ projectId }: { projectId: string }) {
  const { withToken } = useApi();

  const [generating, setGenerating] = useState(false);
  const [personas, setPersonas] = useState<StrategyPersona[]>([]);
  const [addingComp, setAddingComp] = useState(false);
  const [newCompDomain, setNewCompDomain] = useState("");

  const { data: topicMap } = useApiSWR(
    `topic-map-${projectId}`,
    useCallback(
      (token: string) => api.strategy.getTopicMap(token, projectId),
      [projectId],
    ),
  );

  const { data: competitors, mutate: mutateComps } = useApiSWR<
    StrategyCompetitor[]
  >(
    `competitors-${projectId}`,
    useCallback(
      (token: string) => api.strategy.getCompetitors(token, projectId),
      [projectId],
    ),
  );

  async function handleGeneratePersonas() {
    setGenerating(true);
    try {
      const data = await withToken((token) =>
        api.strategy.generatePersonas(token, projectId, {
          niche: "AI SEO and Content Optimization",
        }),
      );
      setPersonas(data as StrategyPersona[]);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddCompetitor() {
    if (!newCompDomain) return;
    setAddingComp(true);
    try {
      await withToken((token) =>
        api.strategy.addCompetitor(token, projectId, newCompDomain),
      );
      setNewCompDomain("");
      mutateComps();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingComp(false);
    }
  }

  async function handleRemoveCompetitor(id: string) {
    try {
      await withToken((token) => api.strategy.removeCompetitor(token, id));
      mutateComps();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-8">
      {/* AI Crawler Timeline */}
      <CrawlerTimelineChart projectId={projectId} />

      {/* Topic Cluster Map */}
      {topicMap && <TopicClusterGraph data={topicMap} />}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Competitor Tracking */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Competitor Tracking
              </CardTitle>
              <CardDescription>
                Track up to 5 competitors to compare AI visibility and content
                gaps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="competitor.com"
                  value={newCompDomain}
                  onChange={(e) => setNewCompDomain(e.target.value)}
                />
                <Button onClick={handleAddCompetitor} disabled={addingComp}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {competitors?.map((comp) => (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="font-medium">{comp.domain}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCompetitor(comp.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                {competitors?.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No competitors added yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Persona Finder */}
        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Persona Discovery
              </CardTitle>
              <CardDescription>
                AI-powered identification of your ideal target audience
              </CardDescription>
            </CardHeader>
            <CardContent>
              {personas.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                  <p className="mb-4 text-sm text-muted-foreground">
                    Generate research-backed personas based on your niche.
                  </p>
                  <Button
                    onClick={handleGeneratePersonas}
                    disabled={generating}
                  >
                    {generating ? "Researching..." : "Discover Personas"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {personas.map((p, i) => (
                    <Card key={i} className="bg-background">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{p.name}</CardTitle>
                          <Badge variant="outline">{p.role}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.demographics}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Goals
                          </p>
                          <ul className="list-inside list-disc text-xs">
                            {p.goals.map((g: string, j: number) => (
                              <li key={j}>{g}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Typical AI Queries
                          </p>
                          <div className="mt-1 space-y-1">
                            {p.typicalQueries.map((q: string, j: number) => (
                              <div
                                key={j}
                                className="flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-[10px]"
                              >
                                <Search className="h-3 w-3" />
                                {q}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleGeneratePersonas}
                    disabled={generating}
                  >
                    Regenerate
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
