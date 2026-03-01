import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  JsonLd,
  webPageSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";
import { WORKFLOW_TONE_COPY } from "@/lib/microcopy";
import { IntegrationCatalogClient } from "./catalog-client";

export const metadata: Metadata = {
  title: "Integrations for SEO and AI Visibility",
  description:
    "Connect Google Search Console, GA4, MCP, and workflow tools to turn SEO and AI visibility data into action.",
  alternates: { canonical: "/integrations" },
  openGraph: {
    title: "Integrations | LLM Rank",
    description:
      "Connect Google Search Console, GA4, WordPress, and Slack to your AI-readiness workflow.",
    url: "https://llmrank.app/integrations",
  },
};

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
            {WORKFLOW_TONE_COPY.integrationsHeroSubtitle}
          </p>
        </div>

        <h2 className="mb-6 text-2xl font-bold text-foreground">
          Integration catalog
        </h2>
        <IntegrationCatalogClient />

        <div className="my-20">
          <h2 className="text-2xl font-bold text-foreground">
            How integrations work
          </h2>
          <p className="mt-2 text-muted-foreground">
            Connect once, sync automatically, and execute from one project
            workspace.
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                1
              </div>
              <h3 className="font-semibold text-foreground">Connect</h3>
              <p className="text-sm text-muted-foreground">
                Choose a provider and authorize access. Most connections are
                read-only and can be revoked at any time.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                2
              </div>
              <h3 className="font-semibold text-foreground">Sync</h3>
              <p className="text-sm text-muted-foreground">
                Pull rankings, traffic, and readiness signals into one view.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                3
              </div>
              <h3 className="font-semibold text-foreground">Execute</h3>
              <p className="text-sm text-muted-foreground">
                Use prioritized actions to assign work and close visibility
                gaps.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          <p>
            Integrations align with{" "}
            <a
              href="https://developers.google.com/search/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Google Search Central documentation
            </a>{" "}
            and{" "}
            <a
              href="https://developers.google.com/analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Google Analytics best practices
            </a>{" "}
            for traffic measurement. Access is handled via OAuth and can be
            revoked from your provider account.
          </p>
        </div>

        {/* CTA section with internal links */}
        <div className="mt-12 rounded-lg border border-border bg-muted/40 p-8 text-center">
          <h2 className="text-xl font-bold text-foreground">
            Start with one connection
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a free account to connect tools and start recurring
            AI-visibility monitoring.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/scan"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Run Free Scan
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-semibold text-foreground hover:text-primary"
            >
              View plans &rarr;
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
