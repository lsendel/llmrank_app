"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Copy, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface ContentRepairEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  initialContent?: string;
  initialDimension?: string;
}

const DIMENSIONS = [
  { value: "clarity", label: "Clarity" },
  { value: "authority", label: "Authority" },
  { value: "comprehensiveness", label: "Comprehensiveness" },
  { value: "structure", label: "Structure" },
  { value: "citation_worthiness", label: "Citation Worthiness" },
];

export function ContentRepairEditor({
  open,
  onOpenChange,
  pageId,
  initialContent = "",
  initialDimension = "clarity",
}: ContentRepairEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [dimension, setDimension] = useState(initialDimension);
  const [tone, setTone] = useState("professional");
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedContent, setOptimizedContent] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const { toast } = useToast();

  const handleOptimize = async () => {
    if (!content.trim()) return;
    setOptimizing(true);
    try {
      const result = await api.strategy.optimizeDimension({
        pageId,
        content,
        dimension,
        tone,
      });
      setOptimizedContent(result.optimized);
      setExplanation(result.explanation);
    } catch (error) {
      toast({
        title: "Optimization failed",
        description:
          error instanceof Error ? error.message : "AI service error",
        variant: "destructive",
      });
    } finally {
      setOptimizing(false);
    }
  };

  const handleCopy = () => {
    if (optimizedContent) {
      navigator.clipboard.writeText(optimizedContent);
      toast({
        title: "Copied to clipboard",
        description: "You can now paste the optimized content into your CMS.",
      });
    }
  };

  const handleReset = () => {
    setOptimizedContent(null);
    setExplanation(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Content Repair
          </DialogTitle>
          <DialogDescription>
            Optimize your content for specific AI search dimensions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4 lg:grid-cols-2">
          {/* Left Side: Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">Current Content Excerpt</Label>
              <Textarea
                id="content"
                placeholder="Paste the section you want to improve..."
                className="min-h-[300px] font-sans text-sm"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dimension</Label>
                <Select value={dimension} onValueChange={setDimension}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIMENSIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="authoritative">Authoritative</SelectItem>
                    <SelectItem value="conversational">
                      Conversational
                    </SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleOptimize}
              disabled={optimizing || !content.trim()}
            >
              {optimizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Improve {DIMENSIONS.find((d) => d.value === dimension)?.label}
                </>
              )}
            </Button>
          </div>

          {/* Right Side: Output */}
          <div className="space-y-4">
            <Label>Optimized Result</Label>
            <div className="relative min-h-[300px] rounded-md border bg-muted/30 p-4">
              {optimizedContent ? (
                <div className="space-y-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {optimizedContent}
                    </p>
                  </div>
                  {explanation && (
                    <div className="mt-4 rounded-md bg-primary/5 p-3 text-xs text-primary border border-primary/10">
                      <strong>AI Improvement:</strong> {explanation}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={handleCopy}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleReset}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-2 opacity-50">
                  <Sparkles className="h-8 w-8 mb-2" />
                  <p className="text-sm">
                    Optimized content will appear here after analysis.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <p className="text-[10px] text-muted-foreground">
            AI-generated content may require human review for factual accuracy.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
