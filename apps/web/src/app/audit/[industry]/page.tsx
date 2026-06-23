import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Factory, Search, Zap } from "lucide-react";
import { JsonLd, webPageSchema } from "@/components/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo-metadata";

// List of target industries for programmatic SEO
const INDUSTRIES = [
  "saas",
  "ecommerce",
  "healthcare",
  "legal",
  "startups",
  "agencies",
  "fintech",
  "real-estate",
];

export async function generateStaticParams() {
  return INDUSTRIES.map((industry) => ({
    industry,
  }));
}

type Props = {
  params: Promise<{ industry: string }>; // Updated for Next.js 15+ async params
};

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { industry } = await params;
  const capitalizedIndustry = capitalize(industry);

  return {
    ...buildPublicMetadata({
      title: `AI SEO Audit for ${capitalizedIndustry} - Rank in ChatGPT & Perplexity`,
      description: `Audit your ${capitalizedIndustry} website for AI-readiness across 37 factors. Improve visibility in ChatGPT, Claude, and Gemini with our specialized audit tool.`,
      path: `/audit/${industry}`,
      openGraphTitle: `AI Search Optimization for ${capitalizedIndustry}`,
      openGraphDescription: `Don't be invisible to AI. Audit your ${capitalizedIndustry} website and get cited in generative search answers.`,
    }),
  };
}

export default async function IndustryAuditPage({ params }: Props) {
  const { industry } = await params;
  const capitalizedIndustry = capitalize(industry);
  const title = `AI SEO for ${capitalizedIndustry}`;

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd
        data={webPageSchema({
          title: `AI SEO Audit for ${capitalizedIndustry}`,
          description: `Optimize your ${capitalizedIndustry} website for AI search engines like ChatGPT and Perplexity.`,
          path: `/audit/${industry}`,
          type: "WebPage",
        })}
      />

      {/* Hero */}
      <section className="bg-background px-6 py-24 text-center">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Factory className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            {title}: Rank in <br />
            <span className="text-primary">ChatGPT & Perplexity</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            {capitalizedIndustry} buyers are researching with AI. Is your brand
            visible in the answers? Run a free audit to see if you are being
            cited.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/scan">
              <Button size="lg" className="h-12 px-8 text-base">
                Audit My {capitalizedIndustry} Site
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-foreground">
            Why {capitalizedIndustry} companies lose traffic to AI
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Traditional SEO focuses on keywords. But in {industry}, users ask
            complex questions. AI models synthesize answers from authoritative
            sources. If your content lacks clear entity structuring and depth,
            you get ignored.
          </p>
        </div>
      </section>

      {/* Solution */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 md:grid-cols-3">
            <div className="space-y-4 rounded-lg border border-border p-6">
              <Search className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-bold text-foreground">
                Visibility Check
              </h3>
              <p className="text-muted-foreground">
                We check if your {industry} brand is mentioned in ChatGPT,
                Claude, and Perplexity answers for common industry queries.
              </p>
            </div>
            <div className="space-y-4 rounded-lg border border-border p-6">
              <Zap className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-bold text-foreground">
                Technical Audit
              </h3>
              <p className="text-muted-foreground">
                Does your schema markup match {capitalizedIndustry} standards?
                We validate your structured data for AI crawlers.
              </p>
            </div>
            <div className="space-y-4 rounded-lg border border-border p-6">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <h3 className="text-xl font-bold text-foreground">
                Authority Score
              </h3>
              <p className="text-muted-foreground">
                See how authoritative your content is considered by LLMs
                compared to other {industry} competitors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20 text-center">
        <h2 className="text-3xl font-bold text-foreground">
          Get your {capitalizedIndustry} AI-Readiness Score
        </h2>
        <p className="mt-4 text-muted-foreground">
          Identify the exact fixes needed to rank in generative search.
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
