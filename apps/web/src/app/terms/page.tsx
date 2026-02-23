import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, webPageSchema } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Terms of Service — AI-Readiness",
  description:
    "LLM Rank terms of service covering account usage, billing, data handling, and acceptable use of the AI-readiness platform.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | LLM Rank",
    description:
      "Terms of service for LLM Rank, the AI-readiness SEO platform covering account usage, billing, and data handling.",
    url: "https://llmrank.app/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={webPageSchema({
          title: "Terms of Service",
          description:
            "LLM Rank terms of service covering account usage, billing, data handling, and acceptable use.",
          path: "/terms",
          type: "WebPage",
        })}
      />
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-primary"
          >
            LLM Rank
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
            By using LLM Rank (&quot;the Service&quot;), you agree to these
            Terms. LLM Rank Inc. operates the Service. If you do not agree with
            these Terms, please do not use the Service.
          </p>

          <h2>2. Service Description</h2>
          <p>
            LLM Rank provides website crawling, AI-readiness scoring, and
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
            You own your website content. We own the Service, our scoring
            algorithms, and generated reports. We license scores and
            recommendations to you for your internal use only.
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
            We provide the Service &quot;as is&quot; without warranties. We are
            not liable for indirect or consequential damages. The most we owe
            you is a refund of the fees you paid in the 12 months before the
            claim.
          </p>

          <h2>9. Termination</h2>
          <p>
            We may suspend or close your account if you break these Terms. You
            can delete your account at any time from Settings. After you delete
            your account, we remove your data within 30 days.
          </p>

          <h2>10. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will email you about
            major changes. If you keep using the Service after changes take
            effect, you accept the updated Terms.
          </p>

          <h2>11. Contact</h2>
          <p>
            Questions about these Terms? Email us at{" "}
            <a
              href="mailto:legal@llmboost.app"
              className="text-primary underline"
            >
              legal@llmboost.app
            </a>
            .
          </p>
          <p className="mt-4">
            You can also review our{" "}
            <Link
              href="/privacy"
              className="font-medium text-primary hover:underline"
            >
              privacy policy
            </Link>{" "}
            or{" "}
            <Link
              href="/pricing"
              className="font-medium text-primary hover:underline"
            >
              pricing plans
            </Link>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} LLM Rank</span>
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
