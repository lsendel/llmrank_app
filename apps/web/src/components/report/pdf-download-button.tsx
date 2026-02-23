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
  disabled?: boolean;
}

export function PdfDownloadButton({
  crawl,
  quickWins,
  branding,
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
          companyName={branding.companyName || "LLM Rank"}
          logoUrl={branding.logoUrl}
          primaryColor={branding.primaryColor}
        />,
      ).toBlob();
      const blob = new Blob([rawBlob], { type: "application/pdf" });
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `llm-boost-report-${stamp}.pdf`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 5_000);
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
