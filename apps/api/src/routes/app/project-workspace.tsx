/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { Layout, PageHeader } from "../../views/layout";
import { crawlDetailAppRoutes } from "./crawl-detail";
import { workspaceSecondaryTabRoutes } from "./workspace-secondary-tabs";
import { workspaceChartRoutes } from "./workspace-charts";
import {
  userQueries,
  scoreQueries,
  crawlQueries,
  projectQueries,
  competitorBenchmarkQueries,
} from "@llm-boost/db";
import { Breadcrumb, SkeletonTable, SkeletonText } from "../../views/htmx-helpers";
import { gradeBadgeColor, gradeColor, gradeLabel, SEVERITY_COLORS } from "./workspace-shared";

export const projectWorkspaceAppRoutes = new Hono<AppEnv>();
projectWorkspaceAppRoutes.route("/", crawlDetailAppRoutes);
projectWorkspaceAppRoutes.route("/", workspaceSecondaryTabRoutes);
projectWorkspaceAppRoutes.route("/", workspaceChartRoutes);
// =====================================================================
// Project Detail Page (Tab Container)
// =====================================================================

const PROJECT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "pages", label: "Pages" },
  { key: "issues", label: "Issues" },
  { key: "competitors", label: "Competitors" },
  { key: "visibility", label: "Visibility" },
  { key: "history", label: "History" },
  { key: "settings", label: "Settings" },
] as const;

type ProjectTab = (typeof PROJECT_TABS)[number]["key"];

function ProjectTabNav({
  projectId,
  active,
}: {
  projectId: string;
  active: ProjectTab;
}) {
  return (
    <div class="mb-6 flex gap-1 overflow-x-auto border-b" role="tablist">
      {PROJECT_TABS.map((t) => (
        <button
          hx-get={`/app/projects/${projectId}/tab/${t.key}`}
          hx-target="#tab-content"
          hx-push-url={`/app/projects/${projectId}?tab=${t.key}`}
          class={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
            t.key === active
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          role="tab"
        >
          <span class="tab-label">{t.label}</span>
          <span class="tab-spinner h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></span>
        </button>
      ))}
    </div>
  );
}

projectWorkspaceAppRoutes.get("/projects/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const projectId = c.req.param("id");
  if (projectId === "new") return c.redirect("/app/projects/new");

  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.text("Not found", 404);
  }

  const rawTab = c.req.query("tab") ?? "overview";
  const tab = PROJECT_TABS.find((t) => t.key === rawTab)
    ? (rawTab as ProjectTab)
    : "overview";

  const content = (
    <div>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/app/projects" },
          { label: project.name },
        ]}
      />
      <PageHeader
        title={project.name}
        description={project.domain}
        actions={
          <button
            hx-post={`/api/projects/${projectId}/crawls`}
            hx-disabled-elt="this"
            class="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span class="tab-spinner h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
            Run Crawl
          </button>
        }
      />
      <ProjectTabNav projectId={projectId} active={tab} />
      <div
        id="tab-content"
        hx-get={`/app/projects/${projectId}/tab/${tab}`}
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <SkeletonText lines={6} />
      </div>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout
      title={project.name}
      user={{ email: user.email ?? "", plan: user.plan }}
    >
      {content}
    </Layout>,
  );
});

// ─── Overview tab ─────────────────────────────────────
projectWorkspaceAppRoutes.get("/projects/:id/tab/overview", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");
  const project = await projectQueries(db).getById(projectId);
  if (!project) return c.text("Not found", 404);

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);

  if (!latestCrawl || latestCrawl.status !== "complete") {
    return c.html(
      <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
        <p class="text-gray-500">
          {latestCrawl
            ? `Crawl in progress (${latestCrawl.status})...`
            : "No crawls yet. Run a crawl to see your scores."}
        </p>
        {latestCrawl && (
          <a
            href={`/app/crawl/${latestCrawl.id}`}
            class="mt-2 inline-block text-sm text-blue-600 hover:underline"
          >
            View crawl progress
          </a>
        )}
      </div>,
    );
  }

  const scores = await scoreQueries(db).listByJob(latestCrawl.id);
  const issuesByJob = await scoreQueries(db).getIssuesByJob(latestCrawl.id);

  const avgOf = (arr: (number | null)[]) => {
    const valid = arr.filter((n): n is number => n !== null);
    return valid.length > 0
      ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
      : null;
  };

  const overall = avgOf(scores.map((s) => s.overallScore));
  const technical = avgOf(scores.map((s) => s.technicalScore));
  const contentScore = avgOf(scores.map((s) => s.contentScore));
  const aiReadiness = avgOf(scores.map((s) => s.aiReadinessScore));
  const perfScore = avgOf(scores.map((s) => s.lighthousePerf));

  const issueBySeverity = { critical: 0, warning: 0, info: 0 };
  for (const issue of issuesByJob) {
    if (issue.severity in issueBySeverity) {
      issueBySeverity[issue.severity as keyof typeof issueBySeverity]++;
    }
  }

  const topIssues = issuesByJob
    .filter((i) => i.severity === "critical" || i.severity === "warning")
    .slice(0, 5);

  // Compute grade distribution from current scores
  const gradeBuckets = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const s of scores) {
    const sc = s.overallScore;
    if (sc >= 90) gradeBuckets.A++;
    else if (sc >= 80) gradeBuckets.B++;
    else if (sc >= 70) gradeBuckets.C++;
    else if (sc >= 60) gradeBuckets.D++;
    else gradeBuckets.F++;
  }

  // Category breakdown data for chart
  const categoryData = {
    technical: technical ?? 0,
    content: contentScore ?? 0,
    aiReadiness: aiReadiness ?? 0,
    performance: perfScore ?? 0,
  };

  // Fetch score trend data from completed crawls
  const completedCrawls = await crawlQueries(db).listCompletedByProject(
    projectId,
    10,
  );
  const trendData: {
    labels: string[];
    scores: number[];
    technical: number[];
    content: number[];
    aiReadiness: number[];
    performance: number[];
  } = {
    labels: [],
    scores: [],
    technical: [],
    content: [],
    aiReadiness: [],
    performance: [],
  };
  for (const cr of completedCrawls.reverse()) {
    const crScores = await scoreQueries(db).listByJob(cr.id);
    if (crScores.length > 0) {
      const avg = Math.round(
        crScores.reduce((sum, s) => sum + s.overallScore, 0) / crScores.length,
      );
      trendData.labels.push(
        new Date(cr.completedAt ?? cr.createdAt).toLocaleDateString(),
      );
      trendData.scores.push(avg);
      trendData.technical.push(
        avgOf(crScores.map((s) => s.technicalScore)) ?? 0,
      );
      trendData.content.push(avgOf(crScores.map((s) => s.contentScore)) ?? 0);
      trendData.aiReadiness.push(
        avgOf(crScores.map((s) => s.aiReadinessScore)) ?? 0,
      );
      trendData.performance.push(
        avgOf(crScores.map((s) => s.lighthousePerf)) ?? 0,
      );
    }
  }

  return c.html(
    <div class="space-y-6">
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="flex flex-col items-center justify-center rounded-lg border bg-white p-6 dark:bg-gray-900">
          <span
            class={`text-5xl font-bold ${gradeColor(overall ?? 0)}`}
            data-count-up={overall ?? undefined}
          >
            {overall ?? "—"}
          </span>
          <span
            class={`mt-2 rounded px-3 py-1 text-sm font-medium ${gradeBadgeColor(overall ?? 0)}`}
          >
            {overall !== null ? gradeLabel(overall) : "N/A"}
          </span>
          <p class="mt-2 text-xs text-gray-500">Overall Score</p>
          <p class="text-xs text-gray-400">
            {scores.length} pages &middot;{" "}
            {latestCrawl.completedAt
              ? new Date(latestCrawl.completedAt).toLocaleDateString()
              : ""}
          </p>
        </div>

        <div class="col-span-2 rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-4 text-sm font-semibold text-gray-500">
            Category Breakdown
          </h3>
          <div
            class="h-48"
            data-chart-type="category-breakdown"
            data-chart-data={JSON.stringify(categoryData)}
          ></div>
        </div>
      </div>

      {latestCrawl.summary && (
        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-2 text-sm font-semibold text-gray-500">
            Executive Summary
          </h3>
          <p class="text-sm leading-relaxed text-gray-700">
            {latestCrawl.summary}
          </p>
        </div>
      )}

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-4 text-sm font-semibold text-gray-500">
            Issue Distribution
          </h3>
          <div class="flex gap-4">
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full bg-red-500"></span>
              <span class="text-sm">Critical: {issueBySeverity.critical}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full bg-yellow-500"></span>
              <span class="text-sm">Warning: {issueBySeverity.warning}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="h-3 w-3 rounded-full bg-blue-500"></span>
              <span class="text-sm">Info: {issueBySeverity.info}</span>
            </div>
          </div>
          <div
            id="issue-dist-chart"
            class="mt-4 h-48"
            data-chart-type="issue-distribution"
            data-chart-data={JSON.stringify(issueBySeverity)}
          ></div>
        </div>

        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-4 text-sm font-semibold text-gray-500">
            Grade Distribution
          </h3>
          <div
            id="grade-dist-chart"
            class="h-48"
            data-chart-data={JSON.stringify(gradeBuckets)}
          ></div>
        </div>

        <div class="col-span-2 rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-4 text-sm font-semibold text-gray-500">Score Trend</h3>
          {trendData.scores.length >= 2 ? (
            <div
              id="score-trend-chart"
              class="h-48"
              data-chart-data={JSON.stringify(trendData)}
            >
              <canvas id="score-trend-canvas"></canvas>
            </div>
          ) : (
            <p class="flex h-48 items-center justify-center text-xs text-gray-400">
              Score trend requires at least 2 completed crawls
            </p>
          )}
        </div>
      </div>

      {topIssues.length > 0 && (
        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-4 text-sm font-semibold text-gray-500">
            Top Issues ({issuesByJob.length} total)
          </h3>
          <div class="space-y-3">
            {topIssues.map((issue) => (
              <div class="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                <span
                  class={`mt-0.5 rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[issue.severity] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {issue.severity}
                </span>
                <div class="flex-1">
                  <p class="text-sm">{issue.message}</p>
                  {issue.pageUrl && (
                    <p class="mt-0.5 text-xs text-gray-400">{issue.pageUrl}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <a
            href={`/app/projects/${projectId}/issues`}
            class="mt-3 inline-block text-sm text-blue-600 hover:underline"
          >
            View all issues
          </a>
        </div>
      )}
      {/* Chart init — loaded after DOM renders */}
      <script src="/app/static/charts.js"></script>
    </div>,
  );
});

// ─── Pages tab ────────────────────────────────────────
projectWorkspaceAppRoutes.get("/projects/:id/tab/pages", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");
  const sort = c.req.query("sort") ?? "score";
  const dir = c.req.query("dir") ?? "asc";

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  if (!latestCrawl || latestCrawl.status !== "complete") {
    return c.html(
      <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
        <p class="text-sm text-gray-500">No completed crawl data yet.</p>
      </div>,
    );
  }

  const pagesWithScores = await scoreQueries(db).listByJobWithPages(
    latestCrawl.id,
  );

  const sorted = [...pagesWithScores].sort((a, b) => {
    let cmp = 0;
    if (sort === "score") cmp = a.overallScore - b.overallScore;
    else if (sort === "issues") cmp = a.issueCount - b.issueCount;
    else if (sort === "url")
      cmp = (a.page?.url ?? "").localeCompare(b.page?.url ?? "");
    else if (sort === "status")
      cmp = (a.page?.statusCode ?? 0) - (b.page?.statusCode ?? 0);
    return dir === "desc" ? -cmp : cmp;
  });

  const nextDir = dir === "asc" ? "desc" : "asc";
  const sortLink = (col: string) =>
    `/app/projects/${projectId}/tab/pages?sort=${col}&dir=${sort === col ? nextDir : "asc"}`;
  const sortIcon = (col: string) =>
    sort === col ? (dir === "asc" ? " ^" : " v") : "";

  return c.html(
    <div class="overflow-x-auto rounded-lg border bg-white dark:bg-gray-900">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-left text-gray-500">
            <th class="px-4 py-3 font-medium">
              <button
                hx-get={sortLink("url")}
                hx-target="#tab-content"
                hx-swap="innerHTML"
                class="hover:text-gray-800"
              >
                URL{sortIcon("url")}
              </button>
            </th>
            <th class="px-4 py-3 font-medium">
              <button
                hx-get={sortLink("status")}
                hx-target="#tab-content"
                hx-swap="innerHTML"
                class="hover:text-gray-800"
              >
                Status{sortIcon("status")}
              </button>
            </th>
            <th class="px-4 py-3 font-medium">Title</th>
            <th class="px-4 py-3 font-medium">
              <button
                hx-get={sortLink("score")}
                hx-target="#tab-content"
                hx-swap="innerHTML"
                class="hover:text-gray-800"
              >
                Score{sortIcon("score")}
              </button>
            </th>
            <th class="px-4 py-3 font-medium">
              <button
                hx-get={sortLink("issues")}
                hx-target="#tab-content"
                hx-swap="innerHTML"
                class="hover:text-gray-800"
              >
                Issues{sortIcon("issues")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr class="border-b last:border-0 hover:bg-gray-50">
              <td class="max-w-xs truncate px-4 py-3 font-mono text-xs">
                {row.page?.url ?? "—"}
              </td>
              <td class="px-4 py-3">
                <span
                  class={`rounded px-2 py-0.5 text-xs font-medium ${
                    (row.page?.statusCode ?? 0) < 300
                      ? "bg-green-100 text-green-700"
                      : (row.page?.statusCode ?? 0) < 400
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {row.page?.statusCode ?? "—"}
                </span>
              </td>
              <td class="max-w-xs truncate px-4 py-3 text-gray-700">
                {row.page?.title ?? "—"}
              </td>
              <td class="px-4 py-3">
                <span class={`font-bold ${gradeColor(row.overallScore)}`}>
                  {row.overallScore}
                </span>
              </td>
              <td class="px-4 py-3">
                {row.issueCount > 0 ? (
                  <span class="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                    {row.issueCount}
                  </span>
                ) : (
                  <span class="text-xs text-gray-400">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p class="py-8 text-center text-sm text-gray-500">No pages found.</p>
      )}
    </div>,
  );
});

// ─── Issues tab (delegates to existing issues partial) ──
projectWorkspaceAppRoutes.get("/projects/:id/tab/issues", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  if (!latestCrawl) {
    return c.html(
      <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
        <p class="text-sm text-gray-500">
          No crawls found. Run a crawl to discover issues.
        </p>
      </div>,
    );
  }

  return c.html(
    <div
      id="issue-list"
      hx-get={`/app/projects/${projectId}/issues/list?jobId=${latestCrawl.id}`}
      hx-trigger="load"
      hx-swap="innerHTML"
    >
      <SkeletonTable rows={4} />
    </div>,
  );
});

// ─── Competitors tab ──────────────────────────────────
projectWorkspaceAppRoutes.get("/projects/:id/tab/competitors", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");

  const project = await projectQueries(db).getById(projectId);
  if (!project) return c.text("Not found", 404);

  const benchmarks =
    await competitorBenchmarkQueries(db).listByProject(projectId);

  const latestCrawl = await crawlQueries(db).getLatestByProject(projectId);
  let projScores = {
    overall: 0,
    technical: 0,
    content: 0,
    aiReadiness: 0,
    performance: 0,
  };
  if (latestCrawl?.status === "complete") {
    const scores = await scoreQueries(db).listByJob(latestCrawl.id);
    const avg = (arr: (number | null)[]) => {
      const v = arr.filter((n): n is number => n !== null);
      return v.length > 0
        ? Math.round(v.reduce((a, b) => a + b, 0) / v.length)
        : 0;
    };
    projScores = {
      overall: avg(scores.map((s) => s.overallScore)),
      technical: avg(scores.map((s) => s.technicalScore)),
      content: avg(scores.map((s) => s.contentScore)),
      aiReadiness: avg(scores.map((s) => s.aiReadinessScore)),
      performance: avg(scores.map((s) => s.lighthousePerf)),
    };
  }

  const byDomain = new Map<string, (typeof benchmarks)[number]>();
  for (const b of benchmarks) {
    if (!byDomain.has(b.competitorDomain)) {
      byDomain.set(b.competitorDomain, b);
    }
  }

  return c.html(
    <div class="space-y-6">
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-4 text-sm font-semibold text-gray-500">
          Benchmark Competitor
        </h3>
        <form
          hx-post={`/api/projects/${projectId}/competitors/benchmark`}
          hx-target="#competitor-list"
          hx-swap="beforeend"
          class="flex gap-2"
        >
          <input
            type="text"
            name="domain"
            placeholder="competitor.com"
            required
            class="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:scale-95 transition-transform"
          >
            Benchmark
          </button>
        </form>
      </section>

      <div id="competitor-list" class="space-y-4">
        {byDomain.size === 0 ? (
          <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
            <p class="text-sm text-gray-500">
              No competitor benchmarks yet. Add a competitor domain above.
            </p>
          </div>
        ) : (
          Array.from(byDomain.entries()).map(([domain, b]) => {
            const delta = (b.overallScore ?? 0) - projScores.overall;
            const deltaLabel =
              delta > 0 ? "They lead" : delta < 0 ? "You lead" : "Tied";
            const deltaColor =
              delta > 0
                ? "bg-red-100 text-red-700"
                : delta < 0
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700";

            return (
              <div class="rounded-lg border bg-white p-5 dark:bg-gray-900">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="font-semibold">{domain}</h4>
                    <p class="text-xs text-gray-500">
                      Benchmarked{" "}
                      {b.crawledAt
                        ? new Date(b.crawledAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <span
                    class={`rounded px-2 py-0.5 text-xs font-medium ${deltaColor}`}
                  >
                    {deltaLabel}
                  </span>
                </div>
                <div class="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
                  {(
                    [
                      ["Overall", projScores.overall, b.overallScore],
                      ["Technical", projScores.technical, b.technicalScore],
                      ["Content", projScores.content, b.contentScore],
                      ["AI Ready", projScores.aiReadiness, b.aiReadinessScore],
                      ["Perf", projScores.performance, b.performanceScore],
                    ] as [string, number, number | null][]
                  ).map(([label, yours, theirs]) => {
                    const d = (theirs ?? 0) - yours;
                    return (
                      <div>
                        <p class="text-gray-500">{label}</p>
                        <p class="font-bold">
                          {yours} vs {theirs ?? "—"}
                        </p>
                        {d !== 0 && (
                          <p
                            class={`text-xs ${d > 0 ? "text-red-500" : "text-green-500"}`}
                          >
                            {d > 0 ? "+" : ""}
                            {d}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>,
  );
});

// Legacy crawl detail routes extracted into ./crawl-detail





