"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { normalizeDomain } from "@llm-boost/shared";
import { track } from "@/lib/telemetry";
import { WORKFLOW_CTA_COPY, WORKFLOW_TONE_COPY } from "@/lib/microcopy";

type ScanEntryCta =
  | "create_project"
  | "connect_integration"
  | "schedule_recurring_scan";

export function ScanPageClient() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function trackEntryCtaClick(cta: ScanEntryCta, destination: string) {
    track("scan_entry_cta_clicked", {
      cta,
      destination,
      placement: "scan_preflight",
    });
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const domain = normalizeDomain(url);
    if (!domain) {
      setError("Please enter a valid domain");
      return;
    }
    setUrl(domain); // Show cleaned value

    setLoading(true);
    setError(null);
    track("scan.started", { domain });
    try {
      const result = await api.public.scan(domain);
      // Prefer URL-based navigation with scanResultId; fall back to sessionStorage
      if (result.scanResultId) {
        router.push(`/scan/results?id=${result.scanResultId}&source=scan`);
      } else {
        sessionStorage.setItem("scanResult", JSON.stringify(result));
        router.push("/scan/results?source=scan");
      }
    } catch (err) {
      track("scan.failed", {
        domain,
        reason: err instanceof ApiError ? err.message : "unknown_error",
      });
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to scan. Please check the URL and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {WORKFLOW_TONE_COPY.scanHeroTitle}
          </h1>
          <p className="text-lg text-muted-foreground">
            {WORKFLOW_TONE_COPY.scanHeroSubtitle} No sign-up required.
          </p>
          <p className="text-sm font-semibold text-primary">
            Runs 37 checks across technical SEO, content quality, AI readiness,
            and performance.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleScan} className="flex gap-3">
              <Input
                type="text"
                placeholder="example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => setUrl(normalizeDomain(url))}
                className="flex-1 text-base"
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !url.trim()} size="lg">
                <Search className="mr-2 h-4 w-4" />
                {loading ? "Running..." : WORKFLOW_CTA_COPY.runScan}
              </Button>
            </form>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            {!error && (
              <p className="mt-3 text-xs text-muted-foreground text-left sm:text-center">
                Use a root domain (for example, example.com). Protocol and www
                are normalized automatically.
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground text-left sm:text-center">
              After the scan: create a workspace, connect integrations, and set
              recurring scans.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-primary/25 bg-primary/5">
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1 text-left sm:text-center">
              <p className="text-sm font-semibold text-primary">
                Next steps after the scan
              </p>
              <p className="text-sm text-muted-foreground">
                One primary action and two secondary actions to operationalize
                your scan findings.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="lg" className="w-full sm:col-span-2" asChild>
                <Link
                  href="/sign-up"
                  onClick={() =>
                    trackEntryCtaClick("create_project", "/sign-up")
                  }
                >
                  {WORKFLOW_CTA_COPY.createWorkspace}
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full" asChild>
                <Link
                  href="/integrations"
                  onClick={() =>
                    trackEntryCtaClick("connect_integration", "/integrations")
                  }
                >
                  {WORKFLOW_CTA_COPY.connectIntegrations}
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full" asChild>
                <Link
                  href="/pricing"
                  onClick={() =>
                    trackEntryCtaClick("schedule_recurring_scan", "/pricing")
                  }
                >
                  {WORKFLOW_CTA_COPY.scheduleRecurringScans}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="w-full rounded-lg border border-border bg-muted/40 p-5 text-left text-sm leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">What you get</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Overall grade and category scores for your current baseline.
            </li>
            <li>Top issues ranked by impact so teams can execute quickly.</li>
            <li>
              Clear next actions: create workspace, connect data, and schedule
              recurring scans.
            </li>
          </ul>
        </div>

        <div className="grid gap-4 text-left sm:grid-cols-3">
          {[
            {
              title: "37+ Factors",
              desc: "Checks technical SEO, content quality, AI readiness, and performance.",
            },
            {
              title: "Quick Wins",
              desc: "Ranks fixes by impact and effort so teams can ship faster.",
            },
            {
              title: "Free & Instant",
              desc: "Runs in seconds. Upgrade for deeper crawls and monitoring.",
            },
          ].map((item) => (
            <div key={item.title} className="space-y-1">
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 w-full max-w-2xl space-y-4 text-left">
          <h2 className="text-xl font-bold text-foreground">
            How scoring works
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The scan evaluates 37 factors across Technical SEO, Content Quality,
            AI Readiness, and Performance. Critical failures carry the highest
            penalties so your quick wins stay focused on blockers.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Methodology aligns with{" "}
            <a
              href="https://developers.google.com/search/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Google Search Central
            </a>
            ,{" "}
            <a
              href="https://schema.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Schema.org
            </a>
            , and{" "}
            <a
              href="https://developer.chrome.com/docs/lighthouse"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Lighthouse
            </a>
            .
          </p>
        </div>

        <div className="mt-8 w-full max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">
            Need portfolio-level monitoring?{" "}
            <Link
              href="/pricing"
              className="font-medium text-primary hover:underline"
            >
              View plans
            </Link>{" "}
            for larger crawls and recurring monitoring. Compare scores on the{" "}
            <Link
              href="/leaderboard"
              className="font-medium text-primary hover:underline"
            >
              leaderboard
            </Link>{" "}
            or connect data in{" "}
            <Link
              href="/integrations"
              className="font-medium text-primary hover:underline"
            >
              integrations
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
