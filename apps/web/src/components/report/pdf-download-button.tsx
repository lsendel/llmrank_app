"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import type { CrawlJob, QuickWin } from "@/lib/api";

interface PdfDownloadButtonProps {
  crawl: CrawlJob;
  quickWins: QuickWin[];
  branding: {
    logoUrl?: string;
    companyName?: string;
    primaryColor?: string;
  };
  crawlId: string;
  disabled?: boolean;
}

export function PdfDownloadButton({
  crawl,
  quickWins,
  branding,
  crawlId,
  disabled,
}: PdfDownloadButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    setError(false);
    try {
      // Lazy-load @react-pdf/renderer only on click to avoid
      // reconciler crash on page mount (React 19 + scheduler mismatch)
      const { pdf } = await import("@react-pdf/renderer");
      const { AIReadinessReport } = await import("./report-template");
      const rawBlob = await pdf(
        <AIReadinessReport
          crawl={crawl}
          quickWins={quickWins}
          companyName={branding.companyName || "LLM Boost"}
          logoUrl={branding.logoUrl}
          primaryColor={branding.primaryColor}
        />,
      ).toBlob();
      // Ensure the blob has the correct MIME type for PDF
      const blob =
        rawBlob.type === "application/pdf"
          ? rawBlob
          : new Blob([rawBlob], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `llm-boost-report-${crawlId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revoke so the browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setError(true);
    } finally {
      setGenerating(false);
    }
  }

  if (error) {
    return (
      <span className="text-xs text-muted-foreground">
        PDF generation failed.{" "}
        <button
          className="underline hover:text-foreground"
          onClick={handleDownload}
        >
          Retry
        </button>
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || generating}
      onClick={handleDownload}
    >
      {generating ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-1.5 h-4 w-4" />
      )}
      {generating ? "Generating..." : "Export PDF"}
    </Button>
  );
}
