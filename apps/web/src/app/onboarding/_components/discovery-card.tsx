"use client";

import * as React from "react";
import { Check, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DiscoveryCardProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  status: "completed" | "active" | "pending" | "locked";
  summary?: string;
  lockedReason?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const borderByStatus = {
  completed: "border-l-4 border-l-green-500",
  active: "border-l-4 border-l-indigo-500",
  pending: "border-l-4 border-l-border",
  locked: "border-l-4 border-l-border",
} as const;

export function DiscoveryCard({
  id,
  title,
  icon,
  status,
  summary,
  lockedReason,
  isOpen,
  onToggle,
  children,
}: DiscoveryCardProps) {
  const headerId = `${id}-header`;
  const regionId = `${id}-region`;
  const isLocked = status === "locked";
  const canToggle = !isLocked;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!canToggle) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  }

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        borderByStatus[status],
        isLocked && "opacity-60",
      )}
    >
      <div
        id={headerId}
        role="button"
        tabIndex={isLocked ? -1 : 0}
        aria-expanded={canToggle ? isOpen : undefined}
        aria-controls={regionId}
        aria-disabled={isLocked || undefined}
        onClick={canToggle ? onToggle : undefined}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-3 p-5 sm:p-6 select-none",
          canToggle && "cursor-pointer",
          isLocked && "cursor-not-allowed",
        )}
      >
        {/* Status icon */}
        <div className="flex-shrink-0">
          {status === "completed" ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/15 text-green-600">
              <Check className="h-4 w-4" />
            </div>
          ) : isLocked ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Lock className="h-4 w-4" />
            </div>
          ) : (
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                status === "active"
                  ? "bg-indigo-500/15 text-indigo-600"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {icon}
            </div>
          )}
        </div>

        {/* Title + summary */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {status === "completed" && summary && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {summary}
            </p>
          )}
          {isLocked && lockedReason && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {lockedReason}
            </p>
          )}
        </div>

        {/* Chevron */}
        {canToggle && (
          <svg
            className={cn(
              "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </div>

      {/* Collapsible content */}
      <div
        id={regionId}
        role="region"
        aria-labelledby={headerId}
        hidden={!isOpen}
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "pb-5 px-5 sm:pb-6 sm:px-6" : "h-0",
        )}
      >
        {isOpen && children}
      </div>
    </Card>
  );
}
