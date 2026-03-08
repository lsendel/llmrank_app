import {
  Users,
  Target,
  Plus,
  Trash2,
  Sparkles,
  Search,
  Route,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StateMessage } from "@/components/ui/state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StrategyCompetitor, StrategyPersona } from "@/lib/api";

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export function DemandModelFlowSection({
  persistedPersonaCount,
  savedKeywordCount,
  competitorCount,
  visibilityScheduleCount,
  discoveringKeywords,
  acceptingKeywords,
  addingRecommendedCompetitors,
  runningDemandFlow,
  keywordSuggestions,
  selectedSuggestions,
  recommendedCompetitorDomains,
  onDiscoverKeywords,
  onAcceptKeywords,
  onAcceptRecommendedCompetitors,
  onRunDemandFlow,
  onToggleSuggestion,
}: {
  persistedPersonaCount: number;
  savedKeywordCount: number;
  competitorCount: number;
  visibilityScheduleCount: number;
  discoveringKeywords: boolean;
  acceptingKeywords: boolean;
  addingRecommendedCompetitors: boolean;
  runningDemandFlow: boolean;
  keywordSuggestions: string[];
  selectedSuggestions: string[];
  recommendedCompetitorDomains: string[];
  onDiscoverKeywords: () => void;
  onAcceptKeywords: () => void;
  onAcceptRecommendedCompetitors: () => void;
  onRunDemandFlow: () => void;
  onToggleSuggestion: (keyword: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5 text-primary" />
          Demand Model Flow
        </CardTitle>
        <CardDescription>
          One guided flow: discover personas, accept keywords, map competitors,
          and schedule recurring visibility checks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Personas" value={persistedPersonaCount} />
          <MetricCard label="Keywords" value={savedKeywordCount} />
          <MetricCard label="Competitors" value={competitorCount} />
          <MetricCard label="Schedules" value={visibilityScheduleCount} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onDiscoverKeywords}
            disabled={discoveringKeywords}
          >
            {discoveringKeywords ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-4 w-4" />
            )}
            Suggest Keywords
          </Button>
          <Button
            variant="outline"
            onClick={onAcceptKeywords}
            disabled={acceptingKeywords || selectedSuggestions.length === 0}
          >
            {acceptingKeywords ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
            )}
            Accept All Recommended
          </Button>
          <Button
            variant="outline"
            onClick={onAcceptRecommendedCompetitors}
            disabled={
              addingRecommendedCompetitors ||
              recommendedCompetitorDomains.length === 0
            }
          >
            {addingRecommendedCompetitors ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Target className="mr-1.5 h-4 w-4" />
            )}
            Add Recommended Competitors
          </Button>
          <Button onClick={onRunDemandFlow} disabled={runningDemandFlow}>
            {runningDemandFlow ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Route className="mr-1.5 h-4 w-4" />
            )}
            Run Guided Setup
          </Button>
        </div>

        {keywordSuggestions.length > 0 && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Suggested Keywords (deduped against existing list)
            </p>
            <div className="flex flex-wrap gap-2">
              {keywordSuggestions.slice(0, 12).map((keyword) => {
                const selected = selectedSuggestions.includes(keyword);
                return (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => onToggleSuggestion(keyword)}
                  >
                    <Badge variant={selected ? "default" : "outline"}>
                      {keyword}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {recommendedCompetitorDomains.length > 0 && (
          <div className="rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Recommended competitor domains from visibility gaps
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recommendedCompetitorDomains.map((domain) => (
                <Badge key={domain} variant="outline">
                  {domain}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CompetitorTrackingSection({
  competitors,
  newCompDomain,
  addingComp,
  onNewCompDomainChange,
  onAddCompetitor,
  onRemoveCompetitor,
}: {
  competitors: StrategyCompetitor[] | undefined;
  newCompDomain: string;
  addingComp: boolean;
  onNewCompDomainChange: (value: string) => void;
  onAddCompetitor: () => void;
  onRemoveCompetitor: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Competitor Tracking
        </CardTitle>
        <CardDescription>
          Track up to 5 competitors to compare AI visibility and content gaps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="competitor.com"
            value={newCompDomain}
            onChange={(e) => onNewCompDomainChange(e.target.value)}
          />
          <Button onClick={onAddCompetitor} disabled={addingComp}>
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
                onClick={() => onRemoveCompetitor(comp.id)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          {competitors?.length === 0 && (
            <StateMessage
              variant="empty"
              compact
              title="No competitors added yet"
              description="Add at least one competitor domain to compare visibility and content coverage."
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PersonaDiscoverySection({
  personas,
  generating,
  onGeneratePersonas,
}: {
  personas: StrategyPersona[];
  generating: boolean;
  onGeneratePersonas: () => void;
}) {
  return (
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
          <StateMessage
            variant="empty"
            icon={<Users className="h-12 w-12 text-muted-foreground/50" />}
            title="No personas discovered yet"
            description="Generate research-backed personas based on your niche."
            action={
              <Button onClick={onGeneratePersonas} disabled={generating}>
                {generating ? "Researching..." : "Discover Personas"}
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {personas.map((persona, index) => (
              <Card key={index} className="bg-background">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{persona.name}</CardTitle>
                    <Badge variant="outline">{persona.role}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {persona.demographics}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Goals
                    </p>
                    <ul className="list-inside list-disc text-xs">
                      {persona.goals.map((goal, goalIndex) => (
                        <li key={goalIndex}>{goal}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Typical AI Queries
                    </p>
                    <div className="mt-1 space-y-1">
                      {persona.typicalQueries.map((query, queryIndex) => (
                        <div
                          key={queryIndex}
                          className="flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-[10px]"
                        >
                          <Search className="h-3 w-3" />
                          {query}
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
              onClick={onGeneratePersonas}
              disabled={generating}
            >
              Regenerate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
