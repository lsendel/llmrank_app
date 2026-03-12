"use client";

import * as React from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PERSONA_SUGGESTIONS: Record<
  string,
  Array<{ label: string; role: string; jobToBeDone: string }>
> = {
  own_site_optimization: [
    {
      label: "Marketing Manager",
      role: "Marketing Manager",
      jobToBeDone: "Evaluating SEO tools for team adoption",
    },
    {
      label: "Startup Founder",
      role: "Startup Founder",
      jobToBeDone: "Growing organic traffic on a budget",
    },
    {
      label: "Content Strategist",
      role: "Content Strategist",
      jobToBeDone: "Creating AI-optimized content",
    },
  ],
  client_reporting: [
    {
      label: "Agency Owner",
      role: "Agency Owner",
      jobToBeDone: "Providing AI readiness reports to clients",
    },
    {
      label: "SEO Specialist",
      role: "SEO Specialist",
      jobToBeDone: "Running AI readiness audits",
    },
    {
      label: "Account Manager",
      role: "Account Manager",
      jobToBeDone: "Presenting competitive analysis to clients",
    },
  ],
  technical_audit: [
    {
      label: "Developer / Engineer",
      role: "Developer",
      jobToBeDone: "Implementing technical SEO fixes",
    },
    {
      label: "Technical SEO",
      role: "Technical SEO Lead",
      jobToBeDone: "Auditing crawlability and structured data",
    },
    {
      label: "DevOps / Platform",
      role: "DevOps Engineer",
      jobToBeDone: "Optimizing site performance and indexing",
    },
  ],
};

interface PersonasCardContentProps {
  workStyle: string | null;
  selectedPersonas: Array<{ label: string; role: string; custom: boolean }>;
  onToggle: (persona: { label: string; role: string; custom: boolean }) => void;
  onAddCustom: (persona: { label: string; role: string }) => void;
}

export function PersonasCardContent({
  workStyle,
  selectedPersonas,
  onToggle,
  onAddCustom,
}: PersonasCardContentProps) {
  const [showCustomForm, setShowCustomForm] = React.useState(false);
  const [customLabel, setCustomLabel] = React.useState("");
  const [customRole, setCustomRole] = React.useState("");

  const suggestions =
    PERSONA_SUGGESTIONS[workStyle ?? ""] ??
    PERSONA_SUGGESTIONS.own_site_optimization;

  function isSelected(label: string) {
    return selectedPersonas.some((p) => p.label === label);
  }

  function handleAddCustom() {
    const trimmedLabel = customLabel.trim();
    const trimmedRole = customRole.trim();
    if (!trimmedLabel || !trimmedRole) return;
    onAddCustom({ label: trimmedLabel, role: trimmedRole });
    setCustomLabel("");
    setCustomRole("");
    setShowCustomForm(false);
  }

  function handleCustomKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustom();
    }
  }

  return (
    <div className="space-y-3">
      {/* Suggestion cards */}
      <div className="space-y-2" role="group" aria-label="Persona suggestions">
        {suggestions.map((persona) => {
          const selected = isSelected(persona.label);
          return (
            <button
              key={persona.label}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onToggle({
                  label: persona.label,
                  role: persona.role,
                  custom: false,
                })
              }
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                )}
              >
                {selected && <Check className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">
                  {persona.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {persona.role} &middot; {persona.jobToBeDone}
                </p>
              </div>
            </button>
          );
        })}

        {/* Custom personas already added */}
        {selectedPersonas
          .filter((p) => p.custom)
          .map((persona) => (
            <button
              key={persona.label}
              type="button"
              aria-pressed={true}
              onClick={() => onToggle(persona)}
              className="flex w-full items-start gap-3 rounded-lg border border-primary bg-primary/5 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground transition-colors">
                <Check className="h-3 w-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">
                  {persona.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {persona.role} &middot; Custom persona
                </p>
              </div>
            </button>
          ))}
      </div>

      {/* Add custom persona */}
      {showCustomForm ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="custom-persona-name" className="text-xs">
              Persona name
            </Label>
            <Input
              id="custom-persona-name"
              placeholder="e.g., Product Manager"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-persona-role" className="text-xs">
              Role
            </Label>
            <Input
              id="custom-persona-role"
              placeholder="e.g., Product Manager"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={handleAddCustom}
              disabled={!customLabel.trim() || !customRole.trim()}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCustomForm(false);
                setCustomLabel("");
                setCustomRole("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCustomForm(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Describe a custom persona...
        </button>
      )}
    </div>
  );
}
