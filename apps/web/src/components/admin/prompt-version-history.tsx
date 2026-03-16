"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Clock, Archive } from "lucide-react";
import type { PromptTemplate } from "./prompt-editor";

interface PromptVersionHistoryProps {
  versions: PromptTemplate[];
  currentId: string;
  onSelect: (id: string) => void;
  onActivate: (id: string) => void;
}

export function PromptVersionHistory({
  versions,
  currentId,
  onSelect,
  onActivate,
}: PromptVersionHistoryProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Version History</h3>
      <div className="space-y-1">
        {versions.map((v) => (
          <div
            key={v.id}
            className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
              v.id === currentId
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            }`}
            onClick={() => onSelect(v.id)}
          >
            <div className="flex items-center gap-2">
              {v.status === "active" ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : v.status === "archived" ? (
                <Archive className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Clock className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-sm font-medium">v{v.version}</span>
              <Badge
                variant={v.status === "active" ? "default" : "secondary"}
                className="text-xs"
              >
                {v.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {new Date(v.createdAt).toLocaleDateString()}
              </span>
              {v.status !== "active" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onActivate(v.id);
                  }}
                >
                  Activate
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
