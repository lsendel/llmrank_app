import Link from "next/link";

export const metadata = {
  title: "Terms of Service — LLM Boost",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            LLM Boost
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: February 2026
        </p>

        <div className="prose mt-10 max-w-none text-foreground [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-4 [&_p]:leading-7 [&_p]:text-muted-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:text-muted-foreground">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using LLM Boost (&quot;the Service&quot;), operated
            by LLM Boost Inc., you agree to be bound by these Terms of Service.
            If you do not agree, do not use the Service.
          </p>

          <h2>2. Service Description</h2>
          <p>
            LLM Boost provides website crawling, AI-readiness scoring, and
            visibility analysis tools. The Service crawls publicly accessible
            web pages you authorize, scores them across 37 factors, and provides
            recommendations to improve visibility in AI-generated responses.
          </p>

          <h2>3. Account Registration</h2>
          <p>
            You must create an account via our authentication provider (Clerk)
            to use the Service. You are responsible for maintaining the
            confidentiality of your account credentials and for all activity
            under your account.
          </p>

          <h2>4. Subscriptions and Billing</h2>
          <p>
            Paid plans are billed monthly via Stripe. You authorize recurring
            charges to your payment method. You may cancel at any time; access
            continues through the end of the current billing period. Refunds are
            handled on a case-by-case basis.
          </p>
          <ul>
            <li>
              Free plan: limited to 10 pages/crawl, 2 crawls/month, 1 project.
            </li>
            <li>
              Starter ($79/mo), Pro ($149/mo), Agency ($299/mo): see{" "}
              <Link href="/pricing" className="text-primary underline">
                Pricing
              </Link>{" "}
              for details.
            </li>
          </ul>

          <h2>5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>
              Crawl domains you do not own or have authorization to crawl.
            </li>
            <li>Attempt to circumvent rate limits or plan restrictions.</li>
            <li>
              Use the Service to generate spam, phishing, or malicious content.
            </li>
            <li>
              Reverse-engineer, decompile, or extract source code from the
              Service.
            </li>
          </ul>

          <h2>6. Intellectual Property</h2>
          <p>
            You retain ownership of your website content. We retain ownership of
            the Service, scoring algorithms, and generated reports. Scores and
            recommendations are provided for your internal use.
          </p>

          <h2>7. Data Handling</h2>
          <p>
            Crawled page data is stored on Cloudflare R2 and Neon PostgreSQL. We
            do not sell your data. See our{" "}
            <Link href="/privacy" className="text-primary underline">
              Privacy Policy
            </Link>{" "}
            for details on data collection, storage, and retention.
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            The Service is provided &quot;as is&quot; without warranties of any
            kind. LLM Boost shall not be liable for indirect, incidental, or
            consequential damages. Our total liability shall not exceed the fees
            paid by you in the 12 months preceding the claim.
          </p>

          <h2>9. Termination</h2>
          <p>
            We may suspend or terminate your account for violation of these
            Terms. You may delete your account at any time via Settings. Upon
            termination, your data will be deleted within 30 days.
          </p>

          <h2>10. Changes to Terms</h2>
          <p>
            We may update these Terms. Material changes will be communicated via
            email. Continued use after changes constitutes acceptance.
          </p>

          <h2>11. Contact</h2>
          <p>
            Questions about these Terms? Contact us at{" "}
            <a
              href="mailto:legal@llmboost.app"
              className="text-primary underline"
            >
              legal@llmboost.app
            </a>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} LLM Boost</span>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
        </div>
      </footer>
    </div>
  );
}
