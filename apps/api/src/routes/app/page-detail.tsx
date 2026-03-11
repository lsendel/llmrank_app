/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { Layout } from "../../views/layout";
import { scoreQueries } from "@llm-boost/db";
import { Breadcrumb } from "../../views/htmx-helpers";

export const pageDetailAppRoutes = new Hono<AppEnv>();
// =====================================================================
// Page Detail Page
// =====================================================================

const PAGE_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "technical", label: "Technical" },
  { key: "content", label: "Content" },
  { key: "issues", label: "Issues" },
  { key: "performance", label: "Performance" },
] as const;

type PageDetailTab = (typeof PAGE_DETAIL_TABS)[number]["key"];

pageDetailAppRoutes.get("/projects/:id/pages/:pageId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const projectId = c.req.param("id");
  const pageId = c.req.param("pageId");
  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) return c.text("Not found", 404);

  const { score, issues } = await scoreQueries(db).getByPageWithIssues(pageId);
  if (!score) return c.text("Page not found", 404);

  const rawTab = c.req.query("tab") ?? "overview";
  const tab = PAGE_DETAIL_TABS.find((t) => t.key === rawTab)
    ? (rawTab as PageDetailTab)
    : "overview";

  const detail = (score.detail ?? {}) as Record<string, unknown>;
  const pageUrl = (detail.url as string) ?? "";
  const title = (detail.title as string) ?? "";

  const content = (
    <div>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/app/projects" },
          { label: project.name, href: `/app/projects/${projectId}` },
          { label: "Page Analysis" },
        ]}
      />
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Page Analysis</h1>
        <p class="mt-0.5 font-mono text-sm text-gray-500">
          {pageUrl || "Unknown URL"}
        </p>
      </div>

      <div class="mb-6 flex gap-1 overflow-x-auto border-b" role="tablist">
        {PAGE_DETAIL_TABS.map((t) => (
          <button
            hx-get={`/app/projects/${projectId}/pages/${pageId}/tab/${t.key}`}
            hx-target="#page-tab-content"
            hx-push-url={`/app/projects/${projectId}/pages/${pageId}?tab=${t.key}`}
            class={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              t.key === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            role="tab"
          >
            <span class="tab-label">
              {t.key === "issues" ? `Issues (${issues.length})` : t.label}
            </span>
            <span class="tab-spinner h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></span>
          </button>
        ))}
      </div>

      <div
        id="page-tab-content"
        hx-get={`/app/projects/${projectId}/pages/${pageId}/tab/${tab}`}
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <SkeletonText lines={5} />
      </div>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout
      title={`Page — ${title || "Analysis"}`}
      user={{ email: user.email ?? "", plan: user.plan }}
    >
      {content}
    </Layout>,
  );
});

// ─── Page overview tab ────────────────────────────────
pageDetailAppRoutes.get("/projects/:id/pages/:pageId/tab/overview", async (c) => {
  const db = c.get("db");
  const pageId = c.req.param("pageId");
  const { score } = await scoreQueries(db).getByPageWithIssues(pageId);
  if (!score) return c.text("Not found", 404);

  const detail = (score.detail ?? {}) as Record<string, unknown>;
  const title = (detail.title as string) ?? "—";
  const metaDesc = (detail.metaDescription as string) ?? "—";
  const statusCode = (detail.statusCode as number) ?? null;
  const wordCount = (detail.wordCount as number) ?? null;

  return c.html(
    <div class="space-y-6">
      {/* Score cards */}
      <div class="grid gap-4 sm:grid-cols-5">
        {(
          [
            ["Overall", score.overallScore],
            ["Technical", score.technicalScore],
            ["Content", score.contentScore],
            ["AI Readiness", score.aiReadinessScore],
            ["Performance", score.lighthousePerf],
          ] as [string, number | null][]
        ).map(([label, val]) => (
          <div class="flex flex-col items-center rounded-lg border bg-white p-4 dark:bg-gray-900">
            <span
              class={`text-3xl font-bold ${gradeColor(val ?? 0)}`}
              data-count-up={val ?? undefined}
            >
              {val ?? "—"}
            </span>
            <span class="mt-1 text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
      <script src="/app/static/charts.js"></script>

      {/* Page metadata */}
      <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-4 text-sm font-semibold text-gray-500">Page Metadata</h3>
        <dl class="space-y-3 text-sm">
          <div>
            <dt class="font-medium text-gray-500">Title</dt>
            <dd class="mt-0.5">{title}</dd>
          </div>
          <div>
            <dt class="font-medium text-gray-500">Meta Description</dt>
            <dd class="mt-0.5 text-gray-700">{metaDesc}</dd>
          </div>
          <div class="flex gap-8">
            {statusCode && (
              <div>
                <dt class="font-medium text-gray-500">Status</dt>
                <dd class="mt-0.5">
                  <span
                    class={`rounded px-2 py-0.5 text-xs font-medium ${statusCode < 300 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                  >
                    {statusCode}
                  </span>
                </dd>
              </div>
            )}
            {wordCount !== null && (
              <div>
                <dt class="font-medium text-gray-500">Word Count</dt>
                <dd class="mt-0.5">{wordCount.toLocaleString()}</dd>
              </div>
            )}
          </div>
        </dl>
      </div>
    </div>,
  );
});

// ─── Page technical tab ───────────────────────────────
pageDetailAppRoutes.get("/projects/:id/pages/:pageId/tab/technical", async (c) => {
  const db = c.get("db");
  const pageId = c.req.param("pageId");
  const { score } = await scoreQueries(db).getByPageWithIssues(pageId);
  if (!score) return c.text("Not found", 404);

  const detail = (score.detail ?? {}) as Record<string, unknown>;
  const checks = [
    ["Has canonical", detail.hasCanonical],
    ["Has robots meta", detail.hasRobotsMeta],
    ["Has sitemap reference", detail.inSitemap],
    ["Has structured data", detail.hasStructuredData],
    ["Has Open Graph", detail.hasOpenGraph],
    ["Has hreflang", detail.hasHreflang],
    ["SSL/HTTPS", detail.isHttps],
    ["Mobile friendly", detail.isMobileFriendly],
  ];

  return c.html(
    <div class="space-y-6">
      <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-2 text-sm font-semibold text-gray-500">
          Technical Score: {score.technicalScore ?? "—"}/100
        </h3>
        <div class="mt-1 h-2 w-full rounded-full bg-gray-200">
          <div
            class={`h-2 rounded-full transition-all duration-700 ${(score.technicalScore ?? 0) >= 80 ? "bg-green-500" : (score.technicalScore ?? 0) >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
            style="width: 0%"
            data-score-bar={Math.min(score.technicalScore ?? 0, 100)}
          ></div>
        </div>
      </div>
      <script src="/app/static/charts.js"></script>

      <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-4 text-sm font-semibold text-gray-500">
          Technical Checks
        </h3>
        <div class="grid gap-3 sm:grid-cols-2">
          {checks.map(([label, val]) => (
            <div class="flex items-center gap-2 text-sm">
              <span
                class={`flex h-5 w-5 items-center justify-center rounded-full ${val ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}
              >
                {val ? (
                  <svg
                    class="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    class="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </span>
              <span>{label as string}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
  );
});

// ─── Page content tab ─────────────────────────────────
pageDetailAppRoutes.get("/projects/:id/pages/:pageId/tab/content", async (c) => {
  const db = c.get("db");
  const pageId = c.req.param("pageId");
  const { score } = await scoreQueries(db).getByPageWithIssues(pageId);
  if (!score) return c.text("Not found", 404);

  const detail = (score.detail ?? {}) as Record<string, unknown>;
  const headings = (detail.headings as { tag: string; text: string }[]) ?? [];
  const wordCount = (detail.wordCount as number) ?? 0;
  const readabilityScore = (detail.readabilityScore as number) ?? null;
  const titleLength = ((detail.title as string) ?? "").length;
  const descLength = ((detail.metaDescription as string) ?? "").length;

  return c.html(
    <div class="space-y-6">
      <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-2 text-sm font-semibold text-gray-500">
          Content Score: {score.contentScore ?? "—"}/100
        </h3>
        <div class="mt-1 h-2 w-full rounded-full bg-gray-200">
          <div
            class={`h-2 rounded-full transition-all duration-700 ${(score.contentScore ?? 0) >= 80 ? "bg-green-500" : (score.contentScore ?? 0) >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
            style="width: 0%"
            data-score-bar={Math.min(score.contentScore ?? 0, 100)}
          ></div>
        </div>
      </div>
      <script src="/app/static/charts.js"></script>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-4 text-sm font-semibold text-gray-500">
            Content Metrics
          </h3>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500">Word Count</dt>
              <dd class="font-medium">{wordCount.toLocaleString()}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">Title Length</dt>
              <dd
                class={`font-medium ${titleLength >= 30 && titleLength <= 60 ? "text-green-600" : "text-yellow-600"}`}
              >
                {titleLength} chars
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">Description Length</dt>
              <dd
                class={`font-medium ${descLength >= 120 && descLength <= 160 ? "text-green-600" : "text-yellow-600"}`}
              >
                {descLength} chars
              </dd>
            </div>
            {readabilityScore !== null && (
              <div class="flex justify-between">
                <dt class="text-gray-500">Readability</dt>
                <dd class={`font-medium ${gradeColor(readabilityScore)}`}>
                  {readabilityScore}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-4 text-sm font-semibold text-gray-500">
            Heading Structure
          </h3>
          {headings.length === 0 ? (
            <p class="text-sm text-gray-400">No headings found.</p>
          ) : (
            <div class="space-y-1 text-sm">
              {headings.slice(0, 15).map((h) => (
                <div
                  class="flex items-baseline gap-2"
                  style={`padding-left: ${(parseInt(h.tag.replace("h", "")) - 1) * 16}px`}
                >
                  <span class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500">
                    {h.tag}
                  </span>
                  <span class="truncate">{h.text}</span>
                </div>
              ))}
              {headings.length > 15 && (
                <p class="text-xs text-gray-400">
                  ...and {headings.length - 15} more
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
  );
});

// ─── Page issues tab ──────────────────────────────────
pageDetailAppRoutes.get("/projects/:id/pages/:pageId/tab/issues", async (c) => {
  const db = c.get("db");
  const pageId = c.req.param("pageId");
  const { issues } = await scoreQueries(db).getByPageWithIssues(pageId);

  if (issues.length === 0) {
    return c.html(
      <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
        <p class="text-sm text-gray-500">No issues found for this page.</p>
      </div>,
    );
  }

  return c.html(
    <div class="space-y-3">
      {issues.map((issue) => (
        <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
          <div class="flex items-center gap-2">
            <span
              class={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[issue.severity] ?? "bg-gray-100 text-gray-700"}`}
            >
              {issue.severity}
            </span>
            <span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {CATEGORY_LABELS[issue.category] ?? issue.category}
            </span>
            <code class="text-xs text-gray-400">{issue.code}</code>
          </div>
          <p class="mt-2 text-sm font-medium">{issue.message}</p>
          {issue.recommendation && (
            <p class="mt-1 text-xs text-gray-500">{issue.recommendation}</p>
          )}
        </div>
      ))}
    </div>,
  );
});

// ─── Page performance tab ─────────────────────────────
pageDetailAppRoutes.get("/projects/:id/pages/:pageId/tab/performance", async (c) => {
  const db = c.get("db");
  const pageId = c.req.param("pageId");
  const { score } = await scoreQueries(db).getByPageWithIssues(pageId);
  if (!score) return c.text("Not found", 404);

  const detail = (score.detail ?? {}) as Record<string, unknown>;
  const lighthouse = (detail.lighthouse ?? {}) as Record<string, number>;
  const metrics = [
    ["Performance", score.lighthousePerf],
    ["SEO", score.lighthouseSeo],
    ["FCP (ms)", lighthouse.fcp],
    ["LCP (ms)", lighthouse.lcp],
    ["TBT (ms)", lighthouse.tbt],
    ["CLS", lighthouse.cls],
    ["TTI (ms)", lighthouse.tti],
  ];

  return c.html(
    <div class="space-y-6">
      <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-2 text-sm font-semibold text-gray-500">
          Performance Score: {score.lighthousePerf ?? "—"}/100
        </h3>
        <div class="mt-1 h-2 w-full rounded-full bg-gray-200">
          <div
            class={`h-2 rounded-full transition-all duration-700 ${(score.lighthousePerf ?? 0) >= 80 ? "bg-green-500" : (score.lighthousePerf ?? 0) >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
            style="width: 0%"
            data-score-bar={Math.min(score.lighthousePerf ?? 0, 100)}
          ></div>
        </div>
      </div>
      <script src="/app/static/charts.js"></script>

      <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-4 text-sm font-semibold text-gray-500">
          Lighthouse Metrics
        </h3>
        <div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {metrics.map(([label, val]) => (
            <div class="rounded border p-3 text-center">
              <p class="text-2xl font-bold">
                {val !== null && val !== undefined
                  ? typeof val === "number" && val < 1
                    ? val.toFixed(3)
                    : Math.round(val as number)
                  : "—"}
              </p>
              <p class="text-xs text-gray-500">{label as string}</p>
            </div>
          ))}
        </div>
      </div>
    </div>,
  );
});

// Legacy admin routes extracted into ./app/admin


