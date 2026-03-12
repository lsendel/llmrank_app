/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import {
  crawlQueries,
  projectQueries,
  scoreQueries,
  visibilityQueries,
} from "@llm-boost/db";
import { gradeBadgeColor, gradeColor } from "./workspace-shared";

export const workspaceSecondaryTabRoutes = new Hono<AppEnv>();

workspaceSecondaryTabRoutes.get("/projects/:id/tab/visibility", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");

  const checks = await visibilityQueries(db).listByProject(projectId);
  const recent = checks.slice(0, 20);

  return c.html(
    <div class="space-y-6">
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-4 text-sm font-semibold text-gray-500">
          Manual Visibility Check
        </h3>
        <form
          hx-post={`/api/projects/${projectId}/visibility/check`}
          hx-target="#visibility-results"
          hx-swap="afterbegin"
          class="flex flex-wrap gap-2"
        >
          <input
            type="text"
            name="query"
            placeholder="Enter a search query..."
            required
            class="flex-1 rounded border px-3 py-2 text-sm"
          />
          <select name="provider" class="rounded border px-3 py-2 text-sm">
            <option value="chatgpt">ChatGPT</option>
            <option value="claude">Claude</option>
            <option value="perplexity">Perplexity</option>
            <option value="gemini">Gemini</option>
            <option value="copilot">Copilot</option>
          </select>
          <button
            type="submit"
            class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:scale-95 transition-transform"
          >
            Check
          </button>
        </form>
      </section>

      <section class="rounded-lg border bg-white dark:bg-gray-900">
        <div class="border-b px-6 py-4">
          <h3 class="text-sm font-semibold text-gray-500">
            Recent Checks ({checks.length})
          </h3>
        </div>
        <div id="visibility-results">
          {recent.length === 0 ? (
            <p class="px-6 py-8 text-center text-sm text-gray-500">
              No visibility checks yet. Run one above.
            </p>
          ) : (
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b text-left text-gray-500">
                  <th class="px-4 py-3 font-medium">Date</th>
                  <th class="px-4 py-3 font-medium">Query</th>
                  <th class="px-4 py-3 font-medium">Provider</th>
                  <th class="px-4 py-3 font-medium">Mentioned</th>
                  <th class="px-4 py-3 font-medium">Cited</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((check) => (
                  <tr class="border-b last:border-0">
                    <td class="px-4 py-3 text-gray-500">
                      {new Date(check.checkedAt).toLocaleDateString()}
                    </td>
                    <td class="max-w-xs truncate px-4 py-3">{check.query}</td>
                    <td class="px-4 py-3">
                      <span class="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {check.llmProvider}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class={`rounded px-2 py-0.5 text-xs font-medium ${
                          check.brandMentioned
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {check.brandMentioned ? "Yes" : "No"}
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class={`rounded px-2 py-0.5 text-xs font-medium ${
                          check.urlCited
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {check.urlCited ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>,
  );
});

workspaceSecondaryTabRoutes.get("/projects/:id/tab/history", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");

  const crawls = await crawlQueries(db).listByProject(projectId);
  const completedIds = crawls.filter((crawl) => crawl.status === "complete").map((crawl) => crawl.id);

  const scoreMap = new Map<string, number>();
  for (const id of completedIds) {
    const scores = await scoreQueries(db).listByJob(id);
    if (scores.length > 0) {
      const avg = Math.round(
        scores.reduce((sum, score) => sum + score.overallScore, 0) / scores.length,
      );
      scoreMap.set(id, avg);
    }
  }

  const statusBadge: Record<string, string> = {
    complete: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    crawling: "bg-blue-100 text-blue-700",
    scoring: "bg-purple-100 text-purple-700",
    pending: "bg-gray-100 text-gray-600",
    queued: "bg-yellow-100 text-yellow-700",
  };

  return c.html(
    <div class="overflow-x-auto rounded-lg border bg-white dark:bg-gray-900">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-left text-gray-500">
            <th class="px-4 py-3 font-medium">Date</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Pages</th>
            <th class="px-4 py-3 font-medium">Score</th>
            <th class="px-4 py-3 font-medium">Grade</th>
            <th class="px-4 py-3 text-right font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {crawls.map((crawl) => {
            const score = scoreMap.get(crawl.id) ?? null;
            let grade: string | null = null;
            if (score !== null) {
              if (score >= 90) grade = "A";
              else if (score >= 80) grade = "B";
              else if (score >= 70) grade = "C";
              else if (score >= 60) grade = "D";
              else grade = "F";
            }

            return (
              <tr class="border-b last:border-0 hover:bg-gray-50">
                <td class="px-4 py-3 text-gray-500">
                  {crawl.startedAt
                    ? new Date(crawl.startedAt).toLocaleDateString()
                    : new Date(crawl.createdAt).toLocaleDateString()}
                </td>
                <td class="px-4 py-3">
                  <span
                    class={`rounded px-2 py-0.5 text-xs font-medium ${statusBadge[crawl.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {crawl.status}
                  </span>
                </td>
                <td class="px-4 py-3">
                  {crawl.pagesCrawled ?? crawl.pagesScored ?? "—"}
                </td>
                <td class="px-4 py-3">
                  {score !== null ? (
                    <span class={`font-bold ${gradeColor(score)}`}>
                      {score}
                    </span>
                  ) : (
                    <span class="text-gray-400">—</span>
                  )}
                </td>
                <td class="px-4 py-3">
                  {grade ? (
                    <span
                      class={`rounded px-2 py-0.5 text-xs font-medium ${gradeBadgeColor(score ?? 0)}`}
                    >
                      {grade}
                    </span>
                  ) : (
                    <span class="text-gray-400">—</span>
                  )}
                </td>
                <td class="px-4 py-3 text-right">
                  <a
                    href={`/app/crawl/${crawl.id}`}
                    class="text-sm text-blue-600 hover:underline"
                  >
                    View
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {crawls.length === 0 && (
        <p class="py-8 text-center text-sm text-gray-500">
          No crawl history yet.
        </p>
      )}
    </div>,
  );
});

workspaceSecondaryTabRoutes.get("/projects/:id/tab/settings", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const projectId = c.req.param("id");
  const project = await projectQueries(db).getById(projectId);
  if (!project || project.userId !== userId) return c.text("Not found", 404);

  return c.html(
    <div class="max-w-lg space-y-6">
      <section class="rounded-lg border bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-4 text-lg font-semibold">Project Settings</h3>
        <form
          hx-patch={`/api/projects/${projectId}`}
          hx-target="#project-settings-status"
          hx-swap="innerHTML"
          class="space-y-4"
        >
          <div>
            <label class="mb-1 block text-sm font-medium" for="projectName">
              Project Name
            </label>
            <input
              type="text"
              name="name"
              id="projectName"
              value={project.name}
              class="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Domain</label>
            <p class="text-sm text-gray-500">{project.domain}</p>
            <p class="text-xs text-gray-400">
              Domain cannot be changed after creation.
            </p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium" for="siteDescription">
              Site Description
            </label>
            <textarea
              name="siteDescription"
              id="siteDescription"
              rows={3}
              class="w-full rounded border px-3 py-2 text-sm"
              placeholder="Brief description of what this site does..."
            >
              {project.siteDescription ?? ""}
            </textarea>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium" for="industry">
              Industry
            </label>
            <input
              type="text"
              name="industry"
              id="industry"
              value={project.industry ?? ""}
              placeholder="e.g. SaaS, E-commerce, Healthcare"
              class="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div class="flex items-center gap-3">
            <button
              type="submit"
              class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:scale-95 transition-transform"
            >
              Save
            </button>
            <span id="project-settings-status"></span>
          </div>
        </form>
      </section>

      <section class="rounded-lg border border-red-200 bg-white p-6 dark:bg-gray-900">
        <h3 class="mb-2 text-lg font-semibold text-red-600">Danger Zone</h3>
        <p class="mb-4 text-sm text-gray-500">
          Permanently delete this project and all its data.
        </p>
        <button
          hx-delete={`/api/projects/${projectId}`}
          hx-confirm={`Delete "${project.name}"? This will permanently remove all crawl data, scores, and reports.`}
          class="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete Project
        </button>
      </section>
    </div>,
  );
});
