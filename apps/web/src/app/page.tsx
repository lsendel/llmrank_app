import type { Metadata } from "next";
import Link from "next/link";
import { SignedIn, SignedOut } from "@/lib/auth-hooks";
import { JsonLd, softwareApplicationSchema } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "LLM Boost - AI-Readiness SEO Platform",
  description:
    "Audit your website for AI search engine visibility. LLM Boost scores pages across 37 factors and gives actionable fixes for ChatGPT, Claude, Perplexity, and Gemini.",
  alternates: { canonical: "/" },
};

const STEPS = [
  {
    step: "1",
    title: "Enter your URL",
    description:
      "Paste any website URL and LLM Boost crawls your pages, checks technical SEO, runs Lighthouse audits, and extracts content signals.",
  },
  {
    step: "2",
    title: "Get your AI-readiness score",
    description:
      "Each page is scored across 37 factors in four categories: Technical SEO, Content Quality, AI Readiness, and Performance. You get a letter grade from A to F.",
  },
  {
    step: "3",
    title: "Fix what matters most",
    description:
      "Prioritized quick wins show you exactly what to fix first, sorted by impact and effort. Add structured data, improve meta tags, expand thin content, and more.",
  },
];

const FEATURES = [
  {
    title: "37-Factor Scoring Engine",
    description:
      "Every page is evaluated across Technical SEO (25%), Content Quality (30%), AI Readiness (30%), and Performance (15%). Factors include structured data, canonical tags, content depth, citation-worthiness, and Lighthouse metrics.",
  },
  {
    title: "AI Visibility Checks",
    description:
      "See how your brand appears across ChatGPT, Claude, Perplexity, and Gemini. Track mention rates, citation positions, and competitor presence in AI-generated responses.",
  },
  {
    title: "Actionable Recommendations",
    description:
      "Every issue comes with a fix. Quick wins are ranked by impact-to-effort ratio so you know exactly where to start. Export detailed PDF reports for clients or stakeholders.",
  },
  {
    title: "Integrations That Matter",
    description:
      "Connect Google Search Console and Google Analytics to correlate traditional search performance with AI readiness. WordPress plugin coming soon for real-time content scoring.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={softwareApplicationSchema()} />
      {/* Navigation */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <span className="text-xl font-bold tracking-tight text-primary">
            LLM Boost
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/integrations"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Integrations
            </Link>
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Dashboard
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-6 pt-20 pb-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              Make your site visible to{" "}
              <span className="text-primary">AI search</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              LLM Boost audits your website for AI-readiness, scores every page
              across 37 factors, and gives you actionable recommendations to
              improve your visibility in ChatGPT, Perplexity, Claude, and other
              LLM-powered search engines.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <SignedOut>
                <Link
                  href="/scan"
                  className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
                >
                  Try a Free Scan
                </Link>
                <Link
                  href="/sign-up"
                  className="text-sm font-semibold text-foreground hover:text-primary"
                >
                  Create account &rarr;
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
                >
                  Go to Dashboard
                </Link>
              </SignedIn>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t border-border bg-muted/40 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Three steps to understand and improve how AI search engines see
              your website.
            </p>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {STEPS.map((item) => (
                <div key={item.step} className="space-y-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {item.step}
                  </span>
                  <h3 className="text-lg font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
              Everything you need to rank in AI search
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Traditional SEO tools optimize for Google. LLM Boost optimizes for
              the next generation of search: large language models that
              synthesize answers from across the web.
            </p>
            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-border p-6"
                >
                  <h3 className="text-lg font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-muted/40 px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Ready to see your AI-readiness score?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Run a free scan on any URL in seconds. No signup required. See
              exactly what AI search engines think of your content and what to
              fix first.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/scan"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                Scan Your Site Free
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-semibold text-foreground hover:text-primary"
              >
                View pricing &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} LLM Boost</span>
          <Link href="/scan" className="hover:text-foreground">
            Free Scan
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/integrations" className="hover:text-foreground">
            Integrations
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
