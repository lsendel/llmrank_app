"use client";

import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { RefreshCw, RotateCcw } from "lucide-react";
import type { NarrativeSection } from "@llm-boost/shared";

interface Props {
  section: NarrativeSection;
  crawlJobId: string;
  editable: boolean;
  onSectionUpdate: (section: NarrativeSection) => void;
}

export function NarrativeSectionEditor({
  section,
  crawlJobId,
  editable,
  onSectionUpdate,
}: Props) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  const displayContent = section.editedContent ?? section.content;

  const editor = useEditor({
    extensions: [StarterKit],
    content: displayContent,
    editable,
    onUpdate: ({ editor }) => {
      if (editable) {
        const html = editor.getHTML();
        api.narratives.editSection(crawlJobId, section.id, html);
        onSectionUpdate({ ...section, editedContent: html });
      }
    },
  });

  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    try {
      const result = await api.narratives.regenerateSection(
        crawlJobId,
        section.type,
        instructions || undefined,
      );
      if (result && editor) {
        editor.commands.setContent(result.content);
        onSectionUpdate({
          ...section,
          content: result.content,
          editedContent: null,
        });
      }
    } finally {
      setIsRegenerating(false);
      setShowInstructions(false);
      setInstructions("");
    }
  }, [crawlJobId, section, instructions, editor, onSectionUpdate]);

  const handleReset = useCallback(async () => {
    await api.narratives.editSection(crawlJobId, section.id, null);
    if (editor) editor.commands.setContent(section.content);
    onSectionUpdate({ ...section, editedContent: null });
  }, [crawlJobId, section, editor, onSectionUpdate]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{section.title}</CardTitle>
          <div className="flex items-center gap-2">
            {section.editedContent && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInstructions(!showInstructions)}
              disabled={isRegenerating}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`}
              />
              {isRegenerating ? "Regenerating..." : "Regenerate"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showInstructions && (
          <div className="flex gap-2">
            <Input
              placeholder="Optional: 'Focus more on mobile performance...'"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="text-sm"
            />
            <Button size="sm" onClick={handleRegenerate}>
              Go
            </Button>
          </div>
        )}
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <EditorContent editor={editor} />
        </div>
      </CardContent>
    </Card>
  );
}
