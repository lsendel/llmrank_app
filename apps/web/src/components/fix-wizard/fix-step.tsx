"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FixStepProps {
  stepNumber: number;
  title: string;
  description: string;
  codeSnippet?: string;
  language?: string;
  tip?: string;
  docsUrl?: string;
}

export function FixStep({
  stepNumber,
  title,
  description,
  codeSnippet,
  language,
  tip,
  docsUrl,
}: FixStepProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!codeSnippet) return;
    navigator.clipboard.writeText(codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {stepNumber}
        </div>
        <div className="flex-1 space-y-2">
          <h4 className="font-medium leading-tight">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>

          {codeSnippet && (
            <div className="relative">
              <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 text-xs">
                <code>{codeSnippet}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 w-7 p-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              {language && (
                <span className="absolute bottom-1 right-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {language}
                </span>
              )}
            </div>
          )}

          {tip && (
            <div className="rounded-md border-l-2 border-blue-400 bg-blue-50/50 py-1.5 pl-3 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
              {tip}
            </div>
          )}

          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Documentation
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
