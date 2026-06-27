"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type SavedKeyword, type Persona } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { normalizeStringArrayField } from "@/lib/persona-fields";

interface KeywordPickerProps {
  projectId: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

const FUNNEL_LABELS: Record<string, string> = {
  education: "Education",
  comparison: "Comparison",
  purchase: "Purchase",
};

export function KeywordPicker({
  projectId,
  selectedIds,
  onSelectionChange,
}: KeywordPickerProps) {
  const { toast } = useToast();
  const [keywordsOpen, setKeywordsOpen] = useState(true);
  const [personasOpen, setPersonasOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const { data: keywords, mutate: mutateKeywords } = useApiSWR<SavedKeyword[]>(
    `keywords-${projectId}`,
    useCallback(() => api.keywords.list(projectId), [projectId]),
  );

  const { data: personas } = useApiSWR<Persona[]>(
    `personas-${projectId}`,
    useCallback(() => api.personas.list(projectId), [projectId]),
  );

  const toggleKeyword = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((k) => k !== id)
        : [...selectedIds, id],
    );
  };

  const selectAll = () => {
    const allIds = (keywords ?? []).map((k) => k.id);
    onSelectionChange(allIds);
  };

  const clearAll = () => onSelectionChange([]);

  const handleLoadSuggestions = async () => {
    setLoadingSuggestions(true);
    setSuggestionsOpen(true);
    try {
      const result = await api.visibility.suggestKeywords(projectId);
      setSuggestions(result);
    } catch {
      toast({
        title: "Failed to load suggestions",
        variant: "destructive",
      });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAddSuggestion = async (keyword: string) => {
    try {
      await api.keywords.create(projectId, { keyword });
      setSuggestions((prev) => prev.filter((s) => s !== keyword));
      mutateKeywords();
      toast({ title: `Added "${keyword}"` });
    } catch {
      toast({ title: "Failed to add keyword", variant: "destructive" });
    }
  };

  // Persona queries mapped to virtual IDs for selection
  const personaQueries = (personas ?? []).flatMap((p) =>
    normalizeStringArrayField(p.sampleQueries).map((q) => ({
      id: `persona:${p.id}:${q}`,
      keyword: q,
      personaName: p.name,
    })),
  );

  const isEmpty =
    (!keywords || keywords.length === 0) && personaQueries.length === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Select Queries</CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEmpty && (
          <p className="text-sm text-muted-foreground">
            No keywords yet. Click &ldquo;Suggest Queries&rdquo; below to get
            AI-powered suggestions.
          </p>
        )}

        {/* Your Keywords section */}
        {keywords && keywords.length > 0 && (
          <div>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-sm font-medium"
              onClick={() => setKeywordsOpen(!keywordsOpen)}
            >
              {keywordsOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Your Keywords ({keywords.length})
            </button>
            {keywordsOpen && (
              <div className="mt-2 space-y-1.5 pl-5">
                {keywords.map((kw) => (
                  <label
                    key={kw.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(kw.id)}
                      onChange={() => toggleKeyword(kw.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="flex-1">{kw.keyword}</span>
                    {kw.funnelStage && (
                      <Badge variant="secondary" className="text-[10px]">
                        {FUNNEL_LABELS[kw.funnelStage] ?? kw.funnelStage}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Persona Queries section */}
        {personaQueries.length > 0 && (
          <div>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-sm font-medium"
              onClick={() => setPersonasOpen(!personasOpen)}
            >
              {personasOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Persona Queries ({personaQueries.length})
            </button>
            {personasOpen && (
              <div className="mt-2 space-y-1.5 pl-5">
                {personaQueries.map((pq) => (
                  <label
                    key={pq.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(pq.id)}
                      onChange={() => toggleKeyword(pq.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="flex-1">{pq.keyword}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {pq.personaName}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI Suggestions section */}
        <div>
          <button
            type="button"
            className="flex w-full items-center gap-1.5 text-sm font-medium"
            onClick={
              suggestions.length > 0
                ? () => setSuggestionsOpen(!suggestionsOpen)
                : handleLoadSuggestions
            }
          >
            {loadingSuggestions ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : suggestionsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            {suggestions.length > 0
              ? `AI Suggestions (${suggestions.length})`
              : "Suggest Queries"}
          </button>
          {suggestionsOpen && suggestions.length > 0 && (
            <div className="mt-2 space-y-1.5 pl-5">
              {suggestions.map((kw) => (
                <div key={kw} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{kw}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleAddSuggestion(kw)}
                  >
                    + Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selection count */}
        <div className="border-t pt-2 text-xs text-muted-foreground">
          {selectedIds.length} quer{selectedIds.length === 1 ? "y" : "ies"}{" "}
          selected
        </div>
      </CardContent>
    </Card>
  );
}
