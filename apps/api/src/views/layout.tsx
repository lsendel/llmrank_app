/** @jsxImportSource hono/jsx */
import type { FC, PropsWithChildren } from "hono/jsx";

export const Layout: FC<
  PropsWithChildren<{ title: string; user?: { email: string; plan: string } }>
> = ({ title, user, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — LLM Boost</title>
      <script src="https://unpkg.com/htmx.org@2.0.4"></script>
      <script
        src="https://unpkg.com/alpinejs@3.14.8/dist/cdn.min.js"
        defer
      ></script>
      <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
    </head>
    <body class="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <nav class="border-b bg-white px-6 py-3 dark:bg-gray-900">
        <div class="mx-auto flex max-w-7xl items-center justify-between">
          <a href="/app" class="text-lg font-bold">
            LLM Boost
          </a>
          {user && (
            <div class="flex items-center gap-4 text-sm">
              <span class="text-gray-500">{user.email}</span>
              <span class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium capitalize text-blue-700">
                {user.plan}
              </span>
              <a href="/app/settings" class="hover:underline">
                Settings
              </a>
            </div>
          )}
        </div>
      </nav>
      <main class="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </body>
  </html>
);

export const PageHeader: FC<{
  title: string;
  description?: string;
  actions?: any;
}> = ({ title, description, actions }) => (
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">{title}</h1>
      {description && <p class="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
    {actions}
  </div>
);
