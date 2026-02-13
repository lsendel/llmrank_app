import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <span className="text-xl font-bold tracking-tight text-primary">
            LLM Boost
          </span>
          <nav className="flex items-center gap-4">
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

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Make your site visible to{" "}
            <span className="text-primary">AI search</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            LLM Boost audits your website for AI-readiness, scores every page,
            and gives you actionable recommendations to improve your visibility
            in ChatGPT, Perplexity, and other LLM-powered search engines.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <SignedOut>
              <Link
                href="/sign-up"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                Start Free Audit
              </Link>
              <Link
                href="/sign-in"
                className="text-sm font-semibold text-foreground hover:text-primary"
              >
                Sign in &rarr;
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
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} LLM Boost. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
