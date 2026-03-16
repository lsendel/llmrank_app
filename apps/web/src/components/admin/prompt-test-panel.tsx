"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Play } from "lucide-react";
import { apiClient } from "@/lib/api/core/client";

interface PromptTestPanelProps {
  promptId: string;
  variables: string[];
  systemPrompt: string;
  userPromptTemplate: string;
}

export function PromptTestPanel({
  promptId,
  variables,
  systemPrompt,
  userPromptTemplate,
}: PromptTestPanelProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Preview interpolated template
  const preview = userPromptTemplate.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => values[key] || `{{${key}}}`,
  );

  async function handleTest() {
    setRunning(true);
    setOutput(null);
    try {
      const res = await apiClient.post<{ data: { output: string } }>(
        `/api/admin/prompts/${promptId}/test`,
        { variables: values },
      );
      setOutput(res.data.output);
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : "Test failed"}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h3 className="text-sm font-semibold">Test Prompt</h3>

      {/* Variable inputs */}
      {variables.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {variables.map((v) => (
            <div key={v}>
              <label className="text-xs font-medium text-muted-foreground">
                {`{{${v}}}`}
              </label>
              <Input
                value={values[v] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [v]: e.target.value }))
                }
                placeholder={`Enter ${v}...`}
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Interpolated preview
        </label>
        <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
          {`System: ${systemPrompt.slice(0, 200)}...\n\nUser: ${preview.slice(0, 500)}`}
        </pre>
      </div>

      <Button onClick={handleTest} disabled={running} size="sm">
        {running ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-1" />
        )}
        Run Test
      </Button>

      {/* Output */}
      {output && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            LLM Output
          </label>
          <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
