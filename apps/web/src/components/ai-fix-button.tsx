"use client";

import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  projectId: string;
  pageId?: string;
  issueCode: string;
  issueTitle: string;
}

export function AiFixButton({
  projectId,
  pageId,
  issueCode,
  issueTitle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fix, setFix] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await api.fixes.generate({ projectId, pageId, issueCode });
      setFix(result.generatedFix);
      setOpen(true);
    } catch (err: any) {
      toast({
        title: "Fix generation failed",
        description: err.message || "Could not generate fix",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (fix) {
      navigator.clipboard.writeText(fix);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={loading}
        className="gap-1"
      >
        <Sparkles className="h-3 w-3" />
        {loading ? "Generating..." : "AI Fix"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Fix: {issueTitle}</DialogTitle>
          </DialogHeader>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {fix}
          </pre>
          <div className="flex justify-end">
            <Button onClick={handleCopy} variant="outline" className="gap-1">
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy to clipboard"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
