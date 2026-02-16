import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, webPageSchema } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "LLM Boost privacy policy explaining how we collect, use, and protect your data when using our AI-readiness SEO platform.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={webPageSchema({
          title: "Privacy Policy",
          description: "How LLM Boost collects, uses, and protects your data.",
          path: "/privacy",
          type: "WebPage",
        })}
      />
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
        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: February 2026
        </p>

        <div className="prose mt-10 max-w-none text-foreground [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-4 [&_p]:leading-7 [&_p]:text-muted-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:text-muted-foreground [&_td]:py-2 [&_td]:pr-6 [&_td]:text-muted-foreground [&_th]:pb-2 [&_th]:pr-6 [&_th]:text-left [&_th]:font-medium">
          <h2>1. Information We Collect</h2>
          <p>
            <strong>Account data:</strong> Email address, name, and phone number
            provided during registration via Clerk (our authentication
            provider).
          </p>
          <p>
            <strong>Crawl data:</strong> Publicly accessible HTML content,
            metadata, and Lighthouse performance metrics from websites you
            authorize us to crawl.
          </p>
          <p>
            <strong>Usage data:</strong> API request logs, feature usage
            patterns, and session timestamps for service improvement.
          </p>
          <p>
            <strong>Billing data:</strong> Payment information is processed
            directly by Stripe. We store subscription status, plan type, and
            invoice references — never raw card numbers.
          </p>

          <h2>2. How We Use Your Data</h2>
          <ul>
            <li>Score your pages across 37 AI-readiness factors.</li>
            <li>Generate visibility reports and recommendations.</li>
            <li>
              Send transactional emails (crawl results, score alerts) via
              Resend.
            </li>
            <li>Enforce plan limits and billing.</li>
            <li>Improve the Service based on aggregate usage patterns.</li>
          </ul>

          <h2>3. Third-Party Services</h2>
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Purpose</th>
                <th>Data shared</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Clerk</td>
                <td>Authentication</td>
                <td>Email, name, session tokens</td>
              </tr>
              <tr>
                <td>Stripe</td>
                <td>Billing</td>
                <td>Payment method, email</td>
              </tr>
              <tr>
                <td>Neon</td>
                <td>Database</td>
                <td>All application data (encrypted at rest)</td>
              </tr>
              <tr>
                <td>Cloudflare</td>
                <td>Hosting, CDN, object storage</td>
                <td>Request metadata, crawled HTML</td>
              </tr>
              <tr>
                <td>Anthropic / OpenAI</td>
                <td>Content scoring / visibility checks</td>
                <td>Page text snippets (no PII)</td>
              </tr>
              <tr>
                <td>Resend</td>
                <td>Transactional email</td>
                <td>Email address, email content</td>
              </tr>
            </tbody>
          </table>

          <h2>4. Data Storage and Security</h2>
          <p>
            Application data is stored in Neon PostgreSQL (encrypted at rest,
            TLS in transit). Crawled HTML is stored in Cloudflare R2 (encrypted
            at rest). All API communication uses HTTPS. Internal service
            communication is HMAC-SHA256 authenticated.
          </p>

          <h2>5. Data Retention</h2>
          <ul>
            <li>Active accounts: data retained while account is active.</li>
            <li>
              Crawl data: retained for the history window of your plan (30 days
              to 2 years).
            </li>
            <li>
              Deleted accounts: all data permanently removed within 30 days.
            </li>
            <li>
              Billing records: retained for 7 years per financial regulations.
            </li>
          </ul>

          <h2>6. Your Rights</h2>
          <p>You may at any time:</p>
          <ul>
            <li>Access and export your data via the dashboard or API.</li>
            <li>Correct your account information in Settings.</li>
            <li>Delete your account and all associated data.</li>
            <li>Request a copy of all data we hold about you.</li>
          </ul>

          <h2>7. Cookies</h2>
          <p>
            We use essential session cookies for authentication (via Clerk). We
            do not use advertising or tracking cookies.
          </p>

          <h2>8. Children</h2>
          <p>
            The Service is not intended for children under 16. We do not
            knowingly collect data from children.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy. Material changes will be
            communicated via email. The &quot;Last updated&quot; date at the top
            will be revised accordingly.
          </p>

          <h2>10. Contact</h2>
          <p>
            Data protection questions? Contact us at{" "}
            <a
              href="mailto:privacy@llmboost.app"
              className="text-primary underline"
            >
              privacy@llmboost.app
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
