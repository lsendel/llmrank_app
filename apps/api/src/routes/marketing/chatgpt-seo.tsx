/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { MarketingPage } from "../../views/marketing";

export const marketingChatgptSeoRoutes = new Hono<AppEnv>();

marketingChatgptSeoRoutes.get("/chatgpt-seo", (c) => {
  return c.html(
    <MarketingPage title="ChatGPT SEO Guide - How to Rank in ChatGPT Answers">
      <section class="px-6 py-24 text-center">
        <div class="mx-auto max-w-4xl">
          <h1 class="text-4xl font-bold tracking-tight sm:text-6xl">
            How to Rank in <span class="text-blue-600">ChatGPT</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-gray-500">
            Optimization for Large Language Models (LLMs) is the new SEO. Audit
            your site to see if ChatGPT trusts your content.
          </p>
          <div class="mt-10">
            <a
              href="/scan"
              class="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700"
            >
              Check My ChatGPT Visibility
            </a>
          </div>
        </div>
      </section>

      <section class="bg-gray-50 px-6 py-20">
        <div class="mx-auto grid max-w-6xl gap-12 md:grid-cols-3">
          {[
            {
              title: "Entity Optimization",
              desc: "ChatGPT understands concepts, not just keywords. We check if your content clearly defines entities and relationships.",
            },
            {
              title: "Citation Worthiness",
              desc: "To be cited, you need stats, original data, and clear 'direct answer' formatting. We score your content against these patterns.",
            },
            {
              title: "Technical Access",
              desc: "Ensure GPTBot can crawl your site. We validate your robots.txt, sitemap, and page speed to ensure AI accessibility.",
            },
          ].map((step) => (
            <div class="space-y-4 text-center">
              <h3 class="text-xl font-bold">{step.title}</h3>
              <p class="text-gray-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section class="px-6 py-20">
        <div class="mx-auto max-w-3xl space-y-8">
          <div>
            <h2 class="text-3xl font-bold">Optimization for the Chat Era</h2>
            <p class="mt-4 text-lg leading-relaxed text-gray-500">
              Users trust ChatGPT to summarize complex topics. If your content
              is too verbose, poorly structured, or technically inaccessible,
              ChatGPT will skip it in favor of a competitor.
            </p>
          </div>
          <div>
            <h3 class="text-2xl font-bold">What LLM Rank checks</h3>
            <p class="mt-4 leading-relaxed text-gray-500">
              We simulate an AI crawler on your site immediately. We check for
              Open Graph tags, schema markup, semantic HTML tags, and answer
              brevity-all key factors for AI citation.
            </p>
          </div>
        </div>
      </section>

      <section class="border-t border-gray-200 bg-gray-50 px-6 py-20">
        <div class="mx-auto max-w-3xl">
          <h2 class="mb-10 text-center text-3xl font-bold">
            ChatGPT SEO Questions
          </h2>
          <div class="space-y-6">
            {[
              {
                q: "Does ChatGPT use live data from the web?",
                a: "Yes. ChatGPT with browsing (SearchGPT) can access the live web to answer timely questions. It cites sources with links.",
              },
              {
                q: "How do I get cited in ChatGPT answers?",
                a: "You need comprehensive coverage of your topic, clear logical structure, and avoiding 'fluff'. LLM Rank identifies the exact content gaps preventing you from being cited.",
              },
              {
                q: "Can I block ChatGPT from my site?",
                a: "Yes, you can disallow 'GPTBot' in your robots.txt file. However, this means you will not be cited in ChatGPT answers.",
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
        <h2 class="text-3xl font-bold">Audit your site for ChatGPT</h2>
        <p class="mt-4 text-gray-500">
          See exactly how AI models view your content.
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
