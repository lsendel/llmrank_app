import type { FixGuide } from "./fix-guides";

export const TECHNICAL_GUIDES: Record<string, FixGuide> = {
  MISSING_TITLE: {
    issueCode: "MISSING_TITLE",
    title: "Add or Fix Page Title Tag",
    estimatedMinutes: 5,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Add a title tag in the <head>",
          description:
            "Every page must have a unique <title> tag between 30 and 60 characters that accurately describes the page content.",
          codeSnippet: `<head>\n  <title>Your Page Title — Brand Name</title>\n</head>`,
          language: "html",
          tip: "Keep titles between 30-60 characters. Front-load the primary keyword.",
        },
        {
          title: "Verify the title renders correctly",
          description:
            "Open your page in a browser and check the browser tab. Ensure the title is not duplicated or truncated in search results.",
        },
      ],
      wordpress: [
        {
          title: "Set the title via Yoast SEO",
          description:
            "Edit the page/post and scroll to the Yoast SEO panel. Enter your desired title in the 'SEO title' field.",
          tip: "Use Yoast's snippet variables like %%title%% %%sep%% %%sitename%% for dynamic titles.",
        },
        {
          title: "Set a default title pattern in Yoast",
          description:
            "Go to Yoast SEO > Settings > Content types and set default title templates for posts and pages.",
          docsUrl:
            "https://yoast.com/help/customize-your-titles-and-meta-descriptions/",
        },
      ],
      nextjs: [
        {
          title: "Export metadata from your page component",
          description:
            "In App Router, export a `metadata` object or `generateMetadata` function from your page file.",
          codeSnippet: `export const metadata = {\n  title: "Your Page Title — Brand Name",\n};`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/building-your-application/optimizing/metadata",
        },
        {
          title: "Use generateMetadata for dynamic titles",
          description:
            "For dynamic routes, export an async `generateMetadata` function that reads params or fetches data.",
          codeSnippet: `export async function generateMetadata({ params }) {\n  const data = await getData(params.slug);\n  return { title: data.title };\n}`,
          language: "javascript",
        },
      ],
    },
  },

  MISSING_META_DESC: {
    issueCode: "MISSING_META_DESC",
    title: "Add or Fix Meta Description",
    estimatedMinutes: 5,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Add a meta description tag",
          description:
            "Place a meta description in the <head> section. Keep it between 120 and 160 characters with a compelling call to action.",
          codeSnippet: `<head>\n  <meta name="description" content="Your concise, compelling page description that summarizes the content in 120-160 characters." />\n</head>`,
          language: "html",
          tip: "Include your primary keyword naturally. Write it as a mini advertisement for the page.",
        },
        {
          title: "Make each description unique",
          description:
            "Every page should have its own unique meta description. Avoid duplicating the same description across multiple pages.",
        },
      ],
      wordpress: [
        {
          title: "Set the meta description in Yoast SEO",
          description:
            "Edit the page/post, scroll to the Yoast SEO panel, and fill in the 'Meta description' field.",
          tip: "Yoast shows a green bar when the length is optimal (120-160 characters).",
        },
        {
          title: "Set default meta description templates",
          description:
            "Go to Yoast SEO > Settings > Content types to define fallback patterns using snippet variables like %%excerpt%%.",
        },
      ],
      nextjs: [
        {
          title: "Add description to the metadata export",
          description:
            "Include a `description` field in your page's metadata object or generateMetadata return value.",
          codeSnippet: `export const metadata = {\n  title: "Page Title",\n  description: "A compelling 120-160 char description of this page.",\n};`,
          language: "javascript",
        },
        {
          title: "Set a fallback in the root layout",
          description:
            "Define a default description in `app/layout.tsx` metadata so no page is left without one.",
          codeSnippet: `export const metadata = {\n  description: "Default site description for pages without their own.",\n};`,
          language: "javascript",
        },
      ],
    },
  },

  MISSING_H1: {
    issueCode: "MISSING_H1",
    title: "Add an H1 Heading Tag",
    estimatedMinutes: 5,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Add a single H1 to the page",
          description:
            "Every page should have exactly one <h1> tag that clearly describes the primary topic. Place it at the top of the main content area.",
          codeSnippet: `<main>\n  <h1>Your Primary Page Heading</h1>\n  <p>Page content goes here...</p>\n</main>`,
          language: "html",
          tip: "The H1 should match or closely relate to the page title. It helps both users and search engines understand the page.",
        },
      ],
      wordpress: [
        {
          title: "Use the post/page title as H1",
          description:
            "Most WordPress themes automatically render the post title as an H1. Make sure your theme does this and that you have a title set.",
          tip: "Check your theme's single.php or page.php template to confirm it uses <h1> for the_title().",
        },
        {
          title: "Verify with Inspect Element",
          description:
            "Right-click the page heading in your browser and select 'Inspect' to confirm it is wrapped in an <h1> tag, not an <h2> or <div>.",
        },
      ],
      nextjs: [
        {
          title: "Add an H1 in your page component",
          description:
            "Include a single <h1> element in the JSX returned by your page component.",
          codeSnippet: `export default function Page() {\n  return (\n    <main>\n      <h1>Your Primary Heading</h1>\n    </main>\n  );\n}`,
          language: "javascript",
        },
        {
          title: "Ensure layouts do not add extra H1 tags",
          description:
            "Check your root layout and nested layouts to ensure they do not also render an H1, which would cause duplicates.",
        },
      ],
    },
  },

  MULTIPLE_H1: {
    issueCode: "MULTIPLE_H1",
    title: "Reduce to a Single H1 Tag",
    estimatedMinutes: 10,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Identify all H1 tags on the page",
          description:
            "Use browser DevTools (Ctrl+F in Elements panel, search for 'h1') to find every H1 on the page. There should be exactly one.",
        },
        {
          title: "Demote extra H1 tags to H2",
          description:
            "Change all secondary H1 tags to H2 or the appropriate heading level based on the content hierarchy.",
          codeSnippet: `<!-- Before -->\n<h1>Main Heading</h1>\n<h1>Section Heading</h1>\n\n<!-- After -->\n<h1>Main Heading</h1>\n<h2>Section Heading</h2>`,
          language: "html",
        },
      ],
      wordpress: [
        {
          title: "Check widgets and theme elements",
          description:
            "Extra H1 tags often come from widgets, the site title in the header, or poorly coded theme sections. Inspect the header and sidebar areas.",
        },
        {
          title: "Edit the theme template if needed",
          description:
            "If your theme renders the site name as H1 on every page, change it to a <div> or <p> in header.php (use a child theme).",
          codeSnippet: `<!-- Change from -->\n<h1 class="site-title"><a href="/"><?php bloginfo('name'); ?></a></h1>\n<!-- Change to -->\n<p class="site-title"><a href="/"><?php bloginfo('name'); ?></a></p>`,
          language: "php",
        },
      ],
      nextjs: [
        {
          title: "Audit components for H1 usage",
          description:
            "Search your codebase for '<h1' across all components. Ensure only the page-level component renders an H1, not shared layout or header components.",
        },
        {
          title: "Use H2 or lower in reusable components",
          description:
            "Shared components like hero sections or card layouts should use H2 or accept a heading level prop.",
          codeSnippet: `function Section({ title, level = "h2" }) {\n  const Tag = level;\n  return <Tag>{title}</Tag>;\n}`,
          language: "javascript",
        },
      ],
    },
  },

  HEADING_HIERARCHY: {
    issueCode: "HEADING_HIERARCHY",
    title: "Fix Heading Level Hierarchy",
    estimatedMinutes: 15,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Map out the correct heading structure",
          description:
            "Headings must follow a sequential order: H1 > H2 > H3 > H4. Never skip levels (e.g., H1 directly to H3).",
          codeSnippet: `<h1>Page Title</h1>\n  <h2>Section</h2>\n    <h3>Subsection</h3>\n  <h2>Another Section</h2>`,
          language: "html",
          tip: "Think of headings as a table of contents. Each level nests logically under its parent.",
        },
        {
          title: "Fix skipped levels",
          description:
            "Change any heading that skips a level to the correct level. For example, an H3 that follows an H1 should become an H2.",
        },
      ],
      wordpress: [
        {
          title: "Fix headings in the block editor",
          description:
            "Select each heading block in the WordPress editor and use the toolbar to change its level (H2, H3, etc.) to maintain proper nesting.",
          tip: "The Document Outline panel in the editor shows heading hierarchy issues. Open it from the top toolbar.",
        },
        {
          title: "Check theme-generated headings",
          description:
            "Widgets and theme sections sometimes inject headings at wrong levels. Inspect these areas and adjust the theme template or widget settings.",
        },
      ],
      nextjs: [
        {
          title: "Establish heading conventions in components",
          description:
            "Create a convention where pages own the H1, top-level sections use H2, and sub-sections use H3. Document this for your team.",
        },
        {
          title: "Use a heading level context pattern",
          description:
            "Implement a React context that tracks the current heading level so nested components automatically use the correct level.",
          codeSnippet:
            "const HeadingContext = React.createContext(2);\nfunction Heading({ children }) {\n  const level = React.useContext(HeadingContext);\n  const Tag = `h${level}`;\n  return <Tag>{children}</Tag>;\n}",
          language: "javascript",
        },
      ],
    },
  },

  BROKEN_LINKS: {
    issueCode: "BROKEN_LINKS",
    title: "Fix Broken Internal and External Links",
    estimatedMinutes: 30,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Identify all broken links",
          description:
            "Review the list of broken URLs reported. Check each one to determine if the target page was moved, deleted, or has a typo in the URL.",
        },
        {
          title: "Fix or remove broken links",
          description:
            "Update the href to the correct URL, set up a redirect from the old URL to the new one, or remove the link entirely if the content no longer exists.",
          codeSnippet: `<!-- Fix the URL -->\n<a href="/correct-page-url">Link Text</a>\n\n<!-- Or remove if content is gone -->\n<span>Previously linked text</span>`,
          language: "html",
        },
        {
          title: "Set up redirects for moved pages",
          description:
            "If you moved or renamed a page, add a 301 redirect so old links still work.",
          tip: "Always prefer 301 (permanent) redirects over 302 (temporary) for SEO.",
        },
      ],
      wordpress: [
        {
          title: "Use the Redirection plugin",
          description:
            "Install the Redirection plugin (free) to manage 301 redirects for any URLs that have changed.",
          docsUrl: "https://wordpress.org/plugins/redirection/",
        },
        {
          title: "Update links in content",
          description:
            "Use the Better Search Replace plugin to find and replace old URLs across all posts and pages in bulk.",
        },
      ],
      nextjs: [
        {
          title: "Add redirects in next.config.js",
          description:
            "Use the `redirects` configuration to set up 301 redirects for moved pages.",
          codeSnippet: `module.exports = {\n  async redirects() {\n    return [{ source: "/old-path", destination: "/new-path", permanent: true }];\n  },\n};`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects",
        },
        {
          title: "Search and fix hardcoded links",
          description:
            "Use your IDE to search for the broken URL across all components and update them to the correct path. Use Next.js <Link> for internal navigation.",
        },
      ],
    },
  },

  MISSING_CANONICAL: {
    issueCode: "MISSING_CANONICAL",
    title: "Add a Canonical Link Tag",
    estimatedMinutes: 5,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Add a canonical link in the <head>",
          description:
            "A canonical tag tells search engines the preferred URL for the page, preventing duplicate content issues.",
          codeSnippet: `<head>\n  <link rel="canonical" href="https://example.com/your-page" />\n</head>`,
          language: "html",
          tip: "The canonical URL should be the absolute, full URL (including https://) of the preferred version of the page.",
        },
        {
          title: "Ensure consistency",
          description:
            "The canonical URL should match the URL in your sitemap and be consistent with your trailing slash and www/non-www preferences.",
        },
      ],
      wordpress: [
        {
          title: "Enable canonical URLs in Yoast SEO",
          description:
            "Yoast SEO automatically adds canonical tags. Verify it is active under Yoast SEO > Settings > Site features. You can override the canonical per page in the Advanced tab of the Yoast panel.",
        },
        {
          title: "Check for conflicting plugins",
          description:
            "Some themes or other SEO plugins may also output canonical tags, causing duplicates. Disable any conflicting canonical tag output.",
        },
      ],
      nextjs: [
        {
          title: "Add alternates.canonical to metadata",
          description:
            "Use the metadata API to set a canonical URL for each page.",
          codeSnippet: `export const metadata = {\n  alternates: {\n    canonical: "https://example.com/your-page",\n  },\n};`,
          language: "javascript",
        },
        {
          title: "Set a base URL in the root layout",
          description:
            "Configure `metadataBase` in your root layout so relative canonical paths resolve correctly.",
          codeSnippet: `export const metadata = {\n  metadataBase: new URL("https://example.com"),\n};`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadatabase",
        },
      ],
    },
  },

  NOINDEX_SET: {
    issueCode: "NOINDEX_SET",
    title: "Remove Noindex Directive",
    estimatedMinutes: 5,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Remove the noindex meta tag",
          description:
            "If the page should be indexed by search engines and AI crawlers, remove or update the robots meta tag.",
          codeSnippet: `<!-- Remove this line -->\n<meta name="robots" content="noindex" />\n\n<!-- Or change to allow indexing -->\n<meta name="robots" content="index, follow" />`,
          language: "html",
          tip: "Also check for X-Robots-Tag HTTP headers that might set noindex at the server level.",
        },
        {
          title: "Verify in robots.txt",
          description:
            "Make sure robots.txt does not also disallow the page. The noindex directive and robots.txt work independently.",
        },
      ],
      wordpress: [
        {
          title: "Check WordPress visibility settings",
          description:
            'Go to Settings > Reading and ensure "Discourage search engines from indexing this site" is unchecked.',
        },
        {
          title: "Check per-page noindex in Yoast",
          description:
            "Edit the page, open the Yoast SEO panel > Advanced tab, and set 'Allow search engines to show this page?' to Yes.",
        },
      ],
      nextjs: [
        {
          title: "Remove robots noindex from metadata",
          description:
            "Check your page's metadata export and remove any robots noindex directive.",
          codeSnippet: `// Remove this:\nexport const metadata = {\n  robots: { index: false },\n};\n// Replace with (or remove robots entirely):\nexport const metadata = {\n  robots: { index: true, follow: true },\n};`,
          language: "javascript",
        },
        {
          title: "Check middleware and headers",
          description:
            "Search for X-Robots-Tag in your middleware.ts or next.config.js headers configuration that might apply noindex broadly.",
        },
      ],
    },
  },

  MISSING_ALT_TEXT: {
    issueCode: "MISSING_ALT_TEXT",
    title: "Add Alt Text to Images",
    estimatedMinutes: 10,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Add descriptive alt attributes",
          description:
            'Every <img> tag must have an alt attribute. Describe what the image shows concisely. Decorative images should use an empty alt (alt="").',
          codeSnippet: `<img src="photo.jpg" alt="Team discussing project roadmap at whiteboard" />\n\n<!-- Decorative image -->\n<img src="divider.svg" alt="" />`,
          language: "html",
          tip: "Good alt text is specific and concise (under 125 characters). Avoid starting with 'Image of' or 'Photo of'.",
        },
        {
          title: "Prioritize informative images",
          description:
            "Focus first on images that convey important information: product photos, charts, infographics, and screenshots. These need the most descriptive alt text.",
        },
      ],
      wordpress: [
        {
          title: "Add alt text in the Media Library",
          description:
            "Go to Media > Library, click on each image, and fill in the 'Alt Text' field. This applies the alt text everywhere the image is used.",
        },
        {
          title: "Add alt text when inserting images",
          description:
            "When adding an image block in the editor, click on the image and enter alt text in the block settings panel on the right.",
        },
      ],
      nextjs: [
        {
          title: "Add alt prop to next/image",
          description:
            "The Next.js Image component requires an alt prop. Provide descriptive text for each image.",
          codeSnippet: `import Image from "next/image";\n\n<Image src="/photo.jpg" alt="Description of the image" width={800} height={600} />`,
          language: "javascript",
          docsUrl: "https://nextjs.org/docs/app/api-reference/components/image",
        },
        {
          title: "Add a lint rule to enforce alt text",
          description:
            "Enable the jsx-a11y/alt-text ESLint rule to catch missing alt text during development.",
          codeSnippet: `// .eslintrc.json\n{\n  "rules": { "jsx-a11y/alt-text": "error" }\n}`,
          language: "json",
        },
      ],
    },
  },

  HTTP_STATUS: {
    issueCode: "HTTP_STATUS",
    title: "Fix HTTP 4xx/5xx Error Status Codes",
    estimatedMinutes: 20,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Identify the error type",
          description:
            "Check the specific status code: 404 means not found, 403 means forbidden, 500 means server error. Each requires a different fix.",
        },
        {
          title: "Fix 404 errors",
          description:
            "For 404s, either restore the missing page, set up a 301 redirect to the correct URL, or update all links pointing to the broken URL.",
          codeSnippet: `# Nginx redirect example\nserver {\n    location /old-page {\n        return 301 /new-page;\n    }\n}`,
          language: "nginx",
        },
        {
          title: "Fix 500 errors",
          description:
            "Check server logs for the root cause. Common causes include misconfigured .htaccess, PHP errors, database connection failures, or missing dependencies.",
          tip: "Server errors often appear in /var/log/nginx/error.log or your hosting provider's error log panel.",
        },
      ],
      wordpress: [
        {
          title: "Flush permalinks for 404 errors",
          description:
            "Go to Settings > Permalinks and click 'Save Changes' without making changes. This regenerates the .htaccess rewrite rules.",
        },
        {
          title: "Debug 500 errors",
          description:
            "Enable WP_DEBUG to see the actual error. Add the following to wp-config.php temporarily.",
          codeSnippet: `define('WP_DEBUG', true);\ndefine('WP_DEBUG_LOG', true);\ndefine('WP_DEBUG_DISPLAY', false);`,
          language: "php",
          tip: "Check wp-content/debug.log for the error details. Disable WP_DEBUG when done.",
        },
      ],
      nextjs: [
        {
          title: "Create a custom not-found page",
          description:
            "Add a not-found.tsx file in your app directory to handle 404 errors gracefully and guide users back to working pages.",
          codeSnippet: `// app/not-found.tsx\nexport default function NotFound() {\n  return <div><h1>Page Not Found</h1><a href="/">Go Home</a></div>;\n}`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/api-reference/file-conventions/not-found",
        },
        {
          title: "Add error boundaries for 500 errors",
          description:
            "Create an error.tsx file to catch runtime errors and display a recovery UI instead of crashing.",
          codeSnippet: `// app/error.tsx\n"use client";\nexport default function Error({ reset }) {\n  return <div><h1>Something went wrong</h1><button onClick={reset}>Try again</button></div>;\n}`,
          language: "javascript",
        },
      ],
    },
  },

  MISSING_OG_TAGS: {
    issueCode: "MISSING_OG_TAGS",
    title: "Add Open Graph Meta Tags",
    estimatedMinutes: 10,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: "Add required Open Graph tags",
          description:
            "Open Graph tags control how your page appears when shared on social media and in AI-generated previews. Add the four required properties.",
          codeSnippet: `<meta property="og:title" content="Page Title" />\n<meta property="og:description" content="Page description" />\n<meta property="og:image" content="https://example.com/image.jpg" />\n<meta property="og:url" content="https://example.com/page" />`,
          language: "html",
          tip: "Use og:image dimensions of at least 1200x630 pixels for optimal display across platforms.",
        },
        {
          title: "Add og:type and og:site_name",
          description:
            "Include og:type (usually 'website' or 'article') and og:site_name for completeness.",
          codeSnippet: `<meta property="og:type" content="website" />\n<meta property="og:site_name" content="Your Brand" />`,
          language: "html",
        },
      ],
      wordpress: [
        {
          title: "Enable social sharing in Yoast SEO",
          description:
            "Go to Yoast SEO > Social and enable the Open Graph feature. Yoast will automatically generate OG tags from your page title, description, and featured image.",
        },
        {
          title: "Customize per-page OG data",
          description:
            "Edit a page/post, open the Yoast panel, and click the Social tab to set a custom OG title, description, and image for that page.",
        },
      ],
      nextjs: [
        {
          title: "Add openGraph to metadata",
          description:
            "Use the metadata API to define Open Graph properties for each page.",
          codeSnippet: `export const metadata = {\n  openGraph: {\n    title: "Page Title",\n    description: "Page description",\n    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],\n  },\n};`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/api-reference/functions/generate-metadata#opengraph",
        },
        {
          title: "Generate OG images dynamically",
          description:
            "Use the Next.js OG image generation API to create dynamic social images.",
          codeSnippet: `// app/og/route.tsx\nimport { ImageResponse } from "next/og";\nexport async function GET() {\n  return new ImageResponse(<div style={{ fontSize: 48 }}>Hello</div>);\n}`,
          language: "javascript",
        },
      ],
    },
  },

  SLOW_RESPONSE: {
    issueCode: "SLOW_RESPONSE",
    title: "Improve Server Response Time",
    estimatedMinutes: 60,
    difficulty: "advanced",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Enable server-side caching",
          description:
            "Add Cache-Control headers so repeated requests are served from cache instead of regenerating the page every time.",
          codeSnippet: `# Nginx caching headers\nlocation / {\n    add_header Cache-Control "public, max-age=3600, s-maxage=86400";\n}`,
          language: "nginx",
          tip: "Target a Time to First Byte (TTFB) under 200ms. Use WebPageTest or Lighthouse to measure.",
        },
        {
          title: "Optimize database queries",
          description:
            "Slow queries are the most common cause of slow responses. Add indexes to frequently queried columns and avoid N+1 query patterns.",
        },
        {
          title: "Use a CDN",
          description:
            "Put a CDN (Cloudflare, Fastly, etc.) in front of your origin server to cache responses at edge locations close to your users.",
        },
      ],
      wordpress: [
        {
          title: "Install a caching plugin",
          description:
            "Install WP Super Cache or W3 Total Cache to serve static HTML versions of pages instead of running PHP on every request.",
          docsUrl: "https://wordpress.org/plugins/wp-super-cache/",
        },
        {
          title: "Use PHP 8+ and optimize the database",
          description:
            "Upgrade to PHP 8.x for significant performance gains. Use the WP-Optimize plugin to clean and optimize your database tables.",
        },
        {
          title: "Reduce active plugins",
          description:
            "Each plugin adds overhead. Deactivate and delete plugins you do not use. Use the Query Monitor plugin to identify slow plugins.",
        },
      ],
      nextjs: [
        {
          title: "Use static generation where possible",
          description:
            "Prefer static generation (no 'use server' data fetching at request time) for pages that do not change per request.",
          codeSnippet: `// Force static generation\nexport const dynamic = "force-static";\nexport const revalidate = 3600; // Revalidate every hour`,
          language: "javascript",
        },
        {
          title: "Enable ISR for dynamic content",
          description:
            "Use Incremental Static Regeneration to serve cached pages while revalidating in the background.",
          codeSnippet: `export const revalidate = 60; // Regenerate at most every 60 seconds`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration",
        },
      ],
    },
  },

  MISSING_SITEMAP: {
    issueCode: "MISSING_SITEMAP",
    title: "Create a Sitemap.xml",
    estimatedMinutes: 15,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Create a sitemap.xml file",
          description:
            "Create a sitemap.xml at the root of your domain that lists all important pages. Use the standard XML sitemap format.",
          codeSnippet: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc><lastmod>2025-01-15</lastmod></url>\n  <url><loc>https://example.com/about</loc><lastmod>2025-01-10</lastmod></url>\n</urlset>`,
          language: "html",
          tip: "Keep the sitemap under 50MB and 50,000 URLs. Use a sitemap index for larger sites.",
        },
        {
          title: "Submit to search engines",
          description:
            "Submit your sitemap URL in Google Search Console and Bing Webmaster Tools. Also reference it in your robots.txt file.",
          codeSnippet: `# robots.txt\nSitemap: https://example.com/sitemap.xml`,
          language: "txt",
        },
      ],
      wordpress: [
        {
          title: "Enable the built-in WordPress sitemap",
          description:
            "WordPress 5.5+ includes a built-in sitemap at /wp-sitemap.xml. Verify it is accessible. Alternatively, use Yoast SEO which generates a more comprehensive sitemap at /sitemap_index.xml.",
          docsUrl:
            "https://yoast.com/help/xml-sitemaps-in-the-yoast-seo-plugin/",
        },
        {
          title: "Verify sitemap accessibility",
          description:
            "Visit https://yourdomain.com/sitemap_index.xml (Yoast) or /wp-sitemap.xml to confirm the sitemap is accessible and contains your important pages.",
        },
      ],
      nextjs: [
        {
          title: "Create a sitemap.ts file",
          description:
            "Next.js App Router supports generating sitemaps via a sitemap.ts file in the app directory.",
          codeSnippet: `// app/sitemap.ts\nexport default function sitemap() {\n  return [\n    { url: "https://example.com", lastModified: new Date() },\n    { url: "https://example.com/about", lastModified: new Date() },\n  ];\n}`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap",
        },
        {
          title: "Generate sitemap dynamically from data",
          description:
            "Fetch your pages from the database or CMS to generate a complete, always-up-to-date sitemap.",
          codeSnippet:
            "export default async function sitemap() {\n  const pages = await getPages();\n  return pages.map((p) => ({\n    url: `https://example.com/${p.slug}`,\n    lastModified: p.updatedAt,\n  }));\n}",
          language: "javascript",
        },
      ],
    },
  },

  SITEMAP_INVALID_FORMAT: {
    issueCode: "SITEMAP_INVALID_FORMAT",
    title: "Fix Malformed Sitemap XML",
    estimatedMinutes: 15,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Validate the XML structure",
          description:
            "Use an XML validator to check your sitemap. Common issues include unclosed tags, invalid characters, missing XML declaration, or incorrect namespace.",
          codeSnippet: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/page</loc>\n  </url>\n</urlset>`,
          language: "html",
          tip: "The namespace must be exactly 'http://www.sitemaps.org/schemas/sitemap/0.9'. Every <url> must contain a <loc> child.",
        },
        {
          title: "Fix encoding and special characters",
          description:
            "Ensure URLs with special characters are properly encoded. Ampersands must be escaped as &amp; in XML.",
          codeSnippet: `<!-- Wrong -->\n<loc>https://example.com/page?a=1&b=2</loc>\n<!-- Correct -->\n<loc>https://example.com/page?a=1&amp;b=2</loc>`,
          language: "html",
        },
      ],
      wordpress: [
        {
          title: "Regenerate the sitemap",
          description:
            "If using Yoast SEO, go to Yoast SEO > Settings > Site features and toggle XML Sitemaps off then on. This forces regeneration of a clean sitemap.",
        },
        {
          title: "Check for plugin conflicts",
          description:
            "Multiple plugins generating sitemaps can cause issues. Disable all sitemap plugins except one (preferably Yoast) and verify the output.",
        },
      ],
      nextjs: [
        {
          title: "Verify the sitemap.ts return format",
          description:
            "Ensure your sitemap function returns an array of objects with the correct shape. Each entry needs at minimum a `url` property.",
          codeSnippet: `export default function sitemap() {\n  return [\n    { url: "https://example.com", lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },\n  ];\n}`,
          language: "javascript",
        },
        {
          title: "Test the sitemap output",
          description:
            "Visit /sitemap.xml in your browser after deploying. Verify the XML is well-formed and all URLs are correct absolute URLs.",
        },
      ],
    },
  },

  SITEMAP_STALE_URLS: {
    issueCode: "SITEMAP_STALE_URLS",
    title: "Update Stale Sitemap lastmod Dates",
    estimatedMinutes: 15,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Update lastmod dates to reflect actual changes",
          description:
            "The <lastmod> date should reflect when the page content was last meaningfully updated. Dates older than 12 months signal to crawlers that content may be stale.",
          codeSnippet: `<url>\n  <loc>https://example.com/page</loc>\n  <lastmod>2025-11-20</lastmod>\n</url>`,
          language: "html",
          tip: "Only update lastmod when the page content actually changes. Do not set all dates to today; search engines may ignore lastmod entirely if it is unreliable.",
        },
        {
          title: "Automate lastmod generation",
          description:
            "Generate lastmod dates dynamically from your CMS or database rather than hardcoding them. This ensures they stay accurate.",
        },
      ],
      wordpress: [
        {
          title: "Update or republish stale content",
          description:
            "Edit posts with stale dates, make meaningful content updates, and click 'Update'. Yoast automatically uses the post's modified date as lastmod.",
          tip: "Simply clicking 'Update' without changes will update the modified date, but search engines may notice no content change. Make real improvements.",
        },
        {
          title: "Review content freshness regularly",
          description:
            "Set a quarterly reminder to review your oldest content. Update statistics, links, and information, then republish.",
        },
      ],
      nextjs: [
        {
          title: "Use actual modification dates in sitemap.ts",
          description:
            "Fetch the real updatedAt timestamp from your database or CMS when generating the sitemap.",
          codeSnippet:
            "export default async function sitemap() {\n  const pages = await db.query.pages.findMany();\n  return pages.map((p) => ({\n    url: `https://example.com/${p.slug}`,\n    lastModified: p.updatedAt,\n  }));\n}",
          language: "javascript",
        },
        {
          title: "Track content update timestamps",
          description:
            "Ensure your database schema includes an updatedAt column that is set automatically on every content change, not just creation.",
        },
      ],
    },
  },

  SITEMAP_LOW_COVERAGE: {
    issueCode: "SITEMAP_LOW_COVERAGE",
    title: "Improve Sitemap Page Coverage",
    estimatedMinutes: 20,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Audit missing pages",
          description:
            "Compare the pages listed in your sitemap against the pages your site actually has. Add any important pages that are missing from the sitemap.",
        },
        {
          title: "Include all indexable pages",
          description:
            "Your sitemap should include every page you want search engines to index. Exclude only pages with noindex, login pages, and duplicate/thin content pages.",
          codeSnippet: `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc></url>\n  <url><loc>https://example.com/about</loc></url>\n  <url><loc>https://example.com/blog/post-1</loc></url>\n  <!-- Add ALL public pages -->\n</urlset>`,
          language: "html",
          tip: "Aim for the sitemap to cover at least 90% of your crawlable, indexable pages.",
        },
      ],
      wordpress: [
        {
          title: "Check Yoast sitemap exclusions",
          description:
            "Go to Yoast SEO > Settings > Content types and ensure all public post types are included in the sitemap. Also check if individual pages were excluded via the Advanced tab.",
        },
        {
          title: "Include custom post types",
          description:
            "If you have custom post types (products, events, etc.), make sure they are set to 'public' and included in the Yoast sitemap settings.",
        },
      ],
      nextjs: [
        {
          title: "Generate sitemap from all routes",
          description:
            "Query all content sources (database, CMS, file system) to build a comprehensive sitemap.",
          codeSnippet:
            "export default async function sitemap() {\n  const pages = await getAllPages();\n  const posts = await getAllPosts();\n  return [...pages, ...posts].map((item) => ({\n    url: `https://example.com${item.path}`,\n    lastModified: item.updatedAt,\n  }));\n}",
          language: "javascript",
        },
        {
          title: "Use a sitemap index for large sites",
          description:
            "If you have many pages, split into multiple sitemaps and create a sitemap index. Next.js supports generateSitemaps() for this.",
          codeSnippet: `export async function generateSitemaps() {\n  return [{ id: 0 }, { id: 1 }, { id: 2 }];\n}`,
          language: "javascript",
        },
      ],
    },
  },

  REDIRECT_CHAIN: {
    issueCode: "REDIRECT_CHAIN",
    title: "Shorten Redirect Chains",
    estimatedMinutes: 20,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Identify the redirect chain",
          description:
            "A redirect chain occurs when URL A redirects to B, which redirects to C (or more). Each hop adds latency and dilutes link equity. The goal is to go directly from A to the final destination.",
        },
        {
          title: "Update redirects to point to the final URL",
          description:
            "Replace each intermediate redirect so it points directly to the final destination URL.",
          codeSnippet: `# Before: A -> B -> C -> D\n# After: A -> D, B -> D, C -> D\nlocation /page-a { return 301 /page-d; }\nlocation /page-b { return 301 /page-d; }\nlocation /page-c { return 301 /page-d; }`,
          language: "nginx",
          tip: "Keep redirects to a maximum of 1 hop. Google may stop following after 3-5 redirects.",
        },
        {
          title: "Update internal links",
          description:
            "After fixing the redirects, update all internal links to point directly to the final URL, eliminating the need for redirects entirely.",
        },
      ],
      wordpress: [
        {
          title: "Audit redirects with the Redirection plugin",
          description:
            "Open the Redirection plugin and review all redirect rules. Look for chains where one redirect target is itself another redirect source. Update them to point to the final destination.",
          docsUrl: "https://wordpress.org/plugins/redirection/",
        },
        {
          title: "Check for HTTP to HTTPS and www chains",
          description:
            "A common chain is HTTP -> HTTPS -> www (or vice versa). Configure your server to redirect directly to the final canonical form in one step.",
        },
      ],
      nextjs: [
        {
          title: "Flatten redirect chains in next.config.js",
          description:
            "Review all entries in the redirects array and ensure none chain into each other. Each source should redirect directly to the final destination.",
          codeSnippet: `module.exports = {\n  async redirects() {\n    return [\n      { source: "/old-a", destination: "/final-page", permanent: true },\n      { source: "/old-b", destination: "/final-page", permanent: true },\n    ];\n  },\n};`,
          language: "javascript",
        },
        {
          title: "Update Link components",
          description:
            "Search your codebase for any <Link> or <a> tags pointing to redirect sources and update them to the final URL directly.",
        },
      ],
    },
  },

  CORS_MIXED_CONTENT: {
    issueCode: "CORS_MIXED_CONTENT",
    title: "Fix Mixed Content (HTTP on HTTPS Pages)",
    estimatedMinutes: 15,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Identify mixed content resources",
          description:
            "Open browser DevTools (Console tab) and look for 'Mixed Content' warnings. These indicate HTTPS pages loading resources (images, scripts, stylesheets) over insecure HTTP.",
        },
        {
          title: "Update resource URLs to HTTPS",
          description:
            "Change all HTTP resource URLs to HTTPS. If the resource host does not support HTTPS, host the resource yourself or find an alternative.",
          codeSnippet: `<!-- Before -->\n<img src="http://example.com/image.jpg" />\n<script src="http://cdn.example.com/lib.js"></script>\n\n<!-- After -->\n<img src="https://example.com/image.jpg" />\n<script src="https://cdn.example.com/lib.js"></script>`,
          language: "html",
        },
        {
          title: "Add Content-Security-Policy header",
          description:
            "Use the upgrade-insecure-requests CSP directive as a safety net to automatically upgrade HTTP requests to HTTPS.",
          codeSnippet: `<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />`,
          language: "html",
          tip: "This is a fallback, not a fix. You should still update the actual URLs to HTTPS.",
        },
      ],
      wordpress: [
        {
          title: "Update site URLs to HTTPS",
          description:
            "Go to Settings > General and ensure both 'WordPress Address' and 'Site Address' use https://. Then use Better Search Replace to change http:// to https:// across all content.",
        },
        {
          title: "Install Really Simple SSL",
          description:
            "The Really Simple SSL plugin automatically detects and fixes most mixed content issues by rewriting HTTP URLs to HTTPS.",
          docsUrl: "https://wordpress.org/plugins/really-simple-ssl/",
        },
      ],
      nextjs: [
        {
          title: "Use protocol-relative or HTTPS URLs",
          description:
            "Ensure all external resource references in your components and stylesheets use HTTPS.",
          codeSnippet: `// Avoid:\nconst imageUrl = "http://cdn.example.com/img.jpg";\n// Use:\nconst imageUrl = "https://cdn.example.com/img.jpg";`,
          language: "javascript",
        },
        {
          title: "Add security headers via middleware",
          description:
            "Add Content-Security-Policy headers in your Next.js middleware or next.config.js to enforce HTTPS for all subresources.",
          codeSnippet: `// next.config.js\nmodule.exports = {\n  async headers() {\n    return [{ source: "/(.*)", headers: [\n      { key: "Content-Security-Policy", value: "upgrade-insecure-requests" }\n    ]}];\n  },\n};`,
          language: "javascript",
        },
      ],
    },
  },

  CORS_UNSAFE_LINKS: {
    issueCode: "CORS_UNSAFE_LINKS",
    title: 'Add rel="noopener" to External Links',
    estimatedMinutes: 10,
    difficulty: "beginner",
    aiFixAvailable: true,
    platforms: {
      generic: [
        {
          title: 'Add rel="noopener" to target="_blank" links',
          description:
            'External links with target="_blank" can access your page via window.opener, which is a security risk. Add rel="noopener" to prevent this.',
          codeSnippet: `<!-- Before -->\n<a href="https://external.com" target="_blank">Link</a>\n\n<!-- After -->\n<a href="https://external.com" target="_blank" rel="noopener noreferrer">Link</a>`,
          language: "html",
          tip: 'Modern browsers treat target="_blank" as noopener by default, but adding it explicitly ensures compatibility with older browsers.',
        },
        {
          title: "Audit all external links",
          description:
            'Search your HTML for all instances of target="_blank" and ensure each one has rel="noopener" (or rel="noopener noreferrer").',
        },
      ],
      wordpress: [
        {
          title: "WordPress adds noopener automatically",
          description:
            'Since WordPress 4.7.4, the editor automatically adds rel="noopener" to links with target="_blank". If you see missing noopener, check for hardcoded links in theme templates or custom HTML blocks.',
        },
        {
          title: "Fix theme template links",
          description:
            'Search your theme files for target="_blank" and add rel="noopener noreferrer" where missing.',
          codeSnippet: `<a href="<?php echo esc_url($url); ?>"\n   target="_blank"\n   rel="noopener noreferrer">\n  <?php echo esc_html($text); ?>\n</a>`,
          language: "php",
        },
      ],
      nextjs: [
        {
          title: "Add rel to external Link components",
          description:
            'When using anchor tags for external links, always include rel="noopener noreferrer" alongside target="_blank".',
          codeSnippet: `<a\n  href="https://external.com"\n  target="_blank"\n  rel="noopener noreferrer"\n>\n  External Link\n</a>`,
          language: "javascript",
        },
        {
          title: "Create a reusable ExternalLink component",
          description:
            "Build a shared component that automatically applies the correct rel attribute to all external links.",
          codeSnippet: `function ExternalLink({ href, children, ...props }) {\n  return (\n    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>\n      {children}\n    </a>\n  );\n}`,
          language: "javascript",
        },
      ],
    },
  },
};
