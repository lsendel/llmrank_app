"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, Save, Archive } from "lucide-react";
import { PromptTestPanel } from "./prompt-test-panel";

export interface PromptTemplate {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[] | null;
  model: string;
  modelConfig: { maxTokens?: number; temperature?: number } | null;
  version: number;
  status: "draft" | "active" | "archived";
  parentId: string | null;
  createdAt: string;
  activatedAt: string | null;
}

interface PromptEditorProps {
  prompt: PromptTemplate;
  onSave: (data: {
    systemPrompt: string;
    userPromptTemplate: string;
    model: string;
    description: string;
  }) => Promise<void>;
  onActivate: () => Promise<void>;
  onArchive: () => Promise<void>;
}

export function PromptEditor({
  prompt,
  onSave,
  onActivate,
  onArchive,
}: PromptEditorProps) {
  const [systemPrompt, setSystemPrompt] = useState(prompt.systemPrompt);
  const [userPromptTemplate, setUserPromptTemplate] = useState(
    prompt.userPromptTemplate,
  );
  const [model, setModel] = useState(prompt.model);
  const [description, setDescription] = useState(prompt.description ?? "");
  const [saving, setSaving] = useState(false);
  const [showTest, setShowTest] = useState(false);

  const hasChanges =
    systemPrompt !== prompt.systemPrompt ||
    userPromptTemplate !== prompt.userPromptTemplate ||
    model !== prompt.model ||
    description !== (prompt.description ?? "");

  // Extract variables from template
  const variables = [...(userPromptTemplate.match(/\{\{(\w+)\}\}/g) ?? [])].map(
    (v) => v.replace(/[{}]/g, ""),
  );

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ systemPrompt, userPromptTemplate, model, description });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{prompt.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{prompt.slug}</Badge>
            <Badge
              variant={prompt.status === "active" ? "default" : "secondary"}
            >
              {prompt.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              v{prompt.version}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTest(!showTest)}
          >
            <Play className="h-4 w-4 mr-1" />
            Test
          </Button>
          {prompt.status !== "archived" && (
            <Button variant="outline" size="sm" onClick={onArchive}>
              <Archive className="h-4 w-4 mr-1" />
              Archive
            </Button>
          )}
          {prompt.status !== "active" && (
            <Button variant="outline" size="sm" onClick={onActivate}>
              Activate
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save as New Version
          </Button>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-sm font-medium">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this prompt does..."
        />
      </div>

      {/* Model selector */}
      <div>
        <label className="text-sm font-medium">Model</label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claude-haiku-4-5-20251001">
              Claude Haiku 4.5
            </SelectItem>
            <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6</SelectItem>
            <SelectItem value="claude-opus-4-6">Claude Opus 4.6</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Split pane: System prompt + User template */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">System Prompt</label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">
            User Prompt Template
            {variables.length > 0 && (
              <span className="ml-2 text-muted-foreground font-normal">
                Variables: {variables.join(", ")}
              </span>
            )}
          </label>
          <Textarea
            value={userPromptTemplate}
            onChange={(e) => setUserPromptTemplate(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
          />
        </div>
      </div>

      {/* Test panel */}
      {showTest && (
        <PromptTestPanel
          promptId={prompt.id}
          variables={variables}
          systemPrompt={systemPrompt}
          userPromptTemplate={userPromptTemplate}
        />
      )}
    </div>
  );
}
