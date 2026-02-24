"use client";

import { useState } from "react";
import { FileCode, Loader2, Map } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";

function downloadTextFile(
  content: string,
  contentType: string | null,
  filename: string,
) {
  const blob = new Blob([content], {
    type: contentType ?? "text/plain; charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SiteFileGeneratorSection({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [generatingSitemap, setGeneratingSitemap] = useState(false);
  const [generatingLlmsTxt, setGeneratingLlmsTxt] = useState(false);

  async function handleGenerateSitemap() {
    setGeneratingSitemap(true);
    try {
      const result = await api.generators.sitemap(projectId);
      downloadTextFile(
        result.content,
        result.contentType,
        result.filename ?? "sitemap.xml",
      );
      toast({ title: "Sitemap generated" });
    } catch (err) {
      toast({
        title: "Failed to generate sitemap",
        description:
          err instanceof Error
            ? err.message
            : "Please run a completed crawl first.",
        variant: "destructive",
      });
    } finally {
      setGeneratingSitemap(false);
    }
  }

  async function handleGenerateLlmsTxt() {
    setGeneratingLlmsTxt(true);
    try {
      const result = await api.generators.llmsTxt(projectId);
      downloadTextFile(
        result.content,
        result.contentType,
        result.filename ?? "llms.txt",
      );
      toast({ title: "llms.txt generated" });
    } catch (err) {
      toast({
        title: "Failed to generate llms.txt",
        description:
          err instanceof Error
            ? err.message
            : "Please run a completed crawl first.",
        variant: "destructive",
      });
    } finally {
      setGeneratingLlmsTxt(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI/SEO Generator Files</CardTitle>
        <CardDescription>
          Generate crawl-based `sitemap.xml` and `llms.txt` files for
          publishing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateSitemap}
          disabled={generatingSitemap}
        >
          {generatingSitemap ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Map className="mr-1.5 h-3.5 w-3.5" />
          )}
          Generate Sitemap
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateLlmsTxt}
          disabled={generatingLlmsTxt}
        >
          {generatingLlmsTxt ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileCode className="mr-1.5 h-3.5 w-3.5" />
          )}
          Generate llms.txt
        </Button>
      </CardContent>
    </Card>
  );
}
