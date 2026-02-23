import type { Metadata } from "next";
import Link from "next/link";
import { SignUp } from "@/components/auth/sign-up";
import { Check, Shield } from "lucide-react";
import { JsonLd, webPageSchema } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Sign Up Free — AI-Readiness SEO Platform",
  description:
    "Create your free LLM Rank account. Audit up to 10 pages per crawl, score your site across 37 AI-readiness factors, and get actionable recommendations.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/sign-up" },
  openGraph: {
    title: "Sign Up Free | LLM Rank",
    description:
      "Start auditing your website for AI search visibility. Free tier includes 10 pages per crawl and 37-factor scoring.",
    url: "https://llmrank.app/sign-up",
  },
};

const VALUE_PROPS = [
  "37-factor AI-readiness scoring",
  "Free tier with 10 pages per crawl",
  "Visibility checks across ChatGPT, Claude, Perplexity",
  "Actionable quick-win recommendations",
  "PDF and DOCX report generation",
  "Google Search Console integration",
];

const TRUST_STATS = [
  { value: "37", label: "Scoring factors" },
  { value: "4", label: "AI engines tracked" },
  { value: "<2m", label: "Time to first audit" },
];

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <JsonLd
        data={webPageSchema({
          title: "Sign Up Free — AI-Readiness SEO Platform",
          description:
            "Create a free account to audit your website for AI-readiness across 37 factors.",
          path: "/sign-up",
          type: "WebPage",
        })}
      />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            LLM Rank
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/pricing"
              className="text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/sign-in"
              className="font-medium text-foreground hover:text-primary"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:items-start">
          {/* Left: value props */}
          <div className="flex-1 space-y-6 text-center lg:pt-4 lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Start optimizing for AI search
            </h1>
            <p className="text-lg text-muted-foreground">
              Create a free account and get your first AI-readiness audit in
              under two minutes. No credit card required.
            </p>

            <ul className="space-y-3">
              {VALUE_PROPS.map((prop) => (
                <li
                  key={prop}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Check className="h-4 w-4 shrink-0 text-success" />
                  {prop}
                </li>
              ))}
            </ul>

            {/* Trust stats */}
            <div className="flex justify-center gap-8 lg:justify-start">
              {TRUST_STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Authoritative citations */}
            <div className="flex items-start gap-2 rounded-lg border border-border bg-white p-4 text-left text-sm">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-muted-foreground">
                Our scoring methodology is built on{" "}
                <a
                  href="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Google&apos;s structured data guidelines
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
                  href="https://web.dev/performance-scoring/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Lighthouse performance scoring
                </a>
                .
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Need more pages or crawls?{" "}
              <Link
                href="/pricing"
                className="font-medium text-primary hover:underline"
              >
                View pricing plans
              </Link>
              . Already have an account?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
              .
            </p>
          </div>

          {/* Right: Clerk form */}
          <div className="w-full max-w-md shrink-0">
            <SignUp />
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Home
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
