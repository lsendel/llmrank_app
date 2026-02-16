"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type ScoringProfile } from "@/lib/api";
import { Settings2 } from "lucide-react";

const PRESETS: Record<
  string,
  { label: string; weights: ScoringProfile["weights"] }
> = {
  default: {
    label: "Default",
    weights: { technical: 25, content: 30, aiReadiness: 30, performance: 15 },
  },
  ecommerce: {
    label: "E-commerce",
    weights: { technical: 30, content: 20, aiReadiness: 35, performance: 15 },
  },
  blog: {
    label: "Blog / Content",
    weights: { technical: 15, content: 40, aiReadiness: 30, performance: 15 },
  },
  saas: {
    label: "SaaS",
    weights: { technical: 25, content: 25, aiReadiness: 35, performance: 15 },
  },
  local_business: {
    label: "Local Business",
    weights: { technical: 30, content: 25, aiReadiness: 25, performance: 20 },
  },
};

const CATEGORIES = [
  { key: "technical" as const, label: "Technical SEO" },
  { key: "content" as const, label: "Content Quality" },
  { key: "aiReadiness" as const, label: "AI Readiness" },
  { key: "performance" as const, label: "Performance" },
];

export function ScoringProfileSection({
  projectId: _projectId,
}: {
  projectId: string;
}) {
  const { data: profiles, mutate } = useApiSWR<ScoringProfile[]>(
    `scoring-profiles`,
    useCallback(() => api.scoringProfiles.list(), []),
  );

  const [weights, setWeights] = useState<ScoringProfile["weights"]>(
    PRESETS.default.weights,
  );
  const [preset, setPreset] = useState("default");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const total =
    weights.technical +
    weights.content +
    weights.aiReadiness +
    weights.performance;
  const isValid = total === 100;

  const handlePresetChange = (key: string) => {
    setPreset(key);
    if (key !== "custom" && PRESETS[key]) {
      setWeights({ ...PRESETS[key].weights });
    }
  };

  const handleWeightChange = (
    category: keyof ScoringProfile["weights"],
    value: number,
  ) => {
    setWeights((prev) => ({ ...prev, [category]: value }));
    setPreset("custom");
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const name =
        preset === "custom" ? "Custom Profile" : PRESETS[preset].label;
      const existing = profiles?.find((p) => p.isDefault);
      if (existing) {
        await api.scoringProfiles.update(existing.id, { name, weights });
      } else {
        await api.scoringProfiles.create({ name, weights });
      }
      await mutate();
      toast({ title: "Scoring profile saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4" />
          Scoring Weights
        </CardTitle>
        <CardDescription>
          Customize how your AI readiness score is calculated
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                preset === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
          {preset === "custom" && (
            <span className="rounded-full border border-primary bg-primary px-3 py-1 text-sm text-primary-foreground">
              Custom
            </span>
          )}
        </div>

        <div className="space-y-3">
          {CATEGORIES.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{label}</span>
                <span className="font-mono text-muted-foreground">
                  {weights[key]}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={weights[key]}
                onChange={(e) =>
                  handleWeightChange(key, Number(e.target.value))
                }
                className="w-full"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span
            className={`text-sm ${isValid ? "text-muted-foreground" : "text-destructive font-medium"}`}
          >
            Total: {total}%{!isValid && " (must equal 100%)"}
          </span>
          <Button onClick={handleSave} disabled={!isValid || saving} size="sm">
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
