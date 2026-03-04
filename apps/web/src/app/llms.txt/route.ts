const BASE_URL = "https://llmrank.app";

const LLMS_TXT = `# LLM Rank
> LLM Rank is an AI Search Optimization platform for marketers and SEO teams. We help teams audit websites, prioritize fixes, and improve visibility in AI-generated search results.

## Key Pages
- [Free AI SEO Scanner](${BASE_URL}/scan): Run a 37-factor AI-readiness audit for any domain.
- [Pricing](${BASE_URL}/pricing): Plan tiers, feature limits, and rollout guidance.
- [AI SEO Tool](${BASE_URL}/ai-seo-tool): Product overview and implementation approach.
- [ChatGPT SEO Guide](${BASE_URL}/chatgpt-seo): ChatGPT-focused optimization guidance.
- [Integrations](${BASE_URL}/integrations): Connect Search Console, GA4, and related data sources.
- [MCP for SEO Agents](${BASE_URL}/mcp): Programmatic SEO tooling for AI agents.

## Product Concepts
- AI Search Optimization (AISO): Optimization for citation and mention likelihood in LLM answers.
- AI Readiness Score: Composite score across technical SEO, content quality, AI readiness, and performance.
- Visibility Monitoring: Ongoing prompt-based checks across major AI answer engines.

## Audience
- SEO managers
- Content leads
- Growth marketers
- Agency teams

## Contact
- [Start with a free scan](${BASE_URL}/scan)
- [View pricing](${BASE_URL}/pricing)
`;

export function GET() {
  return new Response(LLMS_TXT, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
