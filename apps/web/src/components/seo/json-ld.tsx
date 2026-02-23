const BASE_URL = "https://llmrank.app";

// ---------------------------------------------------------------------------
// Generic JSON-LD renderer
// ---------------------------------------------------------------------------

/**
 * Renders a JSON-LD script tag for structured data.
 * Safe: all data is hardcoded schema objects, never user input.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Safe: data is always constructed from static schema builders below,
      // never from user-supplied input. JSON.stringify escapes all values.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Schema builders
// ---------------------------------------------------------------------------

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LLM Rank",
    url: BASE_URL,
    logo: `${BASE_URL}/icon.svg`,
    description:
      "AI-Readiness SEO Platform that audits websites for visibility in AI-generated responses.",
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${BASE_URL}/terms`,
    },
  };
}

export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LLM Rank",
    url: BASE_URL,
    description:
      "Audit, score, and improve your website for AI search engines like ChatGPT, Claude, Perplexity, and Gemini.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/scan?url={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LLM Rank",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: BASE_URL,
    description:
      "SaaS platform that crawls websites and scores pages across 37 AI-readiness factors to increase visibility in LLM-powered search engines.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "299",
      priceCurrency: "USD",
      offerCount: 4,
    },
    featureList: [
      "37-factor AI-readiness scoring",
      "Automated website crawling",
      "Lighthouse performance audits",
      "AI visibility checks across ChatGPT, Claude, Perplexity, Gemini",
      "Competitor analysis in AI responses",
      "PDF and DOCX report generation",
      "Google Search Console integration",
    ],
  };
}

interface PricingPlan {
  name: string;
  price: number;
  description: string;
  features: string[];
}

export function productOffersSchema(plans: PricingPlan[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "LLM Rank",
    description: "AI-Readiness SEO Platform with 37-factor scoring engine.",
    brand: { "@type": "Organization", name: "LLM Rank" },
    offers: plans.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      description: plan.description,
      price: String(plan.price),
      priceCurrency: "USD",
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      availability: "https://schema.org/InStock",
      ...(plan.price > 0 && {
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: String(plan.price),
          priceCurrency: "USD",
          billingIncrement: 1,
          unitCode: "MON",
        },
      }),
    })),
  };
}

export function webPageSchema(opts: {
  title: string;
  description: string;
  path: string;
  type?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": opts.type ?? "WebPage",
    name: opts.title,
    description: opts.description,
    url: `${BASE_URL}${opts.path}`,
    isPartOf: { "@type": "WebSite", name: "LLM Rank", url: BASE_URL },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${BASE_URL}${item.path}`,
    })),
  };
}

export function faqSchema(questions: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
}
