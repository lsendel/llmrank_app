import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Bot, Search, CheckCircle2 } from "lucide-react";
import { JsonLd, webPageSchema, faqSchema } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "ChatGPT SEO Guide - How to Rank in ChatGPT Answers",
  description:
    "Learn how to optimize your website for ChatGPT visibility. Audit your content for AI-readiness and get cited in ChatGPT's responses using LLM Rank.",
  openGraph: {
    title: "ChatGPT SEO - Rank in AI Answers",
    description:
      "The ultimate guide and audit tool for ranking in ChatGPT. Ensure your brand is cited when users ask about your industry.",
    url: "https://llmrank.app/chatgpt-seo",
  },
  alternates: {
    canonical: "/chatgpt-seo",
  },
};

const STEPS = [
  {
    icon: Search,
    title: "Entity Optimization",
    description:
      "ChatGPT understands concepts, not just keywords. We check if your content clearly defines entities and relationships.",
  },
  {
    icon: Bot,
    title: "Citation Worthiness",
    description:
      "To be cited, you need stats, original data, and clear 'direct answer' formatting. We score your content against these patterns.",
  },
  {
    icon: CheckCircle2,
    title: "Technical Access",
    description:
      "Ensure GPTBot can crawl your site. We validate your robots.txt, sitemap, and page speed to ensure AI accessibility.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Does ChatGPT use live data from the web?",
    answer:
      "Yes. ChatGPT with browsing (SearchGPT) can access the live web to answer timely questions. It cites sources with links. Optimizing for this requires fast loading speeds, clear HTML structure, and authoritative content.",
  },
  {
    question: "How do I get cited in ChatGPT answers?",
    answer:
      "You need to be seen as a trusted authority. This means having comprehensive coverage of your topic, clear logical structure, and avoiding 'fluff'. LLM Rank identifies the exact content gaps preventing you from being cited.",
  },
  {
    question: "Can I block ChatGPT from my site?",
    answer:
      "Yes, you can disallow 'GPTBot' in your robots.txt file. However, this means you will not be cited in ChatGPT answers, which could result in lost visibility as search behavior shifts to AI.",
  },
];

export default function ChatGptSeoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={webPageSchema({
          title: "ChatGPT SEO Guide - How to Rank in ChatGPT Answers",
          description:
            "Learn how to optimize your website for ChatGPT visibility.",
          path: "/chatgpt-seo",
          type: "WebPage",
        })}
      />
      <JsonLd data={faqSchema(FAQ_ITEMS)} />

      {/* Hero */}
      <section className="bg-background px-6 py-24 text-center">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            How to Rank in <span className="text-primary">ChatGPT</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Optimization for Large Language Models (LLMs) is the new SEO. <br />
            Audit your site to see if ChatGPT trusts your content.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/scan">
              <Button size="lg" className="h-12 px-8 text-base">
                Check My ChatGPT Visibility
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Steps Grid */}
      <section className="bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.title} className="space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <step.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="text-muted-foreground">{step.description}</p>
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
              Optimization for the Chat Era
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Users trust ChatGPT to summarize complex topics. If your content
              is too verbose, poorly structured, or technically inaccessible,
              ChatGPT will skip it in favor of a competitor.
            </p>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">
              What LLM Rank checks
            </h3>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              We simulate an AI crawler on your site immediately. We check for
              Open Graph tags, schema markup, semantic HTML tags, and answer
              brevity—all key factors for AI citation.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-3xl font-bold text-foreground">
            ChatGPT SEO Questions
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
          Audit your site for ChatGPT
        </h2>
        <p className="mt-4 text-muted-foreground">
          See exactly how AI models view your content.
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
