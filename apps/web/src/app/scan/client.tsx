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

export function ScanPageClient() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        router.push(`/scan/results?id=${result.scanResultId}`);
      } else {
        sessionStorage.setItem("scanResult", JSON.stringify(result));
        router.push("/scan/results");
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
            Run a Free AI Visibility Scan
          </h1>
          <p className="text-lg text-muted-foreground">
            Enter a domain to get a baseline score, top issues, and prioritized
            next actions. No sign-up required.
          </p>
          <p className="text-sm font-semibold text-primary">
            Includes 37 checks across technical SEO, content quality, AI
            readiness, and performance.
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
                {loading ? "Running..." : "Run Scan"}
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
              Next in your report: create a project workspace, connect
              integrations, and set recurring scans.
            </p>
          </CardContent>
        </Card>

        <div className="w-full rounded-lg border border-border bg-muted/40 p-5 text-left text-sm leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">
            What this scan gives you
          </p>
          <p className="mt-2">
            Use this report as your first-pass audit before publishing or
            reporting. It catches blocking issues like noindex directives,
            schema gaps, and internal linking misses that reduce Google and LLM
            visibility.
          </p>
          <p className="mt-2">
            Review benchmarks on the{" "}
            <Link
              href="/leaderboard"
              className="font-medium text-primary hover:underline"
            >
              leaderboard
            </Link>{" "}
            and connect data sources on{" "}
            <Link
              href="/integrations"
              className="font-medium text-primary hover:underline"
            >
              integrations
            </Link>{" "}
            . For recurring crawls and portfolio workflows, see{" "}
            <Link
              href="/pricing"
              className="font-medium text-primary hover:underline"
            >
              plans
            </Link>
            .
          </p>
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

        <div className="mt-10 w-full max-w-2xl space-y-4 text-left">
          <h2 className="text-xl font-bold text-foreground">
            What the scan checks
          </h2>
          <p className="text-sm font-semibold text-primary">
            You get a score and issue list mapped to the signals that affect
            search and LLM citation likelihood.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The scan evaluates 37 factors in four weighted categories: Technical
            SEO (25%), Content Quality (30%), AI Readiness (30%), and
            Performance (15%). Checks include crawl directives, metadata,
            schema, readability, answer structure, and Lighthouse signals.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Critical failures (for example missing titles or blocking
            directives) carry higher penalties. Output includes a letter grade
            and prioritized quick wins. Methodology is based on{" "}
            <a
              href="https://developers.google.com/search/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Google Search Central guidelines
            </a>
            ,{" "}
            <a
              href="https://schema.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Schema.org standards
            </a>
            , and{" "}
            <a
              href="https://developer.chrome.com/docs/lighthouse"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Chrome Lighthouse methodology
            </a>
            .
          </p>
        </div>

        <div className="mt-8 w-full max-w-2xl space-y-4 text-left">
          <h2 className="text-xl font-bold text-foreground">
            How to Improve Your Score
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Start with Quick Wins first, then move to deeper content and
            performance work. This sequence usually drives the fastest score and
            visibility gains.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong>Resolve crawl blockers:</strong> fix robots, canonical,
              and indexation errors first.
            </li>
            <li>
              <strong>Add structured data:</strong> help engines understand your
              entities and page intent.
            </li>
            <li>
              <strong>Increase answer clarity:</strong> use concise headings,
              direct answers, and FAQ sections where relevant.
            </li>
            <li>
              <strong>Improve depth and trust:</strong> expand thin pages with
              facts, sources, and original examples.
            </li>
          </ul>
        </div>

        <div className="mt-8 w-full max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">
            Need portfolio-level analysis?{" "}
            <Link
              href="/pricing"
              className="font-medium text-primary hover:underline"
            >
              View plans
            </Link>{" "}
            for large crawls, recurring monitoring, and integrations. Compare
            scores on the{" "}
            <Link
              href="/leaderboard"
              className="font-medium text-primary hover:underline"
            >
              leaderboard
            </Link>{" "}
            or connect data sources in{" "}
            <Link
              href="/integrations"
              className="font-medium text-primary hover:underline"
            >
              Integrations
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
