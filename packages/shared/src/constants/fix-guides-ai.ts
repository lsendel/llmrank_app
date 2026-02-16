import type { FixGuide } from "./fix-guides";

export const AI_READINESS_GUIDES: Record<string, FixGuide> = {
  MISSING_LLMS_TXT: {
    issueCode: "MISSING_LLMS_TXT",
    title: "Create an llms.txt file",
    estimatedMinutes: 10,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Create the llms.txt file",
          description:
            "Create a file named llms.txt in the root of your website (so it is accessible at yourdomain.com/llms.txt). This file tells AI crawlers what your site is about and how they should interact with it.",
          codeSnippet: `# llms.txt\n# Site: Example.com\n# Description: Brief description of your site\n# Topics: topic1, topic2\n\nAllow: *`,
          language: "txt",
          tip: "Keep the description concise (1-2 sentences). List the 3-5 most relevant topics for your site.",
          docsUrl: "https://llmstxt.org/",
        },
        {
          title: "Verify the file is publicly accessible",
          description:
            "After deploying, visit https://yourdomain.com/llms.txt in your browser to confirm the file is served correctly with a text/plain content type.",
        },
      ],
      wordpress: [
        {
          title: "Create the llms.txt file in your theme",
          description:
            "Add a rewrite rule so WordPress serves /llms.txt. Create the file at the root of your WordPress installation (same directory as wp-config.php).",
          codeSnippet: `# Upload llms.txt to your WordPress root directory\n# e.g., /var/www/html/llms.txt`,
          language: "txt",
          tip: "Some managed WordPress hosts block file uploads to the root directory. Use an SEO plugin that supports llms.txt if direct upload is not possible.",
        },
        {
          title: "Write the llms.txt content",
          description:
            "Open the file and add your site metadata and permissions.",
          codeSnippet: `# llms.txt\n# Site: Example.com\n# Description: Your site description\n# Topics: topic1, topic2\n\nAllow: *`,
          language: "txt",
        },
      ],
      nextjs: [
        {
          title: "Add llms.txt to the public directory",
          description:
            "Next.js serves files from the /public directory at the root URL. Create public/llms.txt in your project.",
          codeSnippet: `# llms.txt\n# Site: Example.com\n# Description: Your site description\n# Topics: topic1, topic2\n\nAllow: *`,
          language: "txt",
        },
        {
          title: "Redeploy your application",
          description:
            "Run your build and deploy. The file will be available at yourdomain.com/llms.txt automatically.",
          tip: "In the App Router you can also use a route handler at app/llms.txt/route.ts to generate the file dynamically.",
        },
      ],
    },
  },

  AI_CRAWLER_BLOCKED: {
    issueCode: "AI_CRAWLER_BLOCKED",
    title: "Unblock AI crawlers in robots.txt",
    estimatedMinutes: 5,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Open your robots.txt file",
          description:
            "Locate your robots.txt file in the root of your website. This file controls which crawlers can access your site.",
        },
        {
          title: "Allow AI crawler user agents",
          description:
            "Add explicit Allow rules for the major AI crawlers. Remove any Disallow rules that target these user agents.",
          codeSnippet: `User-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /`,
          language: "txt",
          tip: "If you only want to block specific directories from AI crawlers, use targeted Disallow rules instead of blocking them entirely.",
        },
        {
          title: "Verify with a robots.txt tester",
          description:
            "Use Google Search Console's robots.txt tester or a similar tool to confirm the user agents are no longer blocked.",
          docsUrl:
            "https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt",
        },
      ],
      wordpress: [
        {
          title: "Edit robots.txt via your SEO plugin",
          description:
            "If you use Yoast SEO or Rank Math, navigate to the robots.txt editor in the plugin settings. Otherwise, edit the robots.txt file directly in your WordPress root directory.",
        },
        {
          title: "Add AI crawler rules",
          description:
            "Append the following rules to allow AI crawlers access to your content.",
          codeSnippet: `User-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /`,
          language: "txt",
        },
      ],
      nextjs: [
        {
          title: "Update public/robots.txt or the route handler",
          description:
            "If you have a static public/robots.txt, edit it directly. If you use an App Router route handler at app/robots.ts, update the generated output.",
          codeSnippet: `// app/robots.ts\nexport default function robots() {\n  return { rules: [\n    { userAgent: "GPTBot", allow: "/" },\n    { userAgent: "ClaudeBot", allow: "/" },\n    { userAgent: "PerplexityBot", allow: "/" },\n  ] };\n}`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots",
        },
      ],
    },
  },

  NO_STRUCTURED_DATA: {
    issueCode: "NO_STRUCTURED_DATA",
    title: "Add JSON-LD structured data",
    estimatedMinutes: 20,
    difficulty: "intermediate",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Choose the appropriate schema type",
          description:
            "Pick the schema type that best describes your page: WebPage for general pages, Article for blog posts, Product for product pages, FAQPage for FAQ content, or Organization for your homepage.",
        },
        {
          title: "Add JSON-LD to the page head",
          description:
            "Insert a script tag with type application/ld+json in the <head> of your page. At minimum, include @context, @type, name, and description.",
          codeSnippet: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "Page Title",\n  "description": "Page description"\n}\n</script>`,
          language: "html",
          docsUrl: "https://schema.org/docs/gs.html",
        },
        {
          title: "Validate your structured data",
          description:
            "Use Google's Rich Results Test or the Schema.org validator to check for errors.",
          docsUrl: "https://search.google.com/test/rich-results",
        },
      ],
      wordpress: [
        {
          title: "Install a structured data plugin",
          description:
            "Install and activate a plugin like Yoast SEO, Rank Math, or Schema Pro. These plugins automatically generate JSON-LD for your pages.",
          tip: "Rank Math and Yoast SEO both include JSON-LD output by default. Check your plugin settings to ensure structured data is enabled.",
        },
        {
          title: "Configure schema types per content type",
          description:
            "In your SEO plugin settings, set the default schema type for posts (Article), pages (WebPage), and products (Product). Add Organization schema to your homepage.",
        },
        {
          title: "Verify output in page source",
          description:
            "View the page source and search for application/ld+json to confirm the structured data is present and correct.",
        },
      ],
      nextjs: [
        {
          title: "Create a JSON-LD component",
          description:
            "Build a reusable component that renders a JSON-LD script tag. Next.js App Router supports the script tag in page components.",
          codeSnippet: `export function JsonLd({ data }: { data: object }) {\n  return (\n    <script type="application/ld+json"\n      dangerouslySetInnerHTML=\n        {{ __html: JSON.stringify(data) }} />\n  );\n}`,
          language: "javascript",
        },
        {
          title: "Add structured data to your pages",
          description:
            "Import the component and pass the appropriate schema data in each page or layout.",
          codeSnippet: `<JsonLd data={{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "headline": post.title,\n  "author": {\n    "@type": "Person",\n    "name": post.author\n  }\n}} />`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/building-your-application/optimizing/metadata#json-ld",
        },
      ],
    },
  },

  INCOMPLETE_SCHEMA: {
    issueCode: "INCOMPLETE_SCHEMA",
    title: "Complete structured data properties",
    estimatedMinutes: 15,
    difficulty: "intermediate",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Identify missing required properties",
          description:
            "Run your page through Google's Rich Results Test to see which required and recommended properties are missing from your JSON-LD.",
          docsUrl: "https://search.google.com/test/rich-results",
        },
        {
          title: "Add the missing properties",
          description:
            "Update your JSON-LD to include all required properties for your schema type. For Article, this includes headline, author, datePublished, and image.",
          codeSnippet: `{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "headline": "Article Title",\n  "author": { "@type": "Person", "name": "Author" },\n  "datePublished": "2025-01-15",\n  "image": "https://example.com/image.jpg"\n}`,
          language: "json",
          tip: "Always include datePublished and dateModified for Article types. AI models use these to assess content freshness.",
        },
        {
          title: "Re-validate after changes",
          description:
            "Run the validator again to confirm all required fields are now present and correctly formatted.",
        },
      ],
      wordpress: [
        {
          title: "Check your SEO plugin schema settings",
          description:
            "Open your SEO plugin (Yoast, Rank Math) and review the schema settings for the affected content type. Ensure all fields like author, date, and image are mapped correctly.",
        },
        {
          title: "Fill in missing post metadata",
          description:
            "Make sure each post or page has a featured image, author, and publication date set in the WordPress editor. Plugins pull these values into the JSON-LD.",
          tip: "Check that your author profiles have a display name and bio set under Users in the WordPress admin.",
        },
      ],
      nextjs: [
        {
          title: "Audit your JSON-LD data object",
          description:
            "Review the data you pass to your JSON-LD component. Cross-reference the properties with the schema.org specification for your chosen type.",
          docsUrl: "https://schema.org/Article",
        },
        {
          title: "Add missing fields from your data source",
          description:
            "Map additional fields from your CMS or data layer into the structured data object.",
          codeSnippet: `const articleSchema = {\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "headline": post.title,\n  "author": { "@type": "Person", "name": post.author },\n  "datePublished": post.publishedAt,\n  "dateModified": post.updatedAt,\n  "image": post.coverImage\n};`,
          language: "javascript",
        },
      ],
    },
  },

  CITATION_WORTHINESS: {
    issueCode: "CITATION_WORTHINESS",
    title: "Improve content citation worthiness",
    estimatedMinutes: 60,
    difficulty: "advanced",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Add original data and research",
          description:
            "Include unique statistics, survey results, case studies, or proprietary data that AI models would want to cite. Generic advice is rarely cited; specific data is.",
          tip: "Even small internal studies (e.g., analyzing your own customer data) add significant citation value.",
        },
        {
          title: "Provide clear, authoritative definitions",
          description:
            "Write concise, well-structured definitions for key terms in your field. AI models frequently cite pages that provide the clearest explanation of a concept.",
        },
        {
          title: "Include expert analysis and opinions",
          description:
            "Add expert commentary, named author bylines, and professional credentials. AI models prioritize content from recognized authorities.",
        },
      ],
      wordpress: [
        {
          title: "Enrich posts with unique data",
          description:
            "Add data tables, charts, or infographics with original statistics. Use the table block or a plugin like TablePress.",
          tip: "Wrap key statistics in <strong> or <mark> tags to make them easier for AI to extract.",
        },
        {
          title: "Add author expertise signals",
          description:
            "Ensure each post has an author with a detailed bio that includes credentials, experience, and links to relevant profiles. Use an author box plugin if your theme does not include one.",
        },
        {
          title: "Write definitive resource pages",
          description:
            "Create comprehensive, regularly updated resource pages on your core topics. These hub pages are more likely to be cited by AI.",
        },
      ],
      nextjs: [
        {
          title: "Structure content for maximum extractability",
          description:
            "Use semantic HTML (article, section, figure, figcaption, blockquote) and include data-attribute annotations for key facts.",
          codeSnippet: `<figure>\n  <table>...</table>\n  <figcaption>Source: Internal survey, n=500</figcaption>\n</figure>`,
          language: "html",
        },
        {
          title: "Add author and credential metadata",
          description:
            "Include Author schema markup alongside your content and display author credentials prominently on the page.",
        },
      ],
    },
  },

  NO_DIRECT_ANSWERS: {
    issueCode: "NO_DIRECT_ANSWERS",
    title: "Add direct answers to likely queries",
    estimatedMinutes: 30,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Identify likely user questions",
          description:
            "Research what questions users ask about your topic. Use Google's People Also Ask, Answer the Public, or your site search logs to find common queries.",
        },
        {
          title: "Write concise answer paragraphs",
          description:
            "At the beginning of each section, add a 1-2 sentence direct answer to the question that section addresses. Follow with supporting details.",
          codeSnippet: `<h2>What is schema markup?</h2>\n<p><strong>Schema markup</strong> is structured data\nadded to HTML that helps search engines and AI\nmodels understand page content.</p>`,
          language: "html",
          tip: "Front-load the answer. AI models extract the first sentence after a heading, so put the direct answer there.",
        },
        {
          title: "Add an FAQ section",
          description:
            "Add a dedicated FAQ section at the bottom of the page with common questions and concise answers. Use FAQPage schema markup for additional visibility.",
        },
      ],
      wordpress: [
        {
          title: "Use FAQ blocks or plugins",
          description:
            "Use the Yoast FAQ block, Rank Math FAQ block, or a dedicated FAQ plugin to create structured Q&A sections that automatically generate FAQPage schema.",
        },
        {
          title: "Restructure post introductions",
          description:
            "Edit the first paragraph of each post to directly answer the main question. Move background context below the direct answer.",
          tip: "Use the TL;DR pattern: lead with the answer, then explain why.",
        },
      ],
      nextjs: [
        {
          title: "Create an FAQ component with schema",
          description:
            "Build a reusable FAQ component that renders questions and answers with FAQPage structured data.",
          codeSnippet: `const faqSchema = {\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": faqs.map(f => ({\n    "@type": "Question",\n    "name": f.question,\n    "acceptedAnswer": {\n      "@type": "Answer", "text": f.answer\n    }\n  }))\n};`,
          language: "javascript",
        },
        {
          title: "Front-load answers in page content",
          description:
            "In your content components, structure text so the direct answer appears immediately after the heading, before any supporting context.",
        },
      ],
    },
  },

  MISSING_ENTITY_MARKUP: {
    issueCode: "MISSING_ENTITY_MARKUP",
    title: "Add schema markup for key entities",
    estimatedMinutes: 25,
    difficulty: "intermediate",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Identify key entities on the page",
          description:
            "List the important people, organizations, products, places, or events mentioned in your content. These are candidates for schema markup.",
        },
        {
          title: "Add entity schema markup",
          description:
            "Create JSON-LD entries for each key entity. Link them to your main page schema using properties like author, publisher, or mentions.",
          codeSnippet: `{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "Company Name",\n  "url": "https://example.com",\n  "sameAs": ["https://twitter.com/example"]\n}`,
          language: "json",
          docsUrl: "https://schema.org/Organization",
        },
        {
          title: "Use sameAs for disambiguation",
          description:
            "Add sameAs links to Wikipedia, Wikidata, or official social profiles. This helps AI models correctly identify and disambiguate the entities you mention.",
        },
      ],
      wordpress: [
        {
          title: "Configure Organization schema in your SEO plugin",
          description:
            "Go to your SEO plugin settings and set up Organization schema with your company name, logo, and social profiles.",
        },
        {
          title: "Add entity markup to individual posts",
          description:
            "Use the schema settings on each post to mark up people, products, or events mentioned. Rank Math provides a schema builder for this purpose.",
          tip: "At minimum, mark up the post author as a Person entity and your company as an Organization entity.",
        },
      ],
      nextjs: [
        {
          title: "Create entity schema objects",
          description:
            "Define reusable schema objects for your key entities (company, team members, products) and reference them across pages.",
          codeSnippet: `const orgSchema = {\n  "@type": "Organization",\n  "name": "Your Company",\n  "url": "https://example.com",\n  "logo": "https://example.com/logo.png",\n  "sameAs": ["https://linkedin.com/company/ex"]\n};`,
          language: "javascript",
        },
        {
          title: "Embed entities in page-level schema",
          description:
            "Reference your entity objects inside your page schema using properties like publisher, author, or about.",
          codeSnippet: `const pageSchema = {\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "publisher": orgSchema,\n  "author": authorSchema\n};`,
          language: "javascript",
        },
      ],
    },
  },

  NO_SUMMARY_SECTION: {
    issueCode: "NO_SUMMARY_SECTION",
    title: "Add a summary or key takeaways section",
    estimatedMinutes: 10,
    difficulty: "beginner",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Add a key takeaways section",
          description:
            "Insert a summary section near the top of the page (after the introduction) or at the bottom. Use a heading like 'Key Takeaways', 'Summary', or 'TL;DR'.",
          codeSnippet: `<section>\n  <h2>Key Takeaways</h2>\n  <ul>\n    <li>First main point</li>\n    <li>Second main point</li>\n    <li>Third main point</li>\n  </ul>\n</section>`,
          language: "html",
          tip: "Place the summary near the top for AI discoverability. AI models often prioritize content that appears early on the page.",
        },
        {
          title: "Keep summaries concise and factual",
          description:
            "Limit your summary to 3-5 bullet points. Each point should be a self-contained statement that makes sense without reading the full article.",
        },
      ],
      wordpress: [
        {
          title: "Add a summary block to your post template",
          description:
            "Use the List block or a custom reusable block to create a consistent summary section. Place it immediately after the introduction paragraph.",
          tip: "Create a reusable block called 'Key Takeaways' so you can insert it quickly into every post.",
        },
        {
          title: "Style the summary for visibility",
          description:
            "Wrap the summary in a Group block with a distinct background color or border. This makes it visually prominent and easy for both users and AI to identify.",
        },
      ],
      nextjs: [
        {
          title: "Create a Takeaways component",
          description:
            "Build a reusable component that renders a styled summary section with consistent markup.",
          codeSnippet: `export function Takeaways(\n  { points }: { points: string[] }\n) {\n  return (\n    <section aria-label="Key Takeaways">\n      <h2>Key Takeaways</h2>\n      <ul>{points.map((p, i) =>\n        <li key={i}>{p}</li>)}</ul>\n    </section>\n  );\n}`,
          language: "javascript",
        },
        {
          title: "Include takeaways in your content pages",
          description:
            "Import the Takeaways component into your article or blog post pages and pass the main points as props. Place it early in the page layout.",
        },
      ],
    },
  },

  POOR_QUESTION_COVERAGE: {
    issueCode: "POOR_QUESTION_COVERAGE",
    title: "Improve coverage of likely search queries",
    estimatedMinutes: 45,
    difficulty: "advanced",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Research common questions for your topic",
          description:
            "Use tools like Google's People Also Ask, AnswerThePublic, AlsoAsked, or your own search analytics to identify questions users ask about your topic.",
          tip: "Focus on 'what', 'how', 'why', and 'when' questions, as these are the queries AI assistants most frequently answer.",
        },
        {
          title: "Map questions to content sections",
          description:
            "Create a content outline that addresses each identified question. Use the question as a heading (H2 or H3) and answer it directly in the following paragraph.",
          codeSnippet: `<h2>How does [topic] work?</h2>\n<p>[Topic] works by... [direct answer].</p>\n<p>[Supporting details and examples].</p>`,
          language: "html",
        },
        {
          title: "Fill content gaps",
          description:
            "Compare your content against competitor pages ranking for the same queries. Add sections for any questions you do not currently address.",
        },
      ],
      wordpress: [
        {
          title: "Use keyword research tools",
          description:
            "Use a tool like Semrush, Ahrefs, or the free Google Keyword Planner to find question-based keywords related to your topic. Focus on questions with moderate search volume.",
        },
        {
          title: "Add FAQ and how-to sections",
          description:
            "Create dedicated FAQ sections using FAQ blocks. For procedural topics, use HowTo schema blocks. These structured formats are highly favored by AI models.",
        },
        {
          title: "Update and republish existing content",
          description:
            "Edit existing posts to address the missing questions rather than creating new posts. Consolidated, comprehensive content performs better for AI citations.",
        },
      ],
      nextjs: [
        {
          title: "Build content around query intent",
          description:
            "Structure your page components to use question-based headings. Create content sections that directly map to user queries.",
          codeSnippet: `<section>\n  <h2>How do I implement structured data?</h2>\n  <p>Add a JSON-LD script tag to your page head\n  with the appropriate schema type.</p>\n</section>`,
          language: "html",
        },
        {
          title: "Add dynamic FAQ from your CMS",
          description:
            "If you use a headless CMS, create a FAQ content type and render the questions with FAQPage schema on the relevant pages.",
        },
      ],
    },
  },

  INVALID_SCHEMA: {
    issueCode: "INVALID_SCHEMA",
    title: "Fix JSON-LD parse errors",
    estimatedMinutes: 15,
    difficulty: "intermediate",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Validate your JSON-LD",
          description:
            "Paste your JSON-LD into a JSON validator (like jsonlint.com) and the Google Rich Results Test to identify syntax errors.",
          docsUrl: "https://search.google.com/test/rich-results",
        },
        {
          title: "Fix common syntax issues",
          description:
            "The most common errors are trailing commas, unescaped quotes inside strings, missing closing braces, and incorrect nesting. Fix each error and re-validate.",
          codeSnippet: `// Wrong: trailing comma\n{ "name": "Example", }\n// Right: no trailing comma\n{ "name": "Example" }`,
          language: "json",
          tip: "Use a code editor with JSON validation (VS Code highlights JSON errors automatically) to catch issues before deploying.",
        },
        {
          title: "Test in a live environment",
          description:
            "After fixing, deploy the changes and test the live page URL with Google's Rich Results Test to confirm the JSON-LD parses correctly.",
        },
      ],
      wordpress: [
        {
          title: "Check for plugin conflicts",
          description:
            "Multiple plugins can output conflicting or malformed JSON-LD. View your page source, search for application/ld+json, and check if duplicate or broken script tags exist.",
          tip: "Disable all but one schema/SEO plugin to avoid duplicate or conflicting structured data.",
        },
        {
          title: "Manually fix or regenerate the schema",
          description:
            "If using a plugin, try regenerating the schema by saving the post again. If using custom code, validate and fix the JSON manually.",
        },
      ],
      nextjs: [
        {
          title: "Use JSON.stringify for safe serialization",
          description:
            "Never hand-write JSON-LD strings. Always use JSON.stringify to serialize your data object, which prevents syntax errors.",
          codeSnippet: `<script\n  type="application/ld+json"\n  dangerouslySetInnerHTML={{\n    __html: JSON.stringify(schemaData)\n  }}\n/>`,
          language: "javascript",
        },
        {
          title: "Add build-time schema validation",
          description:
            "Use a library like schema-dts for TypeScript types or add a unit test that validates your schema objects against JSON parsing.",
          docsUrl: "https://www.npmjs.com/package/schema-dts",
        },
      ],
    },
  },

  HAS_PDF_CONTENT: {
    issueCode: "HAS_PDF_CONTENT",
    title: "Optimize PDF content for AI discoverability",
    estimatedMinutes: 5,
    difficulty: "beginner",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Add HTML summaries for linked PDFs",
          description:
            "On the page that links to the PDF, include a brief summary of the PDF content in HTML. This ensures AI models can discover and understand the content even if they cannot fully parse the PDF.",
          tip: "This is informational. If your PDFs supplement HTML content, no immediate action is required.",
        },
      ],
      wordpress: [
        {
          title: "Summarize PDF content on the linking page",
          description:
            "When embedding or linking to a PDF, add a paragraph or bullet list summarizing the PDF's key points directly on the WordPress page.",
        },
      ],
      nextjs: [
        {
          title: "Render PDF summaries alongside download links",
          description:
            "When linking to PDFs, include a summary section in your component so the content is available as crawlable HTML.",
        },
      ],
    },
  },

  PDF_ONLY_CONTENT: {
    issueCode: "PDF_ONLY_CONTENT",
    title: "Create HTML alternatives for PDF content",
    estimatedMinutes: 45,
    difficulty: "advanced",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Create HTML versions of key PDFs",
          description:
            "For your most important PDF documents, create equivalent HTML pages. AI models can extract, understand, and cite HTML content far more effectively than PDF content.",
          tip: "Prioritize PDFs that drive the most traffic or contain your most valuable content.",
        },
        {
          title: "Add structured summaries on linking pages",
          description:
            "At minimum, add a detailed HTML summary of each PDF on the page that links to it. Include key data points, conclusions, and quotes.",
          codeSnippet: `<article>\n  <h2>2025 Industry Report</h2>\n  <p>Key findings from our annual report:</p>\n  <ul><li>Finding 1</li><li>Finding 2</li></ul>\n  <a href="/report.pdf">Download full report (PDF)</a>\n</article>`,
          language: "html",
        },
      ],
      wordpress: [
        {
          title: "Convert PDFs to WordPress posts or pages",
          description:
            "Create a post or page for each important PDF. Copy the content into the WordPress editor with proper headings, lists, and formatting. Link to the original PDF as a download option.",
        },
        {
          title: "Add detailed summaries for remaining PDFs",
          description:
            "For PDFs you cannot convert to full pages, add a substantial summary (3-5 paragraphs) on the page that links to the PDF. Include the most important data points and conclusions.",
        },
      ],
      nextjs: [
        {
          title: "Build HTML pages for critical PDF content",
          description:
            "Create dedicated routes for your most important PDF content. Render the content as structured HTML with proper headings and semantic markup.",
        },
        {
          title: "Offer both formats",
          description:
            "Keep the PDF available as a download while serving the HTML version as the primary page. Use a component that shows the content with an option to download the PDF.",
          codeSnippet: `<article>\n  <h1>{report.title}</h1>\n  <div>{report.htmlContent}</div>\n  <a href={report.pdfUrl} download>\n    Download as PDF\n  </a>\n</article>`,
          language: "javascript",
        },
      ],
    },
  },

  AI_CONTENT_EXTRACTABLE: {
    issueCode: "AI_CONTENT_EXTRACTABLE",
    title: "Content is well-structured for AI extraction",
    estimatedMinutes: 0,
    difficulty: "beginner",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "No action needed",
          description:
            "Your content is already well-structured for AI extraction. It has a high text-to-HTML ratio, good readability, and clear semantic structure. Continue following these practices for new content.",
          tip: "Keep using semantic HTML elements (article, section, h1-h6, ul/ol, p) and maintain a clean content structure.",
        },
      ],
      wordpress: [
        {
          title: "No action needed",
          description:
            "Your WordPress content is well-structured for AI crawlers. Continue using proper heading hierarchy, short paragraphs, and the block editor's semantic elements.",
        },
      ],
      nextjs: [
        {
          title: "No action needed",
          description:
            "Your content structure is optimized for AI extraction. Continue using semantic HTML in your components and maintaining a clean content hierarchy.",
        },
      ],
    },
  },
};
