import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Search, BarChart3, Zap } from "lucide-react";
import { JsonLd, webPageSchema, faqSchema } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "AI SEO Tool - How to Rank in ChatGPT & Perplexity",
  description:
    "The complete AI SEO tool for modern search optimization. Audit 37 factors, improve citation-worthiness, and track visibility in ChatGPT, Claude, and Gemini.",
  openGraph: {
    title: "AI SEO Tool - Rank in ChatGPT & Perplexity",
    description:
      "Audit your website for AI-readiness. Get 37 distinct scoring factors to improve visibility in Generative AI search engines.",
    url: "https://llmrank.app/ai-seo-tool",
  },
  alternates: {
    canonical: "/ai-seo-tool",
  },
};

const FEATURES = [
  {
    icon: Search,
    title: "Visibility Analysis",
    description:
      "We query ChatGPT, Claude, Perplexity, and Gemini with brand-specific prompts to see if your content is cited, mentioned, or ignored.",
  },
  {
    icon: BarChart3,
    title: "37-Factor Scoring",
    description:
      "Our engine checks Technical SEO, Content Depth, readability, and structural elements that LLMs rely on to understand and trust your content.",
  },
  {
    icon: Zap,
    title: "Actionable Fixes",
    description:
      "Don't just get a score. Get code snippets and content recommendations prioritized by impact-to-effort ratio for fast optimization.",
  },
];

const FAQ_ITEMS = [
  {
    question: "What is an AI SEO Tool?",
    answer:
      "An AI SEO tool is software designed to help websites rank in generative search engines like ChatGPT, Claude, Perplexity, and Google Gemini. Unlike traditional SEO tools that focus on blue links, AI SEO tools optimize for 'citation-worthiness'—ensuring your content is trusted and synthesized by Large Language Models.",
  },
  {
    question: "How is AI SEO different from traditional SEO?",
    answer:
      "Traditional SEO optimizes for keywords and backlinks to rank on a results page. AI SEO optimizes for entities, context, and structural clarity to be 'read' and 'understood' by an AI model. The goal is to be part of the generated answer, not just a link in a list.",
  },
  {
    question: "Does this tool work for any website?",
    answer:
      "Yes. LLM Rank can audit any publicly accessible URL. It is particularly effective for content-heavy sites, SaaS documentation, blogs, and e-commerce sites where authority and depth are critical for AI trust.",
  },
];

export default function AiSeoToolPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={webPageSchema({
          title: "AI SEO Tool - How to Rank in ChatGPT & Perplexity",
          description:
            "The complete AI SEO tool for modern search optimization.",
          path: "/ai-seo-tool",
          type: "WebPage",
        })}
      />
      <JsonLd data={faqSchema(FAQ_ITEMS)} />

      {/* Hero */}
      <section className="bg-background px-6 py-24 text-center">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            The AI SEO Tool for the <br />
            <span className="text-primary">Generative Search Era</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Don&apos;t leave your AI visibility to chance. Audit your site, fix
            technical gaps, and become the trusted source for ChatGPT, Claude,
            and Perplexity.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/scan">
              <Button size="lg" className="h-12 px-8 text-base">
                Audit My Site Free
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base"
              >
                View Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              Why you need an AI SEO Tool today
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Search behavior is changing correctly. Users are asking detailed
              questions to AI instead of typing keywords into Google. If your
              site isn&apos;t optimized for these models (LLMs), you are
              invisible to this new wave of traffic.
            </p>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">
              Optimization beyond keywords
            </h3>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              LLM Rank checks for things Google might ignore but AI loves: clear
              semantic HTML, direct answer formatting, logical content
              hierarchy, and authoritative entity coverage. We help you
              translate your expertise into a format machines can easily digest
              and cite.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-3xl font-bold text-foreground">
            Common Questions about AI SEO
          </h2>
          <div className="space-y-6">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.question}
                className="rounded-lg border border-border bg-background p-6"
              >
                <h3 className="font-bold text-foreground">{item.question}</h3>
                <p className="mt-2 text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20 text-center">
        <h2 className="text-3xl font-bold text-foreground">
          Start your AI SEO journey
        </h2>
        <p className="mt-4 text-muted-foreground">
          Get your baseline AI-readiness score in under 2 minutes.
        </p>
        <div className="mt-8">
          <Link href="/scan">
            <Button size="lg">Run Free Audit</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
