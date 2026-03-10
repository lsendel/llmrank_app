import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ScoringProfile } from "@/lib/api";
import {
  SCORING_CATEGORIES,
  SCORING_PRESETS,
  type ScoringProfilePreset,
  type ScoringWeightCategory,
} from "./scoring-profile-section-helpers";

type ScoringProfileCardProps = {
  weights: ScoringProfile["weights"];
  preset: ScoringProfilePreset;
  showCustomEditor: boolean;
  saving: boolean;
  total: number;
  isValid: boolean;
  onPresetChange: (preset: Exclude<ScoringProfilePreset, "custom">) => void;
  onToggleCustomEditor: () => void;
  onWeightChange: (category: ScoringWeightCategory, value: number) => void;
  onSave: () => void | Promise<void>;
};

export function ScoringProfileCard({
  weights,
  preset,
  showCustomEditor,
  saving,
  total,
  isValid,
  onPresetChange,
  onToggleCustomEditor,
  onWeightChange,
  onSave,
}: ScoringProfileCardProps) {
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
          {Object.entries(SCORING_PRESETS).map(([key, { label }]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                onPresetChange(key as Exclude<ScoringProfilePreset, "custom">)
              }
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

        <div className="rounded-lg border">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={onToggleCustomEditor}
            aria-expanded={showCustomEditor}
            aria-controls="advanced-weight-editor"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Advanced weight editor</p>
              <p className="text-xs text-muted-foreground">
                Fine-tune category weights for custom scoring models.
              </p>
            </div>
            {showCustomEditor ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {!showCustomEditor && (
            <div className="space-y-2 border-t px-4 py-3">
              {SCORING_CATEGORIES.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono">{weights[key]}%</span>
                </div>
              ))}
            </div>
          )}

          {showCustomEditor && (
            <div
              id="advanced-weight-editor"
              className="space-y-3 border-t px-4 py-4"
            >
              {SCORING_CATEGORIES.map(({ key, label }) => (
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
                    onChange={(event) =>
                      onWeightChange(key, Number(event.target.value))
                    }
                    className="w-full"
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Keep this closed unless you need custom weighting logic. Presets
                are recommended for most teams.
              </p>
            </div>
          )}
        </div>

        {!showCustomEditor && preset !== "custom" && (
          <p className="text-xs text-muted-foreground">
            Using preset:{" "}
            <span className="font-medium">{SCORING_PRESETS[preset].label}</span>
          </p>
        )}

        {!showCustomEditor && preset === "custom" && (
          <p className="text-xs text-muted-foreground">
            Custom profile selected. Reopen Advanced weight editor to adjust.
          </p>
        )}

        <div className="flex items-center justify-between">
          <span
            className={`text-sm ${
              isValid ? "text-muted-foreground" : "font-medium text-destructive"
            }`}
          >
            Total: {total}%{!isValid && " (must equal 100%)"}
          </span>
          <Button onClick={onSave} disabled={!isValid || saving} size="sm">
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
