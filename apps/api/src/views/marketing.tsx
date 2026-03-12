/** @jsxImportSource hono/jsx */

const MarketingHeader = () => (
  <header class="border-b border-gray-200 bg-white">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
      <a href="/" class="text-xl font-bold tracking-tight text-blue-600">
        LLM Rank
      </a>
      <nav class="flex items-center gap-6">
        <a
          href="/ai-seo-tool"
          class="hidden text-sm font-medium text-gray-500 hover:text-gray-900 md:block"
        >
          AI SEO Tool
        </a>
        <a
          href="/pricing"
          class="hidden text-sm font-medium text-gray-500 hover:text-gray-900 md:block"
        >
          Pricing
        </a>
        <a
          href="/sign-in"
          class="hidden text-sm font-medium text-gray-500 hover:text-gray-900 sm:block"
        >
          Sign in
        </a>
        <a
          href="/scan"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Get Started
        </a>
      </nav>
    </div>
  </header>
);

const MarketingFooter = () => (
  <footer class="border-t border-gray-200 bg-gray-50 py-12">
    <div class="mx-auto grid max-w-7xl gap-8 px-6 text-sm md:grid-cols-4">
      <div class="col-span-1 md:col-span-2">
        <span class="mb-4 text-lg font-bold">LLM Rank</span>
        <p class="mt-2 max-w-xs text-gray-500">
          The first B2B platform for AI Search Optimization (AISO). Helping
          brands become the cited source for the world's knowledge models.
        </p>
      </div>
      <div>
        <h3 class="mb-4 font-bold">Platform</h3>
        <ul class="space-y-3 text-gray-500">
          <li><a href="/scan" class="hover:text-gray-900">Free Audit</a></li>
          <li><a href="/pricing" class="hover:text-gray-900">Pricing</a></li>
          <li><a href="/ai-seo-tool" class="hover:text-gray-900">AI SEO Tool</a></li>
        </ul>
      </div>
      <div>
        <h3 class="mb-4 font-bold">Resources</h3>
        <ul class="space-y-3 text-gray-500">
          <li><a href="/chatgpt-seo" class="hover:text-gray-900">ChatGPT SEO Guide</a></li>
          <li><a href="/privacy" class="hover:text-gray-900">Privacy Policy</a></li>
          <li><a href="/terms" class="hover:text-gray-900">Terms</a></li>
        </ul>
      </div>
    </div>
    <div class="mx-auto mt-12 max-w-7xl border-t border-gray-200 px-6 pt-8 text-center text-sm text-gray-500">
      &copy; {new Date().getFullYear()} LLM Rank. All rights reserved.
    </div>
  </footer>
);

export const MarketingPage = ({
  title,
  children,
}: {
  title: string;
  children: any;
}) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — LLM Rank</title>
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    </head>
    <body class="min-h-screen bg-white text-gray-900">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </body>
  </html>
);
