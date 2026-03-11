/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { MarketingPage } from "../../views/marketing";

export const marketingLegalRoutes = new Hono<AppEnv>();
marketingLegalRoutes.get("/privacy", (c) => {
  return c.html(
    <MarketingPage title="Privacy Policy">
      <main class="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 class="text-3xl font-bold">Privacy Policy</h1>
        <p class="mt-2 text-sm text-gray-500">Last updated: February 2026</p>

        <div class="mt-10 space-y-8 text-gray-700 leading-7">
          <section>
            <h2 class="text-xl font-semibold">1. Information We Collect</h2>
            <p class="mt-4 text-gray-500">
              <strong class="text-gray-700">Account data:</strong> Email
              address, name, and phone number provided during registration.
            </p>
            <p class="mt-4 text-gray-500">
              <strong class="text-gray-700">Crawl data:</strong> Publicly
              accessible HTML content, metadata, and Lighthouse performance
              metrics from websites you authorize us to crawl.
            </p>
            <p class="mt-4 text-gray-500">
              <strong class="text-gray-700">Usage data:</strong> API request
              logs, feature usage patterns, and session timestamps.
            </p>
            <p class="mt-4 text-gray-500">
              <strong class="text-gray-700">Billing data:</strong> Payment
              information is processed by Stripe. We store subscription status,
              plan type, and invoice references — never raw card numbers.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">2. How We Use Your Data</h2>
            <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-500">
              <li>Score your pages across 37 AI-readiness factors.</li>
              <li>Generate visibility reports and recommendations.</li>
              <li>Send transactional emails via Resend.</li>
              <li>Enforce plan limits and billing.</li>
              <li>Improve the Service based on aggregate usage patterns.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold">3. Third-Party Services</h2>
            <div class="mt-4 overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200">
                    <th class="pb-2 pr-6 text-left font-medium">Service</th>
                    <th class="pb-2 pr-6 text-left font-medium">Purpose</th>
                    <th class="pb-2 text-left font-medium">Data shared</th>
                  </tr>
                </thead>
                <tbody class="text-gray-500">
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-6">Clerk</td>
                    <td class="py-2 pr-6">Authentication</td>
                    <td class="py-2">Email, name, session tokens</td>
                  </tr>
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-6">Stripe</td>
                    <td class="py-2 pr-6">Billing</td>
                    <td class="py-2">Payment method, email</td>
                  </tr>
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-6">Neon</td>
                    <td class="py-2 pr-6">Database</td>
                    <td class="py-2">
                      All application data (encrypted at rest)
                    </td>
                  </tr>
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-6">Cloudflare</td>
                    <td class="py-2 pr-6">Hosting, CDN</td>
                    <td class="py-2">Request metadata, crawled HTML</td>
                  </tr>
                  <tr class="border-b border-gray-100">
                    <td class="py-2 pr-6">Anthropic / OpenAI</td>
                    <td class="py-2 pr-6">Content scoring</td>
                    <td class="py-2">Page text snippets (no PII)</td>
                  </tr>
                  <tr>
                    <td class="py-2 pr-6">Resend</td>
                    <td class="py-2 pr-6">Email</td>
                    <td class="py-2">Email address, email content</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 class="text-xl font-semibold">4. Data Storage and Security</h2>
            <p class="mt-4 text-gray-500">
              Data is stored in Neon PostgreSQL (encrypted at rest, TLS
              connections). Crawled HTML goes to Cloudflare R2 (encrypted at
              rest). All API calls use HTTPS. Services use HMAC-SHA256 signed
              messages.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">5. Data Retention</h2>
            <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-500">
              <li>Active accounts: data kept while account is open.</li>
              <li>
                Crawl data: stored for your plan's history window (30 days to 2
                years).
              </li>
              <li>Deleted accounts: data removed within 30 days.</li>
              <li>Billing records: kept for 7 years as required by law.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold">6. Your Rights</h2>
            <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-500">
              <li>Access and export your data via the dashboard or API.</li>
              <li>Correct your account information in Settings.</li>
              <li>Delete your account and all associated data.</li>
              <li>Request a copy of all data we hold about you.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold">7. Cookies</h2>
            <p class="mt-4 text-gray-500">
              We only use cookies to keep you logged in. No advertising or
              tracking cookies.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">8. Children</h2>
            <p class="mt-4 text-gray-500">
              This Service is not for anyone under 16. We do not knowingly
              collect data from children.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">9. Changes to This Policy</h2>
            <p class="mt-4 text-gray-500">
              We may update this policy. We will email you about major changes.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">10. Contact</h2>
            <p class="mt-4 text-gray-500">
              Email us at{" "}
              <a
                href="mailto:privacy@llmboost.app"
                class="text-blue-600 underline"
              >
                privacy@llmboost.app
              </a>
              . See also our{" "}
              <a
                href="/terms"
                class="font-medium text-blue-600 hover:underline"
              >
                terms of service
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </MarketingPage>,
  );
});

// ---------------------------------------------------------------------------
// Terms page (/terms)
// ---------------------------------------------------------------------------

marketingLegalRoutes.get("/terms", (c) => {
  return c.html(
    <MarketingPage title="Terms of Service">
      <main class="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 class="text-3xl font-bold">Terms of Service</h1>
        <p class="mt-2 text-sm text-gray-500">Last updated: February 2026</p>

        <div class="mt-10 space-y-8 text-gray-700 leading-7">
          <section>
            <h2 class="text-xl font-semibold">1. Acceptance of Terms</h2>
            <p class="mt-4 text-gray-500">
              By using LLM Rank ("the Service"), you agree to these Terms. LLM
              Boost Inc. operates the Service. If you do not agree, please do
              not use the Service.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">2. Service Description</h2>
            <p class="mt-4 text-gray-500">
              LLM Rank provides website crawling, AI-readiness scoring, and
              visibility analysis tools. The Service crawls publicly accessible
              web pages you authorize, scores them across 37 factors, and
              provides recommendations.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">3. Account Registration</h2>
            <p class="mt-4 text-gray-500">
              You must create an account to use the Service. You are responsible
              for maintaining account credential confidentiality and all
              activity under your account.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">4. Subscriptions and Billing</h2>
            <p class="mt-4 text-gray-500">
              Paid plans are billed monthly via Stripe. You may cancel at any
              time; access continues through the current billing period.
            </p>
            <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-500">
              <li>Free: 10 pages/crawl, 2 crawls/month, 1 project.</li>
              <li>
                Starter ($79/mo), Pro ($149/mo), Agency ($299/mo): see{" "}
                <a href="/pricing" class="text-blue-600 underline">
                  Pricing
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold">5. Acceptable Use</h2>
            <p class="mt-4 text-gray-500">You agree not to:</p>
            <ul class="mt-2 list-disc space-y-1 pl-6 text-gray-500">
              <li>
                Crawl domains you do not own or have authorization to crawl.
              </li>
              <li>Attempt to circumvent rate limits or plan restrictions.</li>
              <li>Use the Service for spam, phishing, or malicious content.</li>
              <li>Reverse-engineer or extract source code from the Service.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold">6. Intellectual Property</h2>
            <p class="mt-4 text-gray-500">
              You own your website content. We own the Service, scoring
              algorithms, and generated reports. Scores and recommendations are
              licensed for your internal use.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">7. Data Handling</h2>
            <p class="mt-4 text-gray-500">
              We do not sell your data. See our{" "}
              <a href="/privacy" class="text-blue-600 underline">
                Privacy Policy
              </a>{" "}
              for details.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">8. Limitation of Liability</h2>
            <p class="mt-4 text-gray-500">
              We provide the Service "as is" without warranties. Maximum
              liability is limited to fees paid in the 12 months before the
              claim.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">9. Termination</h2>
            <p class="mt-4 text-gray-500">
              We may suspend accounts that violate these Terms. You can delete
              your account at any time; data is removed within 30 days.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">10. Changes to Terms</h2>
            <p class="mt-4 text-gray-500">
              We may update these Terms. Continued use constitutes acceptance of
              changes.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold">11. Contact</h2>
            <p class="mt-4 text-gray-500">
              Email us at{" "}
              <a
                href="mailto:legal@llmboost.app"
                class="text-blue-600 underline"
              >
                legal@llmboost.app
              </a>
              . See also our{" "}
              <a
                href="/privacy"
                class="font-medium text-blue-600 hover:underline"
              >
                privacy policy
              </a>{" "}
              and{" "}
              <a
                href="/pricing"
                class="font-medium text-blue-600 hover:underline"
              >
                pricing plans
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </MarketingPage>,
  );
});

