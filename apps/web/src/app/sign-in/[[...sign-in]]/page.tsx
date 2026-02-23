import type { Metadata } from "next";
import Link from "next/link";
import { SignIn } from "@/components/auth/sign-in";
import { Shield, Zap, BarChart3, Globe } from "lucide-react";
import { JsonLd, webPageSchema } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Sign In to Your AI-Readiness Dashboard",
  description:
    "Sign in to LLM Rank to access your AI-readiness scores, track visibility across ChatGPT, Claude, Perplexity, and Gemini, and get prioritized SEO fixes.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/sign-in" },
  openGraph: {
    title: "Sign In | LLM Rank",
    description:
      "Access your AI-readiness dashboard. Track scores, visibility, and recommendations across all major AI search engines.",
    url: "https://llmrank.app/sign-in",
  },
};

const BENEFITS = [
  {
    icon: BarChart3,
    title: "37-Factor AI-Readiness Scores",
    description:
      "See how every page scores across Technical SEO, Content Quality, AI Readiness, and Performance.",
  },
  {
    icon: Globe,
    title: "AI Visibility Tracking",
    description:
      "Monitor how your brand appears in ChatGPT, Claude, Perplexity, and Gemini responses.",
  },
  {
    icon: Zap,
    title: "Prioritized Quick Wins",
    description:
      "Get actionable recommendations sorted by impact-to-effort ratio so you fix what matters first.",
  },
  {
    icon: Shield,
    title: "Enterprise-Grade Security",
    description:
      "Your data is encrypted at rest and in transit. Authentication powered by Clerk with SOC 2 compliance.",
  },
];

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <JsonLd
        data={webPageSchema({
          title: "Sign In to Your AI-Readiness Dashboard",
          description:
            "Sign in to access AI-readiness scores, visibility tracking, and SEO recommendations.",
          path: "/sign-in",
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
              href="/sign-up"
              className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:items-start">
          {/* Left: benefits and trust signals */}
          <div className="flex-1 space-y-8 text-center lg:pt-4 lg:text-left">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Welcome back to LLM Rank
              </h1>
              <p className="mt-3 text-lg text-muted-foreground">
                Sign in to your dashboard and continue optimizing your
                site&apos;s visibility across AI-powered search engines.
              </p>
            </div>

            <div className="space-y-5">
              {BENEFITS.map((benefit) => (
                <div
                  key={benefit.title}
                  className="flex items-start gap-3 text-left"
                >
                  <benefit.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {benefit.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-white p-4 text-left text-sm">
              <p className="font-medium text-foreground">
                Trusted by SEO professionals
              </p>
              <p className="text-muted-foreground">
                LLM Rank follows{" "}
                <a
                  href="https://owasp.org/www-project-top-ten/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  OWASP security standards
                </a>{" "}
                and uses{" "}
                <a
                  href="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Google&apos;s structured data guidelines
                </a>{" "}
                as the foundation for its AI-readiness scoring methodology.
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              New to AI-readiness SEO?{" "}
              <Link
                href="/"
                className="font-medium text-primary hover:underline"
              >
                Learn how it works
              </Link>{" "}
              or{" "}
              <Link
                href="/integrations"
                className="font-medium text-primary hover:underline"
              >
                explore our integrations
              </Link>
              .
            </p>
          </div>

          {/* Right: sign-in form */}
          <div className="w-full max-w-md shrink-0 space-y-6">
            <div className="rounded-lg bg-white p-8 shadow-lg">
              <SignIn />
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="font-medium text-primary hover:underline"
              >
                Start your free audit
              </Link>
            </p>
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
