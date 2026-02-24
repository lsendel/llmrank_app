"use client";

import { useState } from "react";
import { Sparkles, Copy, Check, Download } from "lucide-react";
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
  onGenerated?: () => void;
}

export function AiFixButton({
  projectId,
  pageId,
  issueCode,
  issueTitle,
  onGenerated,
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
      onGenerated?.();
    } catch (err: unknown) {
      toast({
        title: "Fix generation failed",
        description:
          err instanceof Error ? err.message : "Could not generate fix",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (fix) {
      navigator.clipboard.writeText(fix).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        () => {
          toast({
            title: "Copy failed",
            description:
              "Could not copy to clipboard. Try selecting and copying manually.",
            variant: "destructive",
          });
        },
      );
    }
  }

  function handleDownload() {
    if (!fix) return;
    const filenames: Record<string, string> = {
      llms_txt: "llms.txt",
      robots_txt: "robots.txt",
      json_ld: "schema.json",
      meta_description: `fix-${issueCode}.txt`,
      title_tag: `fix-${issueCode}.txt`,
      faq_section: `fix-${issueCode}.html`,
      og_tags: `fix-${issueCode}.html`,
    };
    const filename = filenames[getFixType(issueCode)] ?? `fix-${issueCode}.txt`;
    const blob = new Blob([fix], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleDownload}
              variant="outline"
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              Download as file
            </Button>
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

const ISSUE_TO_FIX_TYPE: Record<string, string> = {
  MISSING_META_DESC: "meta_description",
  MISSING_TITLE: "title_tag",
  NO_STRUCTURED_DATA: "json_ld",
  MISSING_LLMS_TXT: "llms_txt",
  NO_FAQ_SECTION: "faq_section",
  MISSING_SUMMARY: "summary_section",
  MISSING_ALT_TEXT: "alt_text",
  MISSING_OG_TAGS: "og_tags",
  MISSING_CANONICAL: "canonical",
  BAD_HEADING_HIERARCHY: "heading_structure",
  AI_CRAWLER_BLOCKED: "robots_txt",
};

function getFixType(issueCode: string): string {
  return ISSUE_TO_FIX_TYPE[issueCode] ?? issueCode;
}
