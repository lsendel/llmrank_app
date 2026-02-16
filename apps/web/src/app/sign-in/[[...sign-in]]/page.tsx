import type { Metadata } from "next";
import Link from "next/link";
import { SignIn } from "@/components/auth/sign-in";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your LLM Boost account to access AI-readiness audits, scores, and recommendations.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/sign-in" },
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            LLM Boost
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

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to access your AI-readiness dashboard, view scores, and
              track your site&apos;s visibility across ChatGPT, Claude,
              Perplexity, and Gemini.
            </p>
          </div>

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
