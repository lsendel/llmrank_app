/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { Layout, PageHeader } from "../../views/layout";
import { crawlQueries, projectQueries, scoreQueries, userQueries } from "@llm-boost/db";
import { Breadcrumb, SkeletonCard } from "../../views/htmx-helpers";
import { gradeColor } from "./workspace-shared";

export const crawlDetailAppRoutes = new Hono<AppEnv>();
// =====================================================================
// Crawl Detail Page (Live Progress)
// =====================================================================

crawlDetailAppRoutes.get("/crawl/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const user = await userQueries(db).getById(userId);
  if (!user) return c.redirect("/sign-in");

  const crawlId = c.req.param("id");
  const job = await crawlQueries(db).getById(crawlId);
  if (!job) return c.text("Crawl not found", 404);

  const project = await projectQueries(db).getById(job.projectId);
  if (!project || project.userId !== userId) return c.text("Not found", 404);

  const content = (
    <div>
      <Breadcrumb
        items={[
          { label: "Projects", href: "/app/projects" },
          { label: project.name, href: `/app/projects/${project.id}` },
          { label: "Crawl" },
        ]}
      />
      <PageHeader
        title={`Crawl — ${project.domain}`}
        description={`Started ${job.startedAt ? new Date(job.startedAt).toLocaleString() : new Date(job.createdAt).toLocaleString()}`}
      />
      <div
        id="crawl-progress"
        hx-get={`/app/crawl/${crawlId}/progress`}
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <SkeletonCard />
      </div>
    </div>
  );

  if (c.get("isHtmx")) return c.html(content);

  return c.html(
    <Layout title="Crawl" user={{ email: user.email ?? "", plan: user.plan }}>
      {content}
    </Layout>,
  );
});

// ─── Crawl progress partial (polls during active crawl) ──
crawlDetailAppRoutes.get("/crawl/:id/progress", async (c) => {
  const db = c.get("db");
  const crawlId = c.req.param("id");
  const job = await crawlQueries(db).getById(crawlId);
  if (!job) return c.text("Not found", 404);

  const isActive = ["pending", "queued", "crawling", "scoring"].includes(
    job.status,
  );
  const pct =
    job.pagesFound && job.pagesFound > 0
      ? Math.round(((job.pagesCrawled ?? 0) / job.pagesFound) * 100)
      : 0;

  if (isActive) {
    const PHASES = [
      "pending",
      "queued",
      "crawling",
      "scoring",
      "complete",
    ] as const;
    const currentIdx = PHASES.indexOf(job.status as (typeof PHASES)[number]);

    // Still running — return with hx-trigger to continue polling
    return c.html(
      <div
        hx-get={`/app/crawl/${crawlId}/progress`}
        hx-trigger="every 3s"
        hx-swap="outerHTML"
      >
        <div class="space-y-6 rounded-lg border bg-white p-6 dark:bg-gray-900">
          {/* Phase stepper */}
          <div class="flex items-center justify-between">
            {PHASES.map((phase, i) => {
              const isDone = i < currentIdx;
              const isCurrentPhase = i === currentIdx;
              return (
                <div class="flex flex-1 items-center">
                  <div class="flex flex-col items-center gap-1">
                    <div
                      class={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        isDone
                          ? "bg-green-500 text-white"
                          : isCurrentPhase
                            ? "animate-pulse bg-blue-500 text-white"
                            : "bg-gray-200 text-gray-400 dark:bg-gray-700"
                      }`}
                    >
                      {isDone ? (
                        <svg
                          class="h-4 w-4"
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
                        i + 1
                      )}
                    </div>
                    <span
                      class={`text-xs capitalize ${
                        isDone
                          ? "font-medium text-green-600"
                          : isCurrentPhase
                            ? "font-semibold text-blue-600"
                            : "text-gray-400"
                      }`}
                    >
                      {phase}
                    </span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <div class="mx-2 h-0.5 flex-1">
                      <div
                        class={`h-full rounded ${isDone ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"}`}
                      ></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div class="h-3 w-full rounded-full bg-gray-200">
            <div
              class="h-3 rounded-full bg-blue-500 transition-all"
              style={`width: ${pct}%`}
            ></div>
          </div>

          {/* Counters */}
          <div class="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p class="text-2xl font-bold">{job.pagesFound ?? 0}</p>
              <p class="text-xs text-gray-500">Found</p>
            </div>
            <div>
              <p class="text-2xl font-bold">{job.pagesCrawled ?? 0}</p>
              <p class="text-xs text-gray-500">Crawled</p>
            </div>
            <div>
              <p class="text-2xl font-bold">{job.pagesScored ?? 0}</p>
              <p class="text-xs text-gray-500">Scored</p>
            </div>
          </div>
        </div>
      </div>,
    );
  }

  // Completed or failed — no more polling
  if (job.status === "failed") {
    return c.html(
      <div class="space-y-4 rounded-lg border border-red-200 bg-white p-6 dark:bg-gray-900">
        <div class="flex items-center gap-3">
          <span class="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            Failed
          </span>
        </div>
        {job.errorMessage && (
          <p class="text-sm text-red-600">{job.errorMessage}</p>
        )}
        <a
          href={`/app/projects/${job.projectId}`}
          class="inline-block text-sm text-blue-600 hover:underline"
        >
          Back to project
        </a>
      </div>,
    );
  }

  // Complete — show score summary
  const scores = await scoreQueries(db).listByJob(crawlId);
  const avgScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length,
        )
      : null;

  const avgOf = (arr: (number | null)[]) => {
    const valid = arr.filter((n): n is number => n !== null);
    return valid.length > 0
      ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
      : null;
  };

  const technical = avgOf(scores.map((s) => s.technicalScore));
  const contentScore = avgOf(scores.map((s) => s.contentScore));
  const aiReadiness = avgOf(scores.map((s) => s.aiReadinessScore));
  const perfScore = avgOf(scores.map((s) => s.lighthousePerf));

  const issueCount = (await scoreQueries(db).getIssuesByJob(crawlId)).length;

  return c.html(
    <div class="space-y-6">
      {/* Success banner */}
      <div class="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950">
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white">
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-green-800 dark:text-green-200">
              Crawl Complete
            </h3>
            <p class="text-sm text-green-600 dark:text-green-400">
              {scores.length} page{scores.length !== 1 ? "s" : ""} analyzed and
              scored
            </p>
          </div>
        </div>
      </div>

      {avgScore !== null && (
        <div class="grid gap-6 sm:grid-cols-5">
          <div class="flex flex-col items-center rounded-lg border bg-white p-4 dark:bg-gray-900">
            <span
              class={`text-3xl font-bold ${gradeColor(avgScore)}`}
              data-count-up={avgScore}
            >
              {avgScore}
            </span>
            <span class="mt-1 text-xs text-gray-500">Overall</span>
          </div>
          {(
            [
              ["Technical", technical],
              ["Content", contentScore],
              ["AI Ready", aiReadiness],
              ["Performance", perfScore],
            ] as [string, number | null][]
          ).map(([label, score]) => (
            <div class="flex flex-col items-center rounded-lg border bg-white p-4 dark:bg-gray-900">
              <span
                class={`text-3xl font-bold ${gradeColor(score ?? 0)}`}
                data-count-up={score ?? undefined}
              >
                {score ?? "—"}
              </span>
              <span class="mt-1 text-xs text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-4 text-sm font-semibold text-gray-500">
          Category Breakdown
        </h3>
        <div
          class="h-48"
          data-chart-type="category-breakdown"
          data-chart-data={JSON.stringify({
            technical: technical ?? 0,
            content: contentScore ?? 0,
            aiReadiness: aiReadiness ?? 0,
            performance: perfScore ?? 0,
          })}
        ></div>
      </div>

      {job.summary && (
        <div class="rounded-lg border bg-white p-6 dark:bg-gray-900">
          <h3 class="mb-2 text-sm font-semibold text-gray-500">
            Executive Summary
          </h3>
          <p class="text-sm leading-relaxed text-gray-700">{job.summary}</p>
        </div>
      )}

      <div class="flex gap-3">
        <a
          href={`/app/projects/${job.projectId}`}
          class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:scale-95 transition-transform"
        >
          View Full Project
        </a>
        <a
          href={`/app/projects/${job.projectId}?tab=issues`}
          class="rounded border-2 border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 active:scale-95 transition-transform"
        >
          Review Issues{issueCount > 0 ? ` (${issueCount})` : ""}
        </a>
      </div>
      <script src="/app/static/charts.js"></script>
    </div>,
  );
});



