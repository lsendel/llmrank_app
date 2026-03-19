"use client";

import { useState } from "react";
import { Check, Copy, Code } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { SnippetInstallGuides } from "@/components/snippet-install-guides";

interface SnippetSettingsSectionProps {
  projectId: string;
  snippetEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function SnippetSettingsSection({
  projectId,
  snippetEnabled,
  onToggle,
}: SnippetSettingsSectionProps) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  const snippetCode = `<script defer src="https://api.llmrank.app/s/analytics.js" data-project="${projectId}"></script>`;

  async function handleToggle(checked: boolean) {
    setToggling(true);
    try {
      await api.projects.update(projectId, {
        analyticsSnippetEnabled: checked,
      });
      onToggle(checked);
    } catch {
      // revert on failure
    } finally {
      setToggling(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(snippetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Code className="h-4 w-4" />
          AI Traffic Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id="snippet-toggle"
            checked={snippetEnabled}
            onCheckedChange={(checked) => handleToggle(checked === true)}
            disabled={toggling}
          />
          <Label htmlFor="snippet-toggle">Enable tracking snippet</Label>
        </div>

        {snippetEnabled && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Add this snippet to your site&apos;s &lt;head&gt; to track AI
              traffic.
            </p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-xs">
                {snippetCode}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>

            <SnippetInstallGuides />

            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2 dark:border-blue-800 dark:bg-blue-950/30">
              <p className="text-xs font-medium">
                Cloudflare Auto-Inject (no code changes)
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to your Cloudflare dashboard → your site → Zaraz</li>
                <li>
                  Click &quot;Add new tool&quot; → &quot;Custom HTML&quot;
                </li>
                <li>Paste the snippet code above</li>
                <li>
                  Set firing trigger to &quot;Page Load&quot; on all pages
                </li>
                <li>
                  Save — the snippet will be injected on every page
                  automatically
                </li>
              </ol>
              <p className="text-[10px] text-muted-foreground">
                Works for any site proxied through Cloudflare, regardless of
                tech stack.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
