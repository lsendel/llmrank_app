"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, Globe } from "lucide-react";
import { api } from "@/lib/api";

interface CompetitorItem {
  domain: string;
  reason?: string;
  selected: boolean;
}

interface CompetitorsStepProps {
  domain: string;
  keywords: string[];
  competitors: CompetitorItem[];
  maxCompetitors: number;
  onUpdate: (competitors: CompetitorItem[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export function CompetitorsStep({
  domain,
  keywords,
  competitors,
  maxCompetitors,
  onUpdate,
  onBack,
  onNext,
}: CompetitorsStepProps) {
  const [discovering, setDiscovering] = useState(false);
  const [manualDomain, setManualDomain] = useState("");
  const [hasDiscovered, setHasDiscovered] = useState(competitors.length > 0);

  const selectedCount = competitors.filter((c) => c.selected).length;

  useEffect(() => {
    if (!hasDiscovered && domain && keywords.length > 0) {
      discoverCompetitors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function discoverCompetitors() {
    setDiscovering(true);
    try {
      const data = await api.wizard.suggestCompetitors(domain, keywords);
      onUpdate(
        data.competitors.map((c) => ({
          domain: c.domain,
          reason: c.reason,
          selected: false,
        })),
      );
      setHasDiscovered(true);
    } finally {
      setDiscovering(false);
    }
  }

  function toggleCompetitor(index: number) {
    const updated = competitors.map((c, i) => {
      if (i !== index) return c;
      if (!c.selected && selectedCount >= maxCompetitors) return c;
      return { ...c, selected: !c.selected };
    });
    onUpdate(updated);
  }

  function addManual() {
    if (!manualDomain.trim()) return;
    onUpdate([...competitors, { domain: manualDomain.trim(), selected: true }]);
    setManualDomain("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Competitors</h2>
        <p className="text-sm text-muted-foreground">
          Select competitors to track in AI visibility comparisons.
        </p>
      </div>

      {discovering ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Discovering competitors...
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            {selectedCount}/{maxCompetitors} competitors selected
          </div>

          <div className="space-y-2">
            {competitors.map((comp, i) => (
              <div
                key={comp.domain}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <Checkbox
                  checked={comp.selected}
                  onCheckedChange={() => toggleCompetitor(i)}
                  disabled={!comp.selected && selectedCount >= maxCompetitors}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{comp.domain}</span>
                  </div>
                  {comp.reason && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {comp.reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={manualDomain}
              onChange={(e) => setManualDomain(e.target.value)}
              placeholder="Add competitor domain..."
              onKeyDown={(e) => e.key === "Enter" && addManual()}
            />
            <Button
              variant="outline"
              onClick={addManual}
              disabled={!manualDomain.trim()}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onNext}>Next: Review & Launch →</Button>
      </div>
    </div>
  );
}
