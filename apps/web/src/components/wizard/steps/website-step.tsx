"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";

interface KeywordItem {
  keyword: string;
  source: "ai" | "extracted" | "user";
}

interface WebsiteStepProps {
  name: string;
  domain: string;
  keywords: KeywordItem[];
  onUpdate: (data: {
    name?: string;
    domain?: string;
    keywords?: KeywordItem[];
  }) => void;
  onNext: () => void;
}

export function WebsiteStep({
  name,
  domain,
  keywords,
  onUpdate,
  onNext,
}: WebsiteStepProps) {
  const [extracting, setExtracting] = useState(false);
  const [customKeyword, setCustomKeyword] = useState("");

  async function handleExtract() {
    if (!domain) return;
    setExtracting(true);
    try {
      const data = await api.wizard.extractKeywords(domain);
      const extracted = data.extracted ?? [];
      const aiSuggested = data.aiSuggested ?? [];
      onUpdate({
        keywords: [
          ...extracted.slice(0, 5),
          ...aiSuggested.slice(0, 10),
        ],
      });
    } finally {
      setExtracting(false);
    }
  }

  function addCustom() {
    if (!customKeyword.trim()) return;
    onUpdate({
      keywords: [
        ...keywords,
        { keyword: customKeyword.trim(), source: "user" },
      ],
    });
    setCustomKeyword("");
  }

  function removeKeyword(index: number) {
    onUpdate({ keywords: keywords.filter((_, i) => i !== index) });
  }

  const isValid = name.trim() && domain.trim();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Your Website</h2>
        <p className="text-sm text-muted-foreground">
          Enter your domain and we&apos;ll extract keywords automatically.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Project Name</label>
          <Input
            value={name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="My Website"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Domain</label>
          <div className="flex gap-2">
            <Input
              value={domain}
              onChange={(e) => onUpdate({ domain: e.target.value })}
              placeholder="example.com"
              onBlur={() => domain && keywords.length === 0 && handleExtract()}
            />
            <Button
              variant="outline"
              onClick={handleExtract}
              disabled={!domain || extracting}
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Extract
            </Button>
          </div>
        </div>

        {keywords.length > 0 && (
          <div>
            <label className="text-sm font-medium">
              Keywords ({keywords.length}/15)
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {keywords.map((kw, i) => (
                <Badge
                  key={`${kw.keyword}-${i}`}
                  variant={kw.source === "ai" ? "secondary" : "default"}
                  className="flex items-center gap-1"
                >
                  {kw.source === "ai" && <Sparkles className="h-3 w-3" />}
                  {kw.keyword}
                  <button onClick={() => removeKeyword(i)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Add your own query</label>
          <p className="text-xs text-muted-foreground mb-2">
            What would someone ask an AI assistant when looking for your product?
          </p>
          <div className="flex gap-2">
            <Input
              value={customKeyword}
              onChange={(e) => setCustomKeyword(e.target.value)}
              placeholder='e.g. "best home care agency near me"'
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <Button
              variant="outline"
              onClick={addCustom}
              disabled={!customKeyword.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!isValid}>
          Next: Crawl Scope →
        </Button>
      </div>
    </div>
  );
}
