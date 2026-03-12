"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MAX_KEYWORDS = 20;

interface KeywordsCardContentProps {
  keywords: string[];
  onAdd: (keyword: string) => void;
  onRemove: (keyword: string) => void;
}

export function KeywordsCardContent({
  keywords,
  onAdd,
  onRemove,
}: KeywordsCardContentProps) {
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const atLimit = keywords.length >= MAX_KEYWORDS;

  function addKeyword(raw: string) {
    const keyword = raw.trim().toLowerCase();
    if (!keyword) return;
    if (keywords.includes(keyword)) return;
    if (atLimit) return;
    onAdd(keyword);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const parts = inputValue.split(",");
      for (const part of parts) {
        addKeyword(part);
      }
      setInputValue("");
    }

    // Backspace on empty input removes last keyword
    if (e.key === "Backspace" && !inputValue && keywords.length > 0) {
      onRemove(keywords[keywords.length - 1]);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    // If pasting with commas, split immediately
    if (val.includes(",")) {
      const parts = val.split(",");
      for (const part of parts.slice(0, -1)) {
        addKeyword(part);
      }
      setInputValue(parts[parts.length - 1]);
    } else {
      setInputValue(val);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Input
          ref={inputRef}
          type="text"
          placeholder={
            atLimit
              ? `Maximum ${MAX_KEYWORDS} keywords reached`
              : "Type a keyword and press Enter"
          }
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={atLimit}
          aria-label="Add keyword"
          aria-describedby="keywords-hint"
          className="text-sm"
        />
        <p id="keywords-hint" className="mt-1.5 text-xs text-muted-foreground">
          {keywords.length} / {MAX_KEYWORDS} keywords
          {keywords.length === 0 && " — separate with Enter or comma"}
        </p>
      </div>

      {keywords.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          role="list"
          aria-label="Added keywords"
        >
          {keywords.map((keyword) => (
            <Badge
              key={keyword}
              variant="secondary"
              className="gap-1 pr-1"
              role="listitem"
            >
              <span className="max-w-[180px] truncate">{keyword}</span>
              <button
                type="button"
                onClick={() => onRemove(keyword)}
                aria-label={`Remove ${keyword}`}
                className={cn(
                  "ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                  "hover:bg-foreground/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
