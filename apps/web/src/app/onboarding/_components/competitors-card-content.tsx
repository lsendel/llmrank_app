"use client";

import * as React from "react";
import { Check, Loader2, Plus, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CompetitorSuggestion } from "@/lib/api";

interface CompetitorsCardContentProps {
  suggestions: CompetitorSuggestion[];
  suggestionsLoading: boolean;
  suggestionsError: string | null;
  selected: string[];
  onToggle: (domain: string) => void;
  onAddManual: (domain: string) => void;
  planLimit: number;
  isFree: boolean;
  onRetry?: () => void;
}

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function CompetitorsCardContent({
  suggestions,
  suggestionsLoading,
  suggestionsError,
  selected,
  onToggle,
  onAddManual,
  planLimit,
  isFree,
  onRetry,
}: CompetitorsCardContentProps) {
  const [showManualInput, setShowManualInput] = React.useState(false);
  const [manualDomain, setManualDomain] = React.useState("");
  const [domainError, setDomainError] = React.useState<string | null>(null);
  const atLimit = selected.length >= planLimit;

  function handleAddManual() {
    const domain = manualDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
    if (!domain) return;
    if (!DOMAIN_RE.test(domain)) {
      setDomainError("Enter a valid domain (e.g. competitor.com)");
      return;
    }
    if (selected.includes(domain)) {
      setDomainError("Already added");
      return;
    }
    setDomainError(null);
    onAddManual(domain);
    setManualDomain("");
    setShowManualInput(false);
  }

  function handleManualKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddManual();
    }
  }

  // Loading state
  if (suggestionsLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding competitors...
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <Skeleton className="h-4 w-4 rounded-sm" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (suggestionsError) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{suggestionsError}</span>
          {onRetry && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRetry}
              className="flex-shrink-0 gap-1 text-destructive hover:text-destructive"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Plan limit indicator */}
      <p className="text-xs text-muted-foreground">
        {selected.length} / {planLimit} selected
        {atLimit && " — upgrade your plan to track more"}
      </p>

      {/* Free plan upgrade CTA */}
      {isFree && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          <p className="font-medium text-primary">
            Upgrade to track competitors
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Competitor tracking is available on Starter plans and above.
          </p>
        </div>
      )}

      {/* Suggestion cards */}
      <div
        className="space-y-2"
        role="group"
        aria-label="Competitor suggestions"
      >
        {suggestions.map((suggestion) => {
          const isSelected = selected.includes(suggestion.domain);
          const isDisabled = isFree || (!isSelected && atLimit);

          return (
            <button
              key={suggestion.domain}
              type="button"
              aria-pressed={isSelected}
              aria-disabled={isDisabled || undefined}
              onClick={() => {
                if (!isDisabled) onToggle(suggestion.domain);
              }}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isDisabled
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-accent/50",
                isSelected && !isDisabled
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                )}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">
                  {suggestion.domain}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {suggestion.reason}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Manual add */}
      {!isFree && (
        <>
          {showManualInput ? (
            <div className="space-y-1">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="competitor.com"
                  value={manualDomain}
                  onChange={(e) => {
                    setManualDomain(e.target.value);
                    setDomainError(null);
                  }}
                  onKeyDown={handleManualKeyDown}
                  disabled={atLimit}
                  aria-label="Competitor domain"
                  aria-invalid={!!domainError}
                  className="h-8 flex-1 text-sm"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddManual}
                  disabled={!manualDomain.trim() || atLimit}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowManualInput(false);
                    setManualDomain("");
                    setDomainError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
              {domainError && (
                <p className="text-xs text-destructive">{domainError}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              disabled={atLimit}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                atLimit
                  ? "cursor-not-allowed opacity-50"
                  : "hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Plus className="h-4 w-4" />
              Add competitor manually...
            </button>
          )}
        </>
      )}
    </div>
  );
}
