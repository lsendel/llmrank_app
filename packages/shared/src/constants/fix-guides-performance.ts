import type { FixGuide } from "./fix-guides";

export const PERFORMANCE_GUIDES: Record<string, FixGuide> = {
  LH_PERF_LOW: {
    issueCode: "LH_PERF_LOW",
    title: "Lighthouse Performance Score Below Threshold",
    estimatedMinutes: 120,
    difficulty: "advanced",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Optimize and lazy-load images",
          description:
            "Images are often the largest assets on a page. Convert them to modern formats (WebP/AVIF), resize to the displayed dimensions, and lazy-load offscreen images to reduce initial payload and Largest Contentful Paint (LCP) time.",
          codeSnippet: `<img src="hero.webp" alt="Hero"
     width="800" height="450"
     loading="lazy" decoding="async">`,
          language: "html",
          tip: "Use the <picture> element with srcset for responsive images and format fallbacks.",
          docsUrl: "https://web.dev/articles/optimize-lcp",
        },
        {
          title: "Eliminate render-blocking resources",
          description:
            "Move non-critical CSS and JavaScript out of the critical rendering path. Defer scripts that are not needed for the initial paint and inline critical CSS to avoid blocking the first render.",
          codeSnippet: `<link rel="preload" href="critical.css" as="style">
<script src="app.js" defer></script>`,
          language: "html",
          tip: "Use the Coverage tab in Chrome DevTools to identify unused CSS and JS on initial load.",
          docsUrl: "https://web.dev/articles/render-blocking-resources",
        },
        {
          title: "Minimize main-thread work",
          description:
            "Long JavaScript tasks block the main thread and hurt Time to Interactive (TTI) and Total Blocking Time (TBT). Split large bundles with code-splitting, remove unused polyfills, and defer expensive computations.",
          codeSnippet: `<!-- Preconnect to critical third-party origins -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="https://cdn.example.com">`,
          language: "html",
          docsUrl: "https://web.dev/articles/long-tasks-devtools",
        },
        {
          title: "Enable text compression and caching",
          description:
            "Serve all text-based assets (HTML, CSS, JS, SVG, JSON) with Brotli or Gzip compression and set long Cache-Control headers for static assets to eliminate redundant network transfers.",
          codeSnippet: `# nginx – enable Brotli / gzip
brotli on;
brotli_types text/html text/css application/javascript;
gzip on;
gzip_types text/html text/css application/javascript;`,
          language: "nginx",
          docsUrl: "https://web.dev/articles/codelab-text-compression-brotli",
        },
      ],
      wordpress: [
        {
          title: "Install a caching and optimization plugin",
          description:
            "A caching plugin generates static HTML, minifies CSS/JS, and enables lazy-loading in one step. WP Rocket is the most comprehensive option; LiteSpeed Cache is a good free alternative.",
          codeSnippet: `// wp-config.php – enable page caching
define('WP_CACHE', true);`,
          language: "php",
          tip: "Enable 'Optimize CSS Delivery' and 'Delay JavaScript execution' in WP Rocket for the biggest gains.",
        },
        {
          title: "Optimize images with Imagify or ShortPixel",
          description:
            "Install Imagify (or ShortPixel) to bulk-compress existing images and auto-convert new uploads to WebP. Enable lazy-loading for offscreen images in the plugin settings.",
          tip: "Choose 'Aggressive' compression in Imagify for the best balance of quality and file size.",
        },
        {
          title: "Reduce plugin bloat",
          description:
            "Deactivate and delete unused plugins. Each plugin may enqueue its own CSS and JS files on every page. Use the Query Monitor plugin to identify slow database queries and heavy assets from plugins.",
          tip: "Asset CleanUp (Starter) lets you selectively disable plugin CSS/JS on pages where they are not needed.",
        },
      ],
      nextjs: [
        {
          title: "Use next/image for automatic image optimization",
          description:
            "The next/image component automatically resizes, compresses, and lazy-loads images. It serves modern formats (WebP/AVIF) based on the browser's Accept header.",
          codeSnippet: `import Image from "next/image";

<Image src="/hero.jpg" alt="Hero"
  width={800} height={450} priority />`,
          language: "javascript",
          docsUrl: "https://nextjs.org/docs/app/api-reference/components/image",
        },
        {
          title: "Code-split with dynamic imports",
          description:
            "Use next/dynamic to lazy-load heavy components that are not visible in the initial viewport. This reduces the main JavaScript bundle and improves TTI.",
          codeSnippet: `import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("./Chart"), {
  ssr: false, loading: () => <p>Loading...</p>,
});`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading",
        },
        {
          title: "Optimize fonts with next/font",
          description:
            "next/font self-hosts Google Fonts at build time, eliminating extra network requests and layout shift caused by font loading. Always set the display strategy to 'swap'.",
          codeSnippet: `import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/building-your-application/optimizing/fonts",
        },
        {
          title: "Analyze and reduce bundle size",
          description:
            "Enable the Next.js bundle analyzer to identify large dependencies. Replace heavy libraries with lighter alternatives (e.g., date-fns instead of moment, lucide-react instead of react-icons).",
          codeSnippet: `// next.config.js
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
module.exports = withBundleAnalyzer({});`,
          language: "javascript",
          tip: "Run ANALYZE=true next build to generate the interactive treemap.",
        },
      ],
    },
  },

  LH_SEO_LOW: {
    issueCode: "LH_SEO_LOW",
    title: "Lighthouse SEO Score Below 0.8",
    estimatedMinutes: 30,
    difficulty: "beginner",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Add essential meta tags",
          description:
            "Ensure every page has a unique <title> (50-60 characters) and a meta description (120-160 characters). These tags are the primary signals Lighthouse checks for SEO compliance.",
          codeSnippet: `<title>AI-Readiness SEO Audit | LLM Boost</title>
<meta name="description"
  content="Score your pages across 37 AI-readiness factors and get actionable fixes.">`,
          language: "html",
          docsUrl: "https://web.dev/articles/lighthouse-seo",
        },
        {
          title: "Make the page crawlable",
          description:
            "Ensure the page is not blocked by robots.txt or a noindex directive. Add a valid canonical URL to avoid duplicate content issues. Links should have descriptive anchor text rather than generic 'click here'.",
          codeSnippet: `<link rel="canonical" href="https://example.com/page">
<meta name="robots" content="index, follow">`,
          language: "html",
          tip: "Use Google Search Console's URL Inspection tool to verify Googlebot can access and render the page.",
        },
        {
          title: "Add structured data and viewport meta",
          description:
            "Set the viewport meta tag for mobile-friendliness (a Lighthouse SEO check). Add structured data (JSON-LD) so search engines better understand page content.",
          codeSnippet: `<meta name="viewport"
  content="width=device-width, initial-scale=1">`,
          language: "html",
          docsUrl: "https://web.dev/articles/responsive-web-design-basics",
        },
      ],
      wordpress: [
        {
          title: "Install and configure Yoast SEO or Rank Math",
          description:
            "These plugins add meta title/description editors, canonical URLs, XML sitemaps, and structured data automatically. Follow the setup wizard to fill in site-wide defaults.",
          tip: "Use the 'SEO Analysis' panel on each post to ensure the traffic-light score is green before publishing.",
        },
        {
          title: "Check theme mobile-friendliness",
          description:
            "Verify your theme declares a proper viewport meta tag and that text is readable without zooming. Most modern WordPress themes handle this, but older or custom themes may not.",
          tip: "Test with Chrome DevTools device toolbar or Google's Mobile-Friendly Test.",
        },
      ],
      nextjs: [
        {
          title: "Export metadata from page components",
          description:
            "In the App Router, export a metadata object or generateMetadata function from each page to set title, description, canonical URL, and Open Graph tags.",
          codeSnippet: `export const metadata = {
  title: "Dashboard | LLM Boost",
  description: "View your AI-readiness scores.",
};`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/building-your-application/optimizing/metadata",
        },
        {
          title: "Add a sitemap and robots.txt",
          description:
            "Create app/sitemap.ts and app/robots.ts to generate dynamic sitemap and robots files. This helps search engines discover all pages efficiently.",
          codeSnippet: `// app/robots.ts
export default function robots() {
  return { rules: { userAgent: "*", allow: "/" },
    sitemap: "https://example.com/sitemap.xml" };
}`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots",
        },
      ],
    },
  },

  LH_A11Y_LOW: {
    issueCode: "LH_A11Y_LOW",
    title: "Lighthouse Accessibility Score Below 0.7",
    estimatedMinutes: 60,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Add alt text to all images",
          description:
            'Every <img> element must have a meaningful alt attribute describing the image content. Decorative images should use an empty alt="" so screen readers skip them.',
          codeSnippet: `<img src="chart.png" alt="Monthly traffic growth chart">
<img src="divider.svg" alt="" role="presentation">`,
          language: "html",
          docsUrl: "https://web.dev/articles/image-alt",
        },
        {
          title: "Ensure sufficient color contrast",
          description:
            "Text must have a contrast ratio of at least 4.5:1 against its background (3:1 for large text). Use the Chrome DevTools color picker or WebAIM Contrast Checker to verify.",
          tip: "The axe DevTools browser extension highlights all contrast failures on a page in one click.",
          docsUrl: "https://web.dev/articles/color-and-contrast-accessibility",
        },
        {
          title: "Use semantic HTML and ARIA labels",
          description:
            "Replace generic <div> click handlers with native <button> and <a> elements. Add aria-label to icon-only buttons and ensure form inputs have associated <label> elements.",
          codeSnippet: `<button aria-label="Close dialog">
  <svg>...</svg>
</button>
<label for="email">Email</label>
<input id="email" type="email">`,
          language: "html",
          docsUrl: "https://web.dev/articles/semantics-and-screen-readers",
        },
      ],
      wordpress: [
        {
          title: "Add alt text to media library images",
          description:
            "Open the WordPress Media Library and fill in the 'Alternative Text' field for every image. When inserting images into posts, always provide descriptive alt text in the block settings.",
          tip: "The 'Missing Alt Text' filter in the Media Library helps you find images without alt attributes.",
        },
        {
          title: "Use an accessible theme and check plugin output",
          description:
            "Choose a theme tagged 'accessibility-ready' in the WordPress theme directory. Run the WAVE browser extension on key pages to catch contrast, heading order, and landmark issues introduced by plugins.",
          tip: "The WP Accessibility plugin can add skip links, fix tab order, and enforce alt text requirements.",
        },
      ],
      nextjs: [
        {
          title:
            "Leverage next/image alt enforcement and eslint-plugin-jsx-a11y",
          description:
            "next/image requires an alt prop by default. Add eslint-plugin-jsx-a11y to your ESLint config to catch missing labels, invalid ARIA attributes, and non-interactive element handlers at build time.",
          codeSnippet: `// .eslintrc.json
{
  "extends": ["next/core-web-vitals",
    "plugin:jsx-a11y/recommended"]
}`,
          language: "json",
          docsUrl: "https://nextjs.org/docs/architecture/accessibility",
        },
        {
          title: "Add skip navigation and focus management",
          description:
            "Add a 'Skip to main content' link as the first focusable element in your layout. After client-side navigations, move focus to the new page heading so screen reader users are oriented.",
          codeSnippet: `<a href="#main" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
<main id="main">{children}</main>`,
          language: "html",
        },
      ],
    },
  },

  LH_BP_LOW: {
    issueCode: "LH_BP_LOW",
    title: "Lighthouse Best Practices Score Below 0.8",
    estimatedMinutes: 45,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Serve the site over HTTPS and avoid mixed content",
          description:
            "All resources (images, scripts, stylesheets, fonts) must be loaded over HTTPS. Mixed content warnings lower the Best Practices score and trigger browser security warnings.",
          codeSnippet: `<!-- Upgrade insecure requests via CSP header -->
<meta http-equiv="Content-Security-Policy"
  content="upgrade-insecure-requests">`,
          language: "html",
          docsUrl: "https://web.dev/articles/what-is-mixed-content",
        },
        {
          title: "Remove deprecated APIs and fix console errors",
          description:
            "Lighthouse flags deprecated JavaScript APIs (such as synchronous XHR on the main thread), unresolved console errors, and missing HTTPS. Audit the browser console for errors and replace any deprecated API calls with modern equivalents.",
          tip: "Run Lighthouse in 'verbose' mode to see which specific Best Practices audits are failing.",
          docsUrl: "https://web.dev/articles/lighthouse-best-practices",
        },
        {
          title: "Set correct image aspect ratios and use passive listeners",
          description:
            "Always specify width and height on images to prevent layout shift. Add { passive: true } to touch and wheel event listeners to improve scrolling performance and avoid Lighthouse warnings.",
          codeSnippet: `addEventListener("touchstart", handler, {
  passive: true,
});`,
          language: "javascript",
        },
      ],
      wordpress: [
        {
          title: "Install an SSL certificate and force HTTPS",
          description:
            "Most hosts offer free Let's Encrypt certificates. After installing SSL, update the WordPress Address and Site Address to https:// in Settings > General. Use the Really Simple SSL plugin to fix mixed content references in the database.",
          tip: "Run 'Why No Padlock?' on your pages to identify remaining mixed content resources.",
        },
        {
          title: "Update WordPress core, themes, and plugins",
          description:
            "Outdated software often uses deprecated browser APIs that trigger Best Practices failures. Enable auto-updates for minor releases and keep major versions current.",
          tip: "The Site Health screen (Tools > Site Health) surfaces security and best-practice issues automatically.",
        },
      ],
      nextjs: [
        {
          title: "Fix console errors and remove deprecated APIs",
          description:
            "Next.js surfaces React hydration mismatches and hook violations as console errors. Fix all hydration warnings, ensure server and client renders match, and avoid accessing browser globals (window, navigator) during SSR.",
          codeSnippet: `// Safe client-only code
"use client";
import { useEffect, useState } from "react";

export function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : null;
}`,
          language: "javascript",
        },
        {
          title: "Configure security headers",
          description:
            "Add Content-Security-Policy, X-Content-Type-Options, and Referrer-Policy headers in next.config.js or middleware. These improve the Best Practices score and harden the application.",
          codeSnippet: `// next.config.js headers()
{ key: "X-Content-Type-Options", value: "nosniff" },
{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
{ key: "X-Frame-Options", value: "SAMEORIGIN" }`,
          language: "javascript",
          docsUrl:
            "https://nextjs.org/docs/app/api-reference/config/next-config-js/headers",
        },
      ],
    },
  },

  LARGE_PAGE_SIZE: {
    issueCode: "LARGE_PAGE_SIZE",
    title: "Total Page Size Exceeds 3 MB",
    estimatedMinutes: 60,
    difficulty: "intermediate",
    aiFixAvailable: false,
    platforms: {
      generic: [
        {
          title: "Audit and compress images",
          description:
            "Images are typically the largest contributors to page weight. Convert images to WebP or AVIF, resize them to the maximum displayed dimensions, and compress them to an acceptable quality level (80-85% for photos).",
          codeSnippet: `<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="Hero" width="1200" height="600">
</picture>`,
          language: "html",
          tip: "Use Squoosh (squoosh.app) for one-off compression or sharp/imagemin in your build pipeline.",
        },
        {
          title: "Minify and tree-shake CSS and JavaScript",
          description:
            "Remove unused CSS rules (PurgeCSS) and enable tree-shaking in your bundler to eliminate dead JavaScript code. Minify all production assets to reduce their transfer size.",
          codeSnippet: `// Example: PurgeCSS config for PostCSS
module.exports = {
  content: ["./src/**/*.{html,js}"],
  defaultExtractor: (c) => c.match(/[\\w-/:]+/g) || [],
};`,
          language: "javascript",
          docsUrl: "https://purgecss.com/guides/next.html",
        },
        {
          title: "Enable server-side compression",
          description:
            "Configure your web server to compress responses with Brotli (preferred) or Gzip. Text assets typically compress by 70-90%, dramatically reducing transfer size.",
          codeSnippet: `# nginx – static Brotli + gzip fallback
brotli_static on;
gzip_static on;
gzip on;
gzip_min_length 256;`,
          language: "nginx",
          docsUrl: "https://web.dev/articles/codelab-text-compression-brotli",
        },
        {
          title: "Remove or replace heavy third-party scripts",
          description:
            "Audit third-party scripts (analytics, chat widgets, ad tags) using Chrome DevTools Network tab sorted by size. Remove unused scripts and consider lighter alternatives or loading them on interaction only.",
          tip: "The 'Third-party usage' section in a Lighthouse report shows the exact byte cost of each vendor.",
        },
      ],
      wordpress: [
        {
          title: "Compress and convert images with Imagify",
          description:
            "Install Imagify and run a bulk optimization on your entire Media Library. Enable 'WebP conversion' to serve modern formats automatically. Set the compression level to 'Aggressive' for maximum savings.",
          tip: "Imagify can also resize images that exceed a maximum dimension, preventing oversized uploads.",
        },
        {
          title: "Minify and combine assets with WP Rocket",
          description:
            "Enable 'Minify CSS' and 'Minify JavaScript' in WP Rocket. Turn on 'Combine CSS/JS' cautiously (test for breakage). Enable 'Remove Unused CSS' to eliminate styles from plugins that are not active on a given page.",
          tip: "Use the WP Rocket 'File Optimization' tab and test each option individually to avoid breaking your layout.",
        },
        {
          title: "Lazy-load media and embeds",
          description:
            "Enable lazy-loading for images, iframes, and video embeds in WP Rocket or via the native WordPress lazy-loading setting. This prevents offscreen media from contributing to the initial page weight.",
        },
      ],
      nextjs: [
        {
          title: "Use next/image for automatic optimization",
          description:
            "next/image automatically resizes, compresses, and serves images in modern formats. Set the quality prop for large hero images and use the sizes prop to avoid serving desktop-sized images on mobile.",
          codeSnippet: `<Image src="/photo.jpg" alt="Photo"
  width={1200} height={800}
  quality={80} sizes="(max-width: 768px) 100vw, 50vw" />`,
          language: "javascript",
          docsUrl: "https://nextjs.org/docs/app/api-reference/components/image",
        },
        {
          title: "Analyze and split large bundles",
          description:
            "Run the bundle analyzer to find oversized dependencies. Use next/dynamic to lazy-load heavy components (charts, editors, maps) so they are not included in the initial page JavaScript.",
          codeSnippet: `import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
});`,
          language: "javascript",
          tip: "Check for accidental barrel-file imports (e.g., importing one icon from a library that bundles all icons).",
        },
        {
          title: "Optimize fonts and eliminate unused CSS",
          description:
            "Use next/font to self-host fonts and avoid render-blocking network requests. If using Tailwind CSS, ensure the content paths in tailwind.config.js are precise so unused utility classes are purged at build time.",
          codeSnippet: `// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
};`,
          language: "javascript",
        },
      ],
    },
  },
};
