"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

export default function ScanPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const result = await api.public.scan(url.trim());
      // Prefer URL-based navigation with scanResultId; fall back to sessionStorage
      if (result.scanResultId) {
        router.push(`/scan/results?id=${result.scanResultId}`);
      } else {
        sessionStorage.setItem("scanResult", JSON.stringify(result));
        router.push("/scan/results");
      }
    } catch (err) {
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
            Is your site AI-ready?
          </h1>
          <p className="text-lg text-muted-foreground">
            Enter any URL to get an instant AI-readiness score with actionable
            recommendations. No signup required.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleScan} className="flex gap-3">
              <Input
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 text-base"
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !url.trim()} size="lg">
                <Search className="mr-2 h-4 w-4" />
                {loading ? "Scanning..." : "Scan"}
              </Button>
            </form>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <div className="grid gap-4 text-left sm:grid-cols-3">
          {[
            {
              title: "37+ Factors",
              desc: "Technical SEO, content quality, AI readiness, and performance checks.",
            },
            {
              title: "Quick Wins",
              desc: "Prioritized fixes ranked by impact and effort with copy-paste code.",
            },
            {
              title: "Free & Instant",
              desc: "Results in seconds. Sign up for deeper crawls and monitoring.",
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
            What does the AI-readiness scan check?
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The free scan evaluates your page across 37 factors in four
            categories. Technical SEO (25% weight) checks meta tags, structured
            data, canonical URLs, robots directives, internal linking, and HTTP
            status codes. Content Quality (30%) analyzes word count,
            readability, heading structure, and content depth. AI Readiness
            (30%) evaluates citation-worthiness, direct answers, FAQ structure,
            and Open Graph tags. Performance (15%) measures Lighthouse scores
            including page speed, accessibility, and best practices.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Each factor starts with a perfect score and applies deductions for
            issues found. Critical issues like missing titles or noindex
            directives carry the heaviest penalties. The scan produces a letter
            grade from A to F and a prioritized list of quick wins sorted by
            impact and effort. Results are based on{" "}
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

        <div className="mt-8 w-full max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">
            Want deeper analysis?{" "}
            <Link
              href="/pricing"
              className="font-medium text-primary hover:underline"
            >
              View pricing plans
            </Link>{" "}
            for up to 2,000 pages per crawl, AI visibility tracking, and
            integrations.
          </p>
        </div>
      </div>
    </div>
  );
}
