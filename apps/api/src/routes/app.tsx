/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../index";
import { authMiddleware } from "../middleware/auth";
import { htmxMiddleware } from "../middleware/htmx";
import { settingsTeamAppRoutes } from "./app/settings-team";
import { adminAppRoutes } from "./app/admin";
import { projectWorkspaceAppRoutes } from "./app/project-workspace";
import { pageDetailAppRoutes } from "./app/page-detail";
import { Layout, PageHeader } from "../views/layout";
import {
  userQueries,
  scoreQueries,
  crawlQueries,
  projectQueries,
} from "@llm-boost/db";
import {
  SkeletonCard,
  SkeletonTable,
  Breadcrumb,
} from "../views/htmx-helpers";

export const appRoutes = new Hono<AppEnv>();

appRoutes.use("*", authMiddleware);
appRoutes.use("*", htmxMiddleware);
appRoutes.route("/", settingsTeamAppRoutes);
appRoutes.route("/", adminAppRoutes);
appRoutes.route("/", projectWorkspaceAppRoutes);
appRoutes.route("/", pageDetailAppRoutes);

// Legacy settings/team routes extracted into ./app/settings-team

// =====================================================================
// New Project Page
// =====================================================================

appRoutes.get("/projects/new", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const content = (
    <div class="mx-auto max-w-lg">
      <PageHeader
        title="New Project"
        description="Add a website to audit for AI-readiness."
      />
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <form
          hx-post="/api/projects"
          hx-target="#form-error"
          hx-swap="innerHTML"
          class="space-y-5"
        >
          <div id="form-error"></div>

          <div>
            <label class="mb-1 block text-sm font-medium" for="name">
              Project Name
            </label>
            <input
              type="text"
              name="name"
              id="name"
              placeholder="My Website"
              required
              maxlength={100}
              class="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium" for="domain">
              Domain
            </label>
            <input
              type="text"
              name="domain"
              id="domain"
              placeholder="example.com"
              required
              class="w-full rounded border px-3 py-2 text-sm"
            />
            <p class="mt-1 text-xs text-gray-500">
              Enter the root domain to audit. https:// will be added
              automatically if omitted.
            </p>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button
              type="submit"
              class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:scale-95 transition-transform"
            >
              Create Project
            </button>
            <a
              href="/app/projects"
              class="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </a>
          </div>
        </form>
      </section>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout
      title="New Project"
      user={{ email: user.email ?? "", plan: user.plan }}
    >
      {content}
    </Layout>,
  );
});

// =====================================================================
// Projects List (Dashboard Home)
// =====================================================================

function gradeColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 80) return "text-lime-600";
  if (score >= 70) return "text-yellow-600";
  if (score >= 60) return "text-orange-600";
  return "text-red-600";
}

function gradeLabel(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function gradeBadgeColor(score: number): string {
  if (score >= 90) return "bg-green-100 text-green-700";
  if (score >= 80) return "bg-lime-100 text-lime-700";
  if (score >= 70) return "bg-yellow-100 text-yellow-700";
  if (score >= 60) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700";
}

appRoutes.get("/", (c) => c.redirect("/app/projects"));

appRoutes.get("/projects", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const content = (
    <div>
      <PageHeader
        title="Projects"
        description="Manage your website projects and view their AI-readiness scores."
        actions={
          <a
            href="/app/projects/new"
            class="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:scale-95 transition-transform"
          >
            + New Project
          </a>
        }
      />
      <div
        id="project-list"
        hx-get="/app/projects/cards"
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout
      title="Projects"
      user={{ email: user.email ?? "", plan: user.plan }}
    >
      {content}
    </Layout>,
  );
});

appRoutes.get("/projects/cards", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const allProjects = await projectQueries(db).listByUser(userId);

  // Batch-fetch latest crawl + score data per project
  const recentCrawls = await crawlQueries(db).getRecentForUser(userId);

  // Map: projectId → latest completed crawl with score
  const latestByProject = new Map<
    string,
    {
      overallScore: number | null;
      letterGrade: string | null;
      pagesCrawled: number | null;
      pagesScored: number | null;
      completedAt: Date | null;
    }
  >();
  for (const crawl of recentCrawls) {
    if (crawl.status !== "complete") continue;
    if (latestByProject.has(crawl.projectId)) continue; // already have latest
    latestByProject.set(crawl.projectId, {
      overallScore: crawl.overallScore,
      letterGrade: crawl.letterGrade,
      pagesCrawled: crawl.pagesCrawled,
      pagesScored: crawl.pagesScored,
      completedAt: crawl.completedAt,
    });
  }

  if (allProjects.length === 0) {
    return c.html(
      <div class="rounded-lg border-2 border-dashed bg-white p-16 text-center dark:bg-gray-900">
        <p class="text-sm text-gray-500">No projects yet.</p>
        <a
          href="/app/projects/new"
          class="mt-4 inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Create your first project
        </a>
      </div>,
    );
  }

  return c.html(
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {allProjects.map((project) => {
        const crawl = latestByProject.get(project.id);
        const score = crawl?.overallScore ?? null;

        return (
          <a
            href={`/app/projects/${project.id}`}
            class="group block rounded-lg border bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900"
          >
            <div class="flex items-start justify-between">
              <div>
                <h3 class="font-semibold group-hover:text-blue-600">
                  {project.name}
                </h3>
                <p class="mt-0.5 text-sm text-gray-500">{project.domain}</p>
              </div>
              {score !== null ? (
                <div class="flex flex-col items-end gap-1">
                  <span class={`text-2xl font-bold ${gradeColor(score)}`}>
                    {score}
                  </span>
                  <span
                    class={`rounded px-2 py-0.5 text-xs font-medium ${gradeBadgeColor(score)}`}
                  >
                    {gradeLabel(score)}
                  </span>
                </div>
              ) : (
                <span class="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  No crawls yet
                </span>
              )}
            </div>

            <div class="mt-4 flex gap-4 text-xs text-gray-500">
              {crawl ? (
                <>
                  <span>
                    {crawl.pagesCrawled ?? crawl.pagesScored ?? 0} pages scanned
                  </span>
                  {crawl.completedAt && (
                    <span>
                      Last crawl:{" "}
                      {new Date(crawl.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </>
              ) : (
                <span>
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Quick actions */}
            <div class="mt-4 flex items-center justify-between border-t pt-3">
              <div class="flex items-center gap-1">
                <span
                  class="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                  title="Strategy"
                >
                  Strategy
                </span>
                <span
                  class="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                  title="Competitors"
                >
                  Competitors
                </span>
                <span
                  class="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                  title="Issues"
                >
                  Issues
                </span>
              </div>
              <button
                hx-delete={`/api/projects/${project.id}`}
                hx-target="closest a"
                hx-swap="outerHTML"
                hx-confirm={`Delete "${project.name}"? This will permanently remove all crawl data, scores, and reports. This action cannot be undone.`}
                class="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                onclick="event.preventDefault(); event.stopPropagation();"
              >
                Delete
              </button>
            </div>
          </a>
        );
      })}
    </div>,
  );
});

// =====================================================================
// Project Issues Page
// =====================================================================

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  info: "bg-blue-100 text-blue-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  ai_readiness: "AI Readiness",
  performance: "Performance",
  schema: "Schema",
  llm_visibility: "LLM Visibility",
};

appRoutes.get("/projects/:id/issues", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const projectId = c.req.param("id");
  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) {
    return c.text("Not found", 404);
  }

  // Get latest crawl for this project
  const crawls = await crawlQueries(db).listByProject(projectId, 1);
  const latestCrawl = crawls[0];

  const content = (
    <div>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/app/projects" },
          { label: project.name, href: `/app/projects/${projectId}` },
          { label: "Issues" },
        ]}
      />
      <PageHeader
        title={`Issues — ${project.domain}`}
        description="Issues found during the latest crawl"
      />
      {latestCrawl ? (
        <div
          id="issue-list"
          hx-get={`/app/projects/${projectId}/issues/list?jobId=${latestCrawl.id}`}
          hx-trigger="load"
          hx-swap="innerHTML"
        >
          <SkeletonTable rows={4} />
        </div>
      ) : (
        <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
          <p class="text-sm text-gray-500">
            No crawls found. Run a crawl to discover issues.
          </p>
        </div>
      )}
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout title="Issues" user={{ email: user.email ?? "", plan: user.plan }}>
      {content}
    </Layout>,
  );
});

// ─── Issues list partial (with server-side filtering) ──
appRoutes.get("/projects/:id/issues/list", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");
  const jobId = c.req.query("jobId");
  const severity = c.req.query("severity") ?? "all";
  const category = c.req.query("category") ?? "all";

  if (!jobId) return c.text("Missing jobId", 400);

  const allIssues = await scoreQueries(db).getIssuesByJob(jobId);

  const filtered = allIssues.filter((issue) => {
    if (severity !== "all" && issue.severity !== severity) return false;
    if (category !== "all" && issue.category !== category) return false;
    return true;
  });

  const severities = ["all", "critical", "warning", "info"];
  const categories = [
    "all",
    "technical",
    "content",
    "ai_readiness",
    "performance",
  ];

  return c.html(
    <div class="space-y-4">
      {/* Filters */}
      <div class="flex flex-wrap gap-4">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-500">Severity:</span>
          {severities.map((sev) => (
            <button
              hx-get={`/app/projects/${projectId}/issues/list?jobId=${jobId}&severity=${sev}&category=${category}`}
              hx-target="#issue-list"
              hx-swap="innerHTML"
              class={`rounded px-3 py-1 text-sm font-medium ${
                severity === sev
                  ? "bg-blue-600 text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {sev === "all"
                ? `All (${allIssues.length})`
                : `${sev.charAt(0).toUpperCase() + sev.slice(1)} (${allIssues.filter((i) => i.severity === sev).length})`}
            </button>
          ))}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-500">Category:</span>
          {categories.map((cat) => (
            <button
              hx-get={`/app/projects/${projectId}/issues/list?jobId=${jobId}&severity=${severity}&category=${cat}`}
              hx-target="#issue-list"
              hx-swap="innerHTML"
              class={`rounded px-3 py-1 text-sm font-medium ${
                category === cat
                  ? "bg-blue-600 text-white"
                  : "border bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {cat === "all" ? "All" : (CATEGORY_LABELS[cat] ?? cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Issue cards */}
      {filtered.length === 0 ? (
        <div class="rounded-lg border bg-white p-8 text-center dark:bg-gray-900">
          <p class="text-sm text-gray-500">
            {allIssues.length === 0
              ? "No issues found."
              : "No issues match the selected filters."}
          </p>
        </div>
      ) : (
        <div class="space-y-3">
          {filtered.map((issue) => (
            <div class="rounded-lg border bg-white p-4 dark:bg-gray-900">
              <div class="flex items-start justify-between">
                <div class="flex-1">
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
                  {issue.pageUrl && (
                    <p class="mt-1 text-xs text-gray-500">{issue.pageUrl}</p>
                  )}
                  {issue.recommendation && (
                    <p class="mt-1 text-xs text-gray-500">
                      {issue.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>,
  );
});

// Legacy project workspace routes extracted into ./app/project-workspace
// Legacy page detail routes extracted into ./app/page-detail

