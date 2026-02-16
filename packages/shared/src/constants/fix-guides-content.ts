import type { FixGuide } from "./fix-guides";

export const CONTENT_GUIDES: Record<string, FixGuide> = {
  THIN_CONTENT: {
    issueCode: "THIN_CONTENT",
    title: "Expand Thin Content to 500+ Words",
    estimatedMinutes: 60,
    difficulty: "advanced",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Audit the existing content",
          description:
            "Identify the page's primary topic and list subtopics, questions, and angles that are missing. Use tools like AlsoAsked or AnswerThePublic to find related queries your audience is searching for.",
          tip: "Aim for at least 500 words of substantive body text. Pages under 200 words are flagged as critically thin.",
        },
        {
          title: "Expand with supporting sections",
          description:
            "Add sections that cover background context, step-by-step instructions, examples, comparisons, or FAQs. Each new section should add genuine value rather than padding word count.",
          tip: "Break long blocks into paragraphs of 2-4 sentences with descriptive H2/H3 subheadings.",
        },
        {
          title: "Add structured data for the expanded content",
          description:
            "If you added an FAQ or how-to section, mark it up with JSON-LD so AI assistants can parse it directly.",
          codeSnippet: `<script type="application/ld+json">
{ "@context": "https://schema.org",
  "@type": "Article",
  "wordCount": "850",
  "articleBody": "..." }
</script>`,
          language: "html",
        },
      ],
      wordpress: [
        {
          title: "Review word count in the editor",
          description:
            "Open the page in the WordPress block editor. Check the word count in the top-left info panel (click the 'i' icon). Identify where to add depth.",
          tip: "Install the Yoast SEO plugin for real-time content length and readability feedback while editing.",
        },
        {
          title: "Add content blocks",
          description:
            "Use Gutenberg blocks to add new sections: Paragraph, List, Table, or FAQ blocks. Focus on answering related questions and covering subtopics comprehensively.",
        },
        {
          title: "Update the modified date",
          description:
            "After expanding the content, WordPress automatically updates the modified date. Verify it appears in your sitemap by checking /sitemap.xml.",
          tip: "Use a plugin like WP Last Modified Info to display the updated date on the page for freshness signals.",
        },
      ],
      nextjs: [
        {
          title: "Expand the page content component",
          description:
            "Open the page's content file or MDX document. Add new sections with descriptive headings and substantive paragraphs covering subtopics that are currently missing.",
        },
        {
          title: "Use dynamic content generation for SEO metadata",
          description:
            "Update the page's metadata export to reflect the expanded content scope.",
          codeSnippet: `export const metadata = {
  title: "Comprehensive Guide to [Topic]",
  description: "In-depth coverage of [topic]...",
};`,
          language: "javascript",
        },
        {
          title: "Add related content links",
          description:
            "Include a 'Related Articles' or 'Further Reading' section at the bottom to support the expanded content with internal links.",
        },
      ],
    },
  },

  CONTENT_DEPTH: {
    issueCode: "CONTENT_DEPTH",
    title: "Improve Content Depth and Topic Coverage",
    estimatedMinutes: 90,
    difficulty: "advanced",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Map the topic cluster",
          description:
            "List every subtopic, question, and angle a reader would expect to find on a comprehensive page about this subject. Compare against top-ranking pages and AI-generated answers for the same query.",
          tip: "Search your topic in ChatGPT or Perplexity and note what subtopics the AI covers. Your page should address at least those same areas.",
        },
        {
          title: "Add data, examples, and analysis",
          description:
            "Include specific statistics, real-world examples, case studies, or original data. AI models heavily weight pages that provide concrete evidence rather than general statements.",
          tip: "Every claim should be backed by a number, example, or citation. Replace 'many companies' with 'according to a 2025 Gartner survey, 73% of enterprises...'.",
        },
        {
          title: "Cover edge cases and comparisons",
          description:
            "Add sections for common objections, alternatives, pros/cons comparisons, and edge cases. This signals comprehensive expertise to both readers and AI crawlers.",
        },
        {
          title: "Add a summary and key takeaways",
          description:
            "Include a TL;DR section at the top or a Key Takeaways section at the bottom summarizing the page's main points in 3-5 bullet points.",
          codeSnippet: `<h2>Key Takeaways</h2>
<ul>
  <li>First major finding or recommendation</li>
  <li>Second insight with supporting data</li>
  <li>Action item readers can implement today</li>
</ul>`,
          language: "html",
        },
      ],
      wordpress: [
        {
          title: "Audit coverage gaps with SEO tools",
          description:
            "Use Yoast or Rank Math's content analysis to identify missing subtopics. Check the 'Related Keyphrases' suggestions for areas you have not covered.",
        },
        {
          title: "Add structured content blocks",
          description:
            "Use Gutenberg's Table, Comparison, and List blocks to present data visually. Add a Table of Contents block for long-form content to improve navigability.",
          tip: "Pages with a table of contents are 2.5x more likely to appear in featured snippets and AI-generated answers.",
        },
        {
          title: "Incorporate expert quotes or data",
          description:
            "Use the Quote block for expert citations. Use the Table block for data presentation. Ensure every major claim links to a source.",
        },
      ],
      nextjs: [
        {
          title: "Structure content with semantic components",
          description:
            "Break the page into clearly-defined components or MDX sections, each covering a distinct subtopic. Use descriptive prop names and headings.",
          codeSnippet: `<Section heading="How It Works">
  <StepByStep steps={steps} />
</Section>
<Section heading="Comparison">
  <ComparisonTable items={alternatives} />
</Section>`,
          language: "html",
        },
        {
          title: "Add data-driven content",
          description:
            "Fetch and render real data (stats, charts, tables) at build time using server components or getStaticProps. Original data significantly boosts depth scores.",
        },
        {
          title: "Generate a table of contents",
          description:
            "Add an auto-generated table of contents component that extracts headings from the page content. This improves both navigation and AI comprehension.",
        },
      ],
    },
  },

  CONTENT_CLARITY: {
    issueCode: "CONTENT_CLARITY",
    title: "Improve Content Readability and Structure",
    estimatedMinutes: 45,
    difficulty: "intermediate",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Break up long paragraphs",
          description:
            "Split paragraphs longer than 4 sentences into smaller ones. Each paragraph should convey one idea. Use blank lines between paragraphs for visual breathing room.",
          tip: "The ideal web paragraph is 2-3 sentences. If a paragraph has more than 4 lines on screen, split it.",
        },
        {
          title: "Add descriptive subheadings",
          description:
            "Insert H2 and H3 headings every 200-300 words. Headings should be descriptive and tell the reader what that section covers, not just be clever or vague.",
          codeSnippet: `<!-- Bad: vague heading -->
<h2>More Info</h2>
<!-- Good: descriptive heading -->
<h2>How to Configure SSL Certificates</h2>`,
          language: "html",
        },
        {
          title: "Use lists and formatting for scannability",
          description:
            "Convert dense text into bullet points, numbered lists, or bold key terms. Use callout boxes for important tips or warnings. AI models extract structured content more accurately.",
        },
      ],
      wordpress: [
        {
          title: "Use Gutenberg formatting blocks",
          description:
            "Restructure content using List blocks, Heading blocks (H2/H3), and the Separator block between major sections. Use the Columns block for side-by-side comparisons.",
          tip: "Enable Yoast's readability analysis for real-time feedback on paragraph length, subheading distribution, and sentence complexity.",
        },
        {
          title: "Add visual breaks",
          description:
            "Insert images, info boxes, or blockquotes between long text sections. Use the WordPress 'Details' block (accordion) for supplementary information that would otherwise clutter the main flow.",
        },
      ],
      nextjs: [
        {
          title: "Apply typography and spacing components",
          description:
            "Use consistent heading components, paragraph spacing, and list styling. Create reusable Callout or Tip components for important information.",
          codeSnippet: `function Callout({ children, type = "info" }) {
  return (
    <aside className={"callout callout-" + type}>
      {children}
    </aside>
  );
}`,
          language: "javascript",
        },
        {
          title: "Structure MDX content with clear sections",
          description:
            "If using MDX, ensure every 200-300 words has a heading. Use MDX components for lists, tables, and callouts rather than raw HTML.",
        },
      ],
    },
  },

  CONTENT_AUTHORITY: {
    issueCode: "CONTENT_AUTHORITY",
    title: "Add Authority Signals: Citations, Data, and Expertise",
    estimatedMinutes: 60,
    difficulty: "advanced",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Add citations and references",
          description:
            "Link to primary sources for every major claim: research papers, government data, industry reports, or established publications. Use inline links rather than footnotes for better AI parsing.",
          tip: "Cite at least 3-5 external authoritative sources per 1000 words. AI models verify claims against known sources and prioritize well-cited content.",
        },
        {
          title: "Include original data or unique insights",
          description:
            "Add proprietary data, survey results, case study outcomes, or unique analysis that cannot be found elsewhere. This makes your content uniquely valuable and citation-worthy for AI systems.",
        },
        {
          title: "Attribute expertise",
          description:
            "Add author bylines with credentials, expert quotes with attribution, or advisory board mentions. Use schema markup to connect content to recognized experts.",
          codeSnippet: `<script type="application/ld+json">
{ "@context": "https://schema.org",
  "@type": "Article",
  "author": { "@type": "Person",
    "name": "Dr. Jane Smith",
    "jobTitle": "Senior Researcher" } }
</script>`,
          language: "html",
        },
      ],
      wordpress: [
        {
          title: "Add an author box with credentials",
          description:
            "Use a plugin like Simple Author Box or configure your theme's author bio. Include the author's title, qualifications, and links to professional profiles.",
          tip: "Google and AI models increasingly look for author entities. A well-structured author bio with schema markup significantly boosts authority scores.",
        },
        {
          title: "Cite sources inline",
          description:
            "When making claims, link directly to the source. Use the WordPress link tool (Ctrl+K) to add descriptive anchor text. Avoid generic 'click here' links.",
        },
        {
          title: "Add a References section",
          description:
            "Create a 'Sources' or 'References' section at the bottom using a List block. Link each citation to its original source with the publication date.",
        },
      ],
      nextjs: [
        {
          title: "Create a Citation component",
          description:
            "Build a reusable Citation component that renders inline references and auto-generates a bibliography section at the bottom of the page.",
          codeSnippet: `function Citation({ href, source, year }) {
  return (
    <a href={href} rel="noopener"
       className="citation">
      ({source}, {year})
    </a>
  );
}`,
          language: "javascript",
        },
        {
          title: "Add author schema via metadata",
          description:
            "Export structured author metadata using Next.js metadata API or inject JSON-LD in the page layout to associate content with credentialed authors.",
        },
      ],
    },
  },

  DUPLICATE_CONTENT: {
    issueCode: "DUPLICATE_CONTENT",
    title: "Resolve Duplicate Content Issues",
    estimatedMinutes: 30,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Identify the canonical version",
          description:
            "Decide which page should be the primary version. This is typically the page with the most backlinks, the best URL structure, or the most comprehensive content.",
        },
        {
          title: "Add canonical tags to duplicates",
          description:
            "On all duplicate pages, add a canonical link pointing to the primary version. This tells search engines and AI crawlers which page to index and cite.",
          codeSnippet: `<link rel="canonical"
  href="https://example.com/primary-page" />`,
          language: "html",
          tip: "The canonical URL must be absolute (include https:// and the domain). Relative canonical URLs are ignored by most crawlers.",
        },
        {
          title: "Differentiate or consolidate",
          description:
            "Either merge the duplicate pages into one comprehensive resource (set up 301 redirects from the removed pages) or rewrite each page to focus on a distinct angle of the topic.",
        },
      ],
      wordpress: [
        {
          title: "Set canonical URLs in Yoast SEO",
          description:
            "Edit the duplicate page, scroll to the Yoast SEO panel, expand 'Advanced', and enter the canonical URL of the primary page in the 'Canonical URL' field.",
          tip: "If duplicates are caused by taxonomy pages (categories, tags), configure Yoast to noindex those archives or set canonicals in Yoast > Search Appearance > Taxonomies.",
        },
        {
          title: "Set up redirects for removed pages",
          description:
            "If consolidating pages, use the Yoast redirect manager or the Redirection plugin to create 301 redirects from the removed URL to the canonical page.",
        },
      ],
      nextjs: [
        {
          title: "Add canonical to page metadata",
          description:
            "Use the Next.js metadata API to set the canonical URL on duplicate pages.",
          codeSnippet: `export const metadata = {
  alternates: {
    canonical: "https://example.com/primary-page",
  },
};`,
          language: "javascript",
        },
        {
          title: "Implement redirects for consolidated pages",
          description:
            "Add permanent redirects in next.config.js for pages you have merged into a single canonical resource.",
          codeSnippet: `// next.config.js
redirects: async () => [
  { source: "/old-page",
    destination: "/primary-page",
    permanent: true },
],`,
          language: "javascript",
        },
      ],
    },
  },

  STALE_CONTENT: {
    issueCode: "STALE_CONTENT",
    title: "Refresh Stale Content (Older Than 12 Months)",
    estimatedMinutes: 45,
    difficulty: "intermediate",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Audit for outdated information",
          description:
            "Review the page for statistics, dates, product versions, pricing, or recommendations that are no longer current. AI models deprioritize content with clearly outdated information.",
          tip: "Search for years (2023, 2024) and phrases like 'currently', 'recently', 'this year' that may now be inaccurate.",
        },
        {
          title: "Update facts and add recent developments",
          description:
            "Replace outdated data with current figures. Add a section covering recent developments or changes in the topic area. Reference new studies, tools, or best practices that have emerged.",
        },
        {
          title: "Update the published/modified date",
          description:
            "After making substantive updates, update the page's visible 'last updated' date and the dateModified in your structured data. Do not change the date without making real content changes.",
          codeSnippet: `<script type="application/ld+json">
{ "@context": "https://schema.org",
  "@type": "Article",
  "datePublished": "2024-03-15",
  "dateModified": "2026-02-16" }
</script>`,
          language: "html",
        },
      ],
      wordpress: [
        {
          title: "Review and update post content",
          description:
            "Open the post in the editor. Update outdated statistics, links, and recommendations. Add new sections if the topic has evolved significantly since the original publish date.",
        },
        {
          title: "Display the updated date",
          description:
            "Ensure your theme displays the modified date. If not, add it via a plugin like WP Last Modified Info, or add a manual 'Last updated' note at the top of the post.",
          tip: "WordPress automatically updates the modified date when you save. Verify it appears in your sitemap by checking /wp-sitemap.xml.",
        },
      ],
      nextjs: [
        {
          title: "Update content and metadata dates",
          description:
            "After refreshing the content, update the page's metadata to reflect the new modification date.",
          codeSnippet: `export const metadata = {
  other: {
    "article:modified_time": "2026-02-16",
  },
};`,
          language: "javascript",
        },
        {
          title: "Automate freshness signals",
          description:
            "For pages built from data sources (APIs, CMS, databases), use ISR (Incremental Static Regeneration) to keep content fresh automatically and update the modification timestamp on each rebuild.",
        },
      ],
    },
  },

  NO_INTERNAL_LINKS: {
    issueCode: "NO_INTERNAL_LINKS",
    title: "Add Internal Links to Related Pages",
    estimatedMinutes: 15,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Identify related pages on your site",
          description:
            "List 3-5 pages on your site that are topically related to this page. Consider pages that cover subtopics, prerequisites, next steps, or complementary information.",
          tip: "Internal links help AI crawlers discover and understand the relationships between your pages. Aim for at least 3 internal links per page.",
        },
        {
          title: "Add contextual internal links",
          description:
            "Insert links naturally within the body text where they add value for the reader. Use descriptive anchor text that tells both the reader and AI crawlers what the linked page is about.",
          codeSnippet: `<p>Before configuring your server, review our
  <a href="/docs/prerequisites">prerequisite
  checklist</a> to ensure compatibility.</p>`,
          language: "html",
        },
        {
          title: "Add a Related Content section",
          description:
            "If inline links feel forced, add a 'Related Articles' or 'See Also' section at the bottom of the page linking to 3-5 topically relevant pages.",
          codeSnippet: `<h2>Related Articles</h2>
<ul>
  <li><a href="/guide-a">Getting Started with X</a></li>
  <li><a href="/guide-b">Advanced Techniques for Y</a></li>
</ul>`,
          language: "html",
        },
      ],
      wordpress: [
        {
          title: "Add inline links while editing",
          description:
            "Select relevant phrases in your content and use Ctrl+K (or Cmd+K) to search for and link to related posts and pages on your site.",
          tip: "Use a plugin like Link Whisper or Yoast's internal linking suggestions to automatically find related pages you can link to.",
        },
        {
          title: "Add a Related Posts block",
          description:
            "Add a 'Latest Posts' or 'Query Loop' block at the bottom of the page, filtered to the same category or tag, to automatically display related content.",
        },
      ],
      nextjs: [
        {
          title: "Use Next.js Link for internal navigation",
          description:
            "Replace any raw anchor tags for internal pages with the Next.js Link component for client-side navigation and prefetching.",
          codeSnippet: `import Link from "next/link";

<Link href="/docs/related-topic">
  Learn about related topic
</Link>`,
          language: "javascript",
        },
        {
          title: "Build a RelatedPages component",
          description:
            "Create a reusable component that accepts related page slugs and renders a consistent 'Related Articles' section. This ensures every page gets internal links.",
        },
      ],
    },
  },

  EXCESSIVE_LINKS: {
    issueCode: "EXCESSIVE_LINKS",
    title: "Balance External and Internal Link Ratio",
    estimatedMinutes: 20,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Audit your link profile",
          description:
            "Count the number of internal links versus external links on the page. If external links outnumber internal links by more than 3:1, the page appears to be directing value away from your site.",
          tip: "A healthy ratio is roughly 1:1 or more internal links than external. Every external link should serve a clear purpose (citation, resource, attribution).",
        },
        {
          title: "Add internal links to rebalance",
          description:
            "The easiest fix is to add more internal links rather than removing useful external ones. Link to related content, guides, product pages, or glossary entries on your own site.",
        },
        {
          title: "Remove low-value external links",
          description:
            "Remove external links that do not add value for the reader: redundant links to the same domain, links to generic homepages instead of specific resources, or affiliate links that clutter the content.",
        },
      ],
      wordpress: [
        {
          title: "Use Link Whisper to find internal link opportunities",
          description:
            "Install the Link Whisper plugin. It scans your content and suggests internal links you can add with one click, quickly improving your internal-to-external ratio.",
        },
        {
          title: "Review and clean up external links",
          description:
            "Use the Broken Link Checker plugin to audit all outbound links. Remove or replace links that go to irrelevant pages, 404s, or low-quality sources.",
        },
      ],
      nextjs: [
        {
          title: "Audit links programmatically",
          description:
            "Write a simple script or use your build pipeline to count internal vs. external links per page and flag those exceeding the 1:3 ratio.",
          codeSnippet: `// Count links in rendered HTML
const internal = doc.querySelectorAll(
  'a[href^="/"], a[href*="yoursite.com"]'
);
const external = doc.querySelectorAll(
  'a[href^="http"]:not([href*="yoursite"])'
);`,
          language: "javascript",
        },
        {
          title: "Add contextual internal links in content",
          description:
            "Review each page's content and add Next.js Link components pointing to related pages on your site. Prioritize links that help users navigate your content naturally.",
        },
      ],
    },
  },

  MISSING_FAQ_STRUCTURE: {
    issueCode: "MISSING_FAQ_STRUCTURE",
    title: "Add FAQ Schema and Q&A Formatting",
    estimatedMinutes: 30,
    difficulty: "intermediate",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Identify questions your content answers",
          description:
            "Review the page and list 3-8 questions that the content addresses, even implicitly. Look for paragraphs that explain 'how', 'why', 'what', or compare options.",
          tip: "AI assistants are trained to extract question-answer pairs. Explicitly formatting them as Q&A dramatically increases the chance your content is cited in conversational AI responses.",
        },
        {
          title: "Restructure content into Q&A format",
          description:
            "Add each question as an H2 or H3 heading, followed by a concise, direct answer in the first 1-2 sentences, then supporting details.",
          codeSnippet: `<h2>How long does installation take?</h2>
<p>Installation typically takes 15-30 minutes.
The process involves downloading the package,
configuring settings, and running the wizard.</p>`,
          language: "html",
        },
        {
          title: "Add FAQPage schema markup",
          description:
            "Add JSON-LD structured data marking up your Q&A content as an FAQPage. This enables rich results and helps AI models identify your Q&A pairs.",
          codeSnippet: `<script type="application/ld+json">
{ "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "How long does installation take?",
    "acceptedAnswer": { "@type": "Answer",
      "text": "Installation takes 15-30 min." }
  }] }
</script>`,
          language: "html",
          docsUrl:
            "https://developers.google.com/search/docs/appearance/structured-data/faqpage",
        },
      ],
      wordpress: [
        {
          title: "Use a FAQ block or plugin",
          description:
            "Use the Yoast FAQ block (included with Yoast SEO) which automatically generates FAQPage schema. Add your questions and answers, and the schema is handled for you.",
          tip: "The Yoast FAQ block is the simplest way to get both the visual Q&A format and the structured data markup in a single step.",
        },
        {
          title: "Format existing content as Q&A",
          description:
            "Convert relevant paragraphs into the Yoast FAQ block format. Each question becomes a heading and the answer becomes the collapsible content below it.",
        },
      ],
      nextjs: [
        {
          title: "Create an FAQ component with built-in schema",
          description:
            "Build a reusable FAQ component that renders the visual Q&A format and injects FAQPage JSON-LD automatically via a script tag.",
          codeSnippet: `function FAQ({ items }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(q => ({
      "@type": "Question", name: q.question,
      acceptedAnswer: {
        "@type": "Answer", text: q.answer },
    })),
  };
  return (<>
    <script type="application/ld+json"
      children={JSON.stringify(schema)} />
    {items.map(q => (
      <details key={q.question}>
        <summary>{q.question}</summary>
        <p>{q.answer}</p>
      </details>
    ))}
  </>);
}`,
          language: "javascript",
        },
        {
          title: "Add the FAQ component to your page",
          description:
            "Import the FAQ component and pass your question-answer pairs as props. Place it after the main content or in a dedicated FAQ section.",
        },
      ],
    },
  },

  POOR_READABILITY: {
    issueCode: "POOR_READABILITY",
    title: "Improve Flesch Readability Score to 60+",
    estimatedMinutes: 45,
    difficulty: "intermediate",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Shorten sentences",
          description:
            "Break sentences longer than 20 words into two shorter ones. Replace semicolons and em dashes connecting independent clauses with periods. Aim for an average sentence length of 14-18 words.",
          tip: "Read your content aloud. If you run out of breath before the end of a sentence, it is too long.",
        },
        {
          title: "Simplify vocabulary",
          description:
            "Replace jargon and multi-syllable words with simpler alternatives: 'utilize' becomes 'use', 'implementation' becomes 'setup', 'subsequently' becomes 'then'. Only keep technical terms that your audience expects.",
        },
        {
          title: "Use active voice",
          description:
            "Rewrite passive constructions in active voice. 'The configuration was updated by the admin' becomes 'The admin updated the configuration'. Active voice is shorter, clearer, and scores higher on readability.",
        },
      ],
      wordpress: [
        {
          title: "Enable Yoast readability analysis",
          description:
            "In the Yoast SEO panel below the editor, click the 'Readability' tab. It highlights long sentences (red), passive voice, and transition word usage. Address each flagged issue.",
          tip: "Aim for all green indicators in Yoast's readability panel. Focus on sentence length and passive voice first as they have the largest impact on Flesch score.",
        },
        {
          title: "Rewrite flagged passages",
          description:
            "Click on each red or orange indicator in Yoast to jump to the problematic text. Rewrite using shorter sentences, simpler words, and active voice.",
        },
      ],
      nextjs: [
        {
          title: "Audit readability with a linting tool",
          description:
            "Use tools like write-good, alex, or retext in your build pipeline to flag readability issues in content files.",
          codeSnippet: `"scripts": {
  "lint:content": "write-good src/content/**/*.mdx"
}`,
          language: "json",
        },
        {
          title: "Rewrite for clarity and simplicity",
          description:
            "Review flagged passages and apply the same rules: shorter sentences, simpler words, active voice. For MDX content, ensure technical explanations have plain-language summaries.",
        },
      ],
    },
  },

  LOW_TEXT_HTML_RATIO: {
    issueCode: "LOW_TEXT_HTML_RATIO",
    title: "Increase Text-to-HTML Ratio Above 15%",
    estimatedMinutes: 40,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Identify HTML bloat",
          description:
            "View the page source and look for excessive inline styles, deeply nested div wrappers, large SVG blocks, or JavaScript embedded in the HTML. These inflate the HTML without adding visible content.",
          tip: "A text-to-HTML ratio below 15% usually means the page has too much markup relative to actual readable content. The fix is either reducing markup or adding more text.",
        },
        {
          title: "Reduce unnecessary markup",
          description:
            "Move inline styles to external CSS files. Remove empty or redundant wrapper divs. Extract large inline SVGs into external files. Minify HTML output if your framework supports it.",
          codeSnippet: `<!-- Before: bloated -->
<div class="outer"><div class="inner">
  <div class="wrap"><p>Text</p></div>
</div></div>
<!-- After: clean -->
<div class="content"><p>Text</p></div>`,
          language: "html",
        },
        {
          title: "Add more visible text content",
          description:
            "If the page is legitimately light on content (e.g., a product page with mostly images), add descriptive text: product descriptions, feature explanations, usage instructions, or customer testimonials.",
        },
      ],
      wordpress: [
        {
          title: "Switch to a lightweight theme",
          description:
            "Page builder themes (Elementor, Divi) often generate excessive wrapper HTML. Consider using a block-based theme like GeneratePress, Astra, or Kadence that produces cleaner markup.",
          tip: "Compare your page's HTML size before and after switching themes. Page builders can add 3-5x more HTML than native Gutenberg blocks.",
        },
        {
          title: "Clean up with optimization plugins",
          description:
            "Use plugins like Perfmatters or Asset CleanUp to remove unused CSS/JS and minify HTML output. This reduces the HTML denominator in the ratio calculation.",
        },
      ],
      nextjs: [
        {
          title: "Audit component output",
          description:
            "Review the rendered HTML of your components. Remove unnecessary wrapper elements, consolidate class names with Tailwind/CSS modules, and avoid inline styles.",
          codeSnippet: `// Before: excessive wrappers
<div className="outer"><div className="inner">
  <div className="wrap">{text}</div>
</div></div>
// After: minimal markup
<section className="content">{text}</section>`,
          language: "javascript",
        },
        {
          title: "Enable HTML minification",
          description:
            "Use Next.js built-in optimization and ensure your deployment platform (Vercel, Cloudflare) has HTML minification enabled. This reduces the HTML portion without changing content.",
        },
      ],
    },
  },

  AI_ASSISTANT_SPEAK: {
    issueCode: "AI_ASSISTANT_SPEAK",
    title: "Remove AI-Generated Transition Phrases",
    estimatedMinutes: 20,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Search for common AI filler phrases",
          description:
            "Use Ctrl+F to search your content for these phrases commonly flagged as AI-generated: 'In conclusion', 'Moreover', 'Furthermore', 'It is important to note', 'It is worth mentioning', 'In today's fast-paced world', 'Delve into', 'Navigating the landscape', 'It's important to remember that'.",
          tip: "AI detection tools and search engines look for these patterns. Even one or two per page can trigger AI content flags, reducing your content's perceived authenticity.",
        },
        {
          title: "Replace with natural alternatives",
          description:
            "Rewrite flagged sentences using natural, conversational language. Instead of 'Moreover, it is important to note that...', try 'Another thing to keep in mind:' or simply start the sentence with the point itself.",
        },
        {
          title: "Read aloud and edit for voice",
          description:
            "Read the content aloud. Phrases that sound formal or robotic should be rewritten in your natural speaking voice. Every sentence should sound like something a real person would say in conversation.",
        },
      ],
      wordpress: [
        {
          title: "Search and replace in the editor",
          description:
            "Use the WordPress editor's search function (Ctrl+H on classic editor, or the Options menu's Find and Replace in the block editor) to locate AI filler phrases. Replace them one by one with natural alternatives.",
        },
        {
          title: "Install a content quality checker",
          description:
            "Use a plugin or external tool like Originality.ai or Writer.com to scan your content for AI-generated patterns and get specific suggestions for rewriting.",
          tip: "After editing, run the page through an AI detector to verify the changes reduced the AI content score.",
        },
      ],
      nextjs: [
        {
          title: "Search content files for AI patterns",
          description:
            "Use grep or your IDE's search across MDX/content files to find common AI phrases and replace them.",
          codeSnippet: `// Common AI phrases to find and remove:
// "In conclusion" | "Moreover" | "Furthermore"
// "It is important to note"
// "In today's [adjective] world"
// "Delve" | "Navigating the landscape"`,
          language: "javascript",
        },
        {
          title: "Rewrite flagged passages",
          description:
            "Replace each instance with natural, specific language. Prefer starting sentences with concrete subjects and actions rather than transitional fillers.",
        },
      ],
    },
  },

  UNIFORM_SENTENCE_LENGTH: {
    issueCode: "UNIFORM_SENTENCE_LENGTH",
    title: "Vary Sentence Length for Natural Rhythm",
    estimatedMinutes: 30,
    difficulty: "intermediate",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Identify monotonous patterns",
          description:
            "Read through the content and look for sections where every sentence is roughly the same length (typically 15-20 words each). This uniformity is a strong signal of AI-generated content to both readers and detection algorithms.",
          tip: "Natural human writing has 'burstiness' - a mix of short punchy sentences (5-8 words) and longer descriptive ones (25-30 words). AI tends to produce sentences of uniform medium length.",
        },
        {
          title: "Add short, impactful sentences",
          description:
            "Break up uniform paragraphs by inserting short declarative sentences. Use fragments for emphasis. Start some sentences with 'And' or 'But' for conversational rhythm.",
        },
        {
          title: "Combine short runs into longer sentences",
          description:
            "Where you have a string of similarly structured short sentences, combine some into compound or complex sentences using conjunctions, relative clauses, or semicolons to create variation.",
          codeSnippet: `<!-- Before: uniform length -->
The system processes requests in order.
Each request takes about two seconds.
The queue holds up to fifty items.

<!-- After: varied rhythm -->
The system processes requests in order,
with each one taking about two seconds.
Queue capacity? Fifty items.`,
          language: "html",
        },
      ],
      wordpress: [
        {
          title: "Use Yoast's sentence length checker",
          description:
            "Yoast SEO highlights sentences over 20 words. While it does not flag uniformity directly, use it as a guide: if no sentences are highlighted, your writing may be too uniform. Intentionally add both shorter and longer sentences.",
        },
        {
          title: "Edit for rhythm and variety",
          description:
            "Go paragraph by paragraph. Ensure each has at least one short sentence (under 10 words) and one longer one (over 20 words). This creates the natural cadence that readers and AI detectors expect.",
        },
      ],
      nextjs: [
        {
          title: "Review content for sentence variety",
          description:
            "For each content file, read sections aloud and listen for monotony. If every sentence has the same rhythm, revise by combining or splitting sentences to create variation.",
        },
        {
          title: "Consider a lint rule for content files",
          description:
            "For teams, add a custom lint rule or CI check that measures sentence length variance in MDX content and flags pages with low standard deviation.",
          tip: "A healthy standard deviation for sentence length is 8+ words. Content scoring below 5 is likely to be flagged as AI-generated.",
        },
      ],
    },
  },

  LOW_EEAT_SCORE: {
    issueCode: "LOW_EEAT_SCORE",
    title: "Boost E-E-A-T with Experience and Expertise Signals",
    estimatedMinutes: 60,
    difficulty: "advanced",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Add first-person experience",
          description:
            "Include personal anecdotes, lessons learned, or specific situations where you applied the knowledge you are writing about. Phrases like 'In my experience', 'When I tested this', or 'Our team found that' demonstrate genuine experience.",
          tip: "Google's E-E-A-T guidelines specifically reward the first 'E' (Experience). AI search engines like Perplexity and Gemini also prioritize first-hand accounts over generic summaries.",
        },
        {
          title: "Include original data and case studies",
          description:
            "Add proprietary research, screenshots of your own results, before/after comparisons, or specific metrics from projects you have worked on. Unique data that cannot be found elsewhere is the strongest E-E-A-T signal.",
        },
        {
          title: "Add detailed author credentials",
          description:
            "Create or update the author bio with relevant qualifications, years of experience, notable projects, and links to professional profiles (LinkedIn, published works, speaking engagements).",
          codeSnippet: `<script type="application/ld+json">
{ "@context": "https://schema.org",
  "@type": "Person",
  "name": "Jane Smith",
  "jobTitle": "SEO Director",
  "knowsAbout": ["SEO", "AI Search"],
  "sameAs": [
    "https://linkedin.com/in/janesmith",
    "https://twitter.com/janesmith"
  ] }
</script>`,
          language: "html",
        },
        {
          title: "Show methodology and process",
          description:
            "Explain how you arrived at your conclusions. Describe your testing methodology, data collection process, or analytical framework. This transparency signals both expertise and trustworthiness.",
        },
      ],
      wordpress: [
        {
          title: "Set up detailed author profiles",
          description:
            "Go to Users > Profile and fill in the biographical info, website, and social links. Use a plugin like Simple Author Box to display a rich author card on posts with credentials and social proof.",
          tip: "Link your WordPress author profile to your Google Scholar, industry certifications, or published portfolio to strengthen the expertise signal.",
        },
        {
          title: "Add personal experience to existing content",
          description:
            "Edit your posts to include specific examples from your experience. Replace generic statements like 'many experts recommend' with 'in my 8 years of managing SEO campaigns, I have found that...'.",
        },
        {
          title: "Create an About page with credentials",
          description:
            "Ensure your site has a detailed About page that establishes your expertise, lists credentials, and links to external validation (media mentions, certifications, conference talks).",
        },
      ],
      nextjs: [
        {
          title: "Build an AuthorCard component with schema",
          description:
            "Create a reusable author card component that displays credentials and injects Person schema markup.",
          codeSnippet: `function AuthorCard({ author }) {
  return (
    <div className="author-card">
      <img src={author.avatar} alt="" />
      <h3>{author.name}</h3>
      <p>{author.title} - {author.years}yr exp</p>
      <p>{author.bio}</p>
    </div>
  );
}`,
          language: "javascript",
        },
        {
          title: "Include experience markers in content",
          description:
            "When writing or editing page content, ensure each major section includes at least one personal experience marker: a first-person observation, a specific metric from your work, or a lesson learned from a real project.",
        },
      ],
    },
  },

  MISSING_AUTHORITATIVE_CITATIONS: {
    issueCode: "MISSING_AUTHORITATIVE_CITATIONS",
    title: "Add Citations to Authoritative Sources (.gov, .edu, Major Media)",
    estimatedMinutes: 25,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Identify claims that need sources",
          description:
            "Review your content for factual claims, statistics, and recommendations that are not currently backed by a source. Every major claim should link to a credible reference.",
          tip: "AI models like Gemini and Perplexity cross-reference claims against authoritative sources. Content with verifiable citations from .gov, .edu, or major publications is significantly more likely to be cited in AI responses.",
        },
        {
          title: "Find and add authoritative references",
          description:
            "For each unsourced claim, find a supporting reference from a .gov site, .edu institution, peer-reviewed journal, or major media outlet (NYT, BBC, Reuters, etc.). Link directly to the specific page, not just the homepage.",
          codeSnippet: `<p>Search engine traffic accounts for 53% of
  all website traffic
  (<a href="https://www.example.edu/research"
      rel="noopener">University Research, 2025
  </a>).</p>`,
          language: "html",
        },
        {
          title: "Add a sources section",
          description:
            "Include a 'Sources' or 'References' section at the bottom of the page listing all cited sources. This makes your content more credible and provides a clear signal of authority to AI crawlers.",
        },
      ],
      wordpress: [
        {
          title: "Link claims to sources inline",
          description:
            "For each factual claim, highlight the key phrase and use Ctrl+K (Cmd+K) to add a link to the authoritative source. Use descriptive anchor text that includes the source name.",
          tip: "Prefer linking to .gov (government data), .edu (academic research), and established media outlets. These carry more authority weight than blog posts or commercial sites.",
        },
        {
          title: "Add a References section at the bottom",
          description:
            "Use a List block at the end of the post to create a numbered references section. Each entry should include the source name, publication date, and a direct link.",
        },
      ],
      nextjs: [
        {
          title: "Create a References component",
          description:
            "Build a reusable component that renders a formatted references section at the bottom of content pages.",
          codeSnippet: `function References({ sources }) {
  return (
    <section aria-label="References">
      <h2>Sources</h2>
      <ol>
        {sources.map((s, i) => (
          <li key={i}>
            <a href={s.url} rel="noopener">
              {s.title}
            </a> ({s.year})
          </li>
        ))}
      </ol>
    </section>
  );
}`,
          language: "javascript",
        },
        {
          title: "Add inline citations throughout content",
          description:
            "When making factual claims in your page content, add inline links to authoritative sources. Ensure links use descriptive anchor text and open in the same tab for better user experience.",
        },
      ],
    },
  },
};
