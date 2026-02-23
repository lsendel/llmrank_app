import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  JsonLd,
  webPageSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "SEO Integrations & Connections",
  description:
    "Connect LLM Rank with Google Search Console, Google Analytics, MCP for AI coding agents, WordPress, Slack, and more to supercharge your AI SEO strategy.",
  alternates: { canonical: "/integrations" },
  openGraph: {
    title: "Integrations | LLM Rank",
    description:
      "Connect Google Search Console, GA4, WordPress, and Slack to your AI-readiness workflow.",
    url: "https://llmrank.app/integrations",
  },
};

const INTEGRATIONS = [
  {
    name: "Google Search Console",
    description:
      "Connect GSC to analyze actual search performance data alongside AI-readiness scores. Import impressions, clicks, and average position for every page. Identify which pages rank well in traditional search but score poorly for AI visibility — these are your biggest opportunities for quick improvement.",
    features: [
      "Import search analytics (impressions, clicks, CTR)",
      "Correlate traditional rankings with AI scores",
      "Identify high-opportunity keywords for AI optimization",
      "Track performance trends alongside readiness scores",
    ],
    status: "Available",
  },
  {
    name: "Google Analytics 4",
    description:
      "Link GA4 to track how AI-driven traffic converts on your site. As AI search engines begin citing URLs directly, understanding which pages receive AI referral traffic — and how those visitors behave — is critical for measuring the ROI of AI-readiness improvements.",
    features: [
      "Track AI referral traffic sources",
      "Measure engagement and bounce rates from AI visitors",
      "Conversion attribution for AI-driven sessions",
      "Compare AI vs. organic traffic quality",
    ],
    status: "Available",
  },
  {
    name: "MCP Server",
    description:
      "Connect your AI coding agent to LLM Rank via the Model Context Protocol (MCP). Get 27 SEO tools — crawl sites, score pages, check AI visibility, and generate fixes — directly from Claude Code, Cursor, VS Code, Windsurf, or ChatGPT. Install from npm and configure in under 2 minutes.",
    features: [
      "27 tools for AI-readiness analysis from your IDE",
      "Works with Claude Code, Cursor, VS Code, Windsurf, ChatGPT",
      "HTTP transport with OAuth 2.1 for cloud-based agents",
      "Pre-built prompts for site audits, fix plans, and competitor analysis",
    ],
    status: "Available",
    link: "/mcp",
  },
  {
    name: "WordPress Plugin",
    description:
      "Automatically score your content for AI-readiness directly from the WordPress editor. Get real-time feedback on structured data, content depth, readability, and citation-worthiness as you write. Manage your robots.txt and generate Schema.org markup without touching code.",
    features: [
      "Real-time content scoring in the editor",
      "One-click Schema.org markup generation",
      "Robots.txt management for AI crawlers",
      "Bulk optimization suggestions for existing posts",
    ],
    status: "Coming Soon",
  },
  {
    name: "Slack",
    description:
      "Get notified instantly when your AI visibility score changes, when you are cited by an LLM, or when a competitor gains ground. Weekly summary reports keep the whole team aligned on AI SEO priorities without needing to check the dashboard.",
    features: [
      "Real-time score change alerts",
      "Weekly AI-readiness summary reports",
      "Competitor movement notifications",
      "Team collaboration and assignment workflows",
    ],
    status: "Coming Soon",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={webPageSchema({
          title: "Integrations",
          description:
            "Connect Google Search Console, GA4, WordPress, and Slack to your AI-readiness workflow.",
          path: "/integrations",
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Integrations", path: "/integrations" },
        ])}
      />
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            LLM Rank
          </Link>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Integrations
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Supercharge your AI SEO strategy by connecting LLM Rank with your
            favorite tools.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            LLM Rank integrations connect your AI-readiness workflow with the
            tools your team already uses. Import search analytics from Google
            Search Console to correlate traditional rankings with AI visibility
            scores. Track conversions from AI-driven traffic with Google
            Analytics 4. Our upcoming WordPress plugin will let you score
            content in real time as you write. Slack integration keeps your team
            informed with automated alerts when scores change or your brand gets
            cited by an AI engine.
          </p>
        </div>

        <h2 className="mb-6 text-2xl font-bold text-foreground">
          Available Integrations
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {INTEGRATIONS.map((integration) => (
            <Card key={integration.name} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{integration.name}</CardTitle>
                  {integration.status === "Available" ? (
                    <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Coming Soon
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="mb-4 text-muted-foreground">
                  {integration.description}
                </p>
                <ul className="mb-6 flex-1 space-y-2">
                  {integration.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <CheckCircle className="mt-0.5 h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {"link" in integration && integration.link ? (
                  <Link href={integration.link as string}>
                    <Button className="w-full">View Setup Guide</Button>
                  </Link>
                ) : (
                  <Button
                    variant={
                      integration.status === "Available" ? "default" : "outline"
                    }
                    disabled={integration.status !== "Available"}
                    className="w-full"
                  >
                    {integration.status === "Available"
                      ? "Connect"
                      : "Notify Me"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="my-20">
          <h2 className="text-2xl font-bold text-foreground">
            How Integrations Work
          </h2>
          <p className="mt-2 text-muted-foreground">
            Direct answer: Integrations securely connect your existing data
            sources to LLM Rank via OAuth. This allows us to correlate your
            AI-readiness scores with actual traffic and ranking data.
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                1
              </div>
              <h3 className="font-semibold text-foreground">
                Authorize Connection
              </h3>
              <p className="text-sm text-muted-foreground">
                Click &quot;Connect&quot; on any available integration. You will
                be redirected to the provider (e.g., Google) to approve
                read-only access to your analytics data. We never ask for write
                permissions.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                2
              </div>
              <h3 className="font-semibold text-foreground">Sync & Analyze</h3>
              <p className="text-sm text-muted-foreground">
                LLM Rank fetches your historical data and overlays it with your
                AI-readiness timeline. This highlights correlations, such as
                &quot;Score improved by 10 points → AI referral traffic
                increased by 15%.&quot;
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                3
              </div>
              <h3 className="font-semibold text-foreground">
                Automate Insights
              </h3>
              <p className="text-sm text-muted-foreground">
                Once connected, insights are automated. You receive alerts when
                rankings drop or when new keyword opportunities emerge that are
                perfect for AI optimization.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          <p>
            Our integrations follow{" "}
            <a
              href="https://developers.google.com/search/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Google Search Central documentation
            </a>{" "}
            for search analytics and{" "}
            <a
              href="https://developers.google.com/analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Google Analytics best practices
            </a>{" "}
            for traffic measurement. Data is fetched securely via OAuth 2.0 and
            never stored beyond your active session.
          </p>
        </div>

        {/* CTA section with internal links */}
        <div className="mt-12 rounded-lg border border-border bg-muted/40 p-8 text-center">
          <h2 className="text-xl font-bold text-foreground">
            Get started with integrations
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a free account to connect your tools and start tracking
            AI-readiness alongside your existing analytics.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/scan"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Try a Free Scan
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-semibold text-foreground hover:text-primary"
            >
              View pricing plans &rarr;
            </Link>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} LLM Rank</span>
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <Link href="/scan" className="hover:text-foreground">
            Free Scan
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
