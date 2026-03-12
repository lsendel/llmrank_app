/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { MarketingPage } from "../../views/marketing";

export const marketingToolRoutes = new Hono<AppEnv>();
marketingToolRoutes.get("/ai-seo-tool", (c) => {
  return c.html(
    <MarketingPage title="AI SEO Tool - How to Rank in ChatGPT & Perplexity">
      <section class="px-6 py-24 text-center">
        <div class="mx-auto max-w-4xl">
          <h1 class="text-4xl font-bold tracking-tight sm:text-6xl">
            The AI SEO Tool for the{" "}
            <span class="text-blue-600">Generative Search Era</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
            Don't leave your AI visibility to chance. Audit your site, fix
            technical gaps, and become the trusted source for ChatGPT, Claude,
            and Perplexity.
          </p>
          <div class="mt-10 flex items-center justify-center gap-4">
            <a
              href="/scan"
              class="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700"
            >
              Audit My Site Free
            </a>
            <a
              href="/pricing"
              class="rounded-lg border border-gray-300 px-8 py-3 text-base font-semibold hover:bg-gray-50"
            >
              View Plans
            </a>
          </div>
        </div>
      </section>

      <section class="bg-gray-50 px-6 py-20">
        <div class="mx-auto grid max-w-6xl gap-12 md:grid-cols-3">
          {[
            {
              title: "Visibility Analysis",
              desc: "We query ChatGPT, Claude, Perplexity, and Gemini with brand-specific prompts to see if your content is cited, mentioned, or ignored.",
            },
            {
              title: "37-Factor Scoring",
              desc: "Our engine checks Technical SEO, Content Depth, readability, and structural elements that LLMs rely on to understand and trust your content.",
            },
            {
              title: "Actionable Fixes",
              desc: "Don't just get a score. Get code snippets and content recommendations prioritized by impact-to-effort ratio.",
            },
          ].map((f) => (
            <div class="space-y-4 text-center">
              <h3 class="text-xl font-bold">{f.title}</h3>
              <p class="text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section class="px-6 py-20">
        <div class="mx-auto max-w-3xl space-y-8">
          <div>
            <h2 class="text-3xl font-bold">
              Why you need an AI SEO Tool today
            </h2>
            <p class="mt-4 text-lg leading-relaxed text-gray-500">
              Search behavior is changing. Users are asking detailed questions
              to AI instead of typing keywords into Google. If your site isn't
              optimized for these models, you are invisible to this new wave of
              traffic.
            </p>
          </div>
          <div>
            <h3 class="text-2xl font-bold">Optimization beyond keywords</h3>
            <p class="mt-4 leading-relaxed text-gray-500">
              LLM Rank checks for things Google might ignore but AI loves: clear
              semantic HTML, direct answer formatting, logical content
              hierarchy, and authoritative entity coverage.
            </p>
          </div>
        </div>
      </section>

      <section class="border-t border-gray-200 bg-gray-50 px-6 py-20">
        <div class="mx-auto max-w-3xl">
          <h2 class="mb-10 text-center text-3xl font-bold">
            Common Questions about AI SEO
          </h2>
          <div class="space-y-6">
            {[
              {
                q: "What is an AI SEO Tool?",
                a: "An AI SEO tool optimizes for citation-worthiness in generative search engines like ChatGPT, Claude, Perplexity, and Gemini, not just traditional blue links.",
              },
              {
                q: "How is AI SEO different from traditional SEO?",
                a: "Traditional SEO optimizes for keywords and backlinks. AI SEO optimizes for entities, context, and structural clarity to be 'read' and 'understood' by an AI model.",
              },
              {
                q: "Does this tool work for any website?",
                a: "Yes. LLM Rank can audit any publicly accessible URL. It is particularly effective for content-heavy sites, SaaS documentation, and blogs.",
              },
            ].map((item) => (
              <div class="rounded-lg border border-gray-200 bg-white p-6">
                <h3 class="font-bold">{item.q}</h3>
                <p class="mt-2 text-gray-500">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section class="border-t border-gray-200 py-20 text-center">
        <h2 class="text-3xl font-bold">Start your AI SEO journey</h2>
        <p class="mt-4 text-gray-500">
          Get your baseline AI-readiness score in under 2 minutes.
        </p>
        <div class="mt-8">
          <a
            href="/scan"
            class="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Run Free Audit
          </a>
        </div>
      </section>
    </MarketingPage>,
  );
});


