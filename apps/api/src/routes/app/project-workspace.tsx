/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { Layout, PageHeader } from "../../views/layout";
import { crawlDetailAppRoutes } from "./crawl-detail";
import {
  userQueries,
  scoreQueries,
  crawlQueries,
  projectQueries,
  competitorBenchmarkQueries,
  visibilityQueries,
} from "@llm-boost/db";
import { Breadcrumb } from "../../views/htmx-helpers";

export const projectWorkspaceAppRoutes = new Hono<AppEnv>();
projectWorkspaceAppRoutes.route("/", crawlDetailAppRoutes);
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

// ─── Chart islands JS (served as static asset) ───────
projectWorkspaceAppRoutes.get("/static/charts.js", (c) => {
  // Safe: chart data comes from server-rendered data-* attributes, not user input
  const js = `(function(){
if(typeof Chart==='undefined')return;

var COLORS={
  technical:'#6366f1',content:'#8b5cf6',aiReady:'#3b82f6',perf:'#06b6d4',
  overall:'#6b7280',
  gradeA:'#22c55e',gradeB:'#84cc16',gradeC:'#eab308',gradeD:'#f97316',gradeF:'#ef4444'
};

// ── Count-up animation ──
document.querySelectorAll('[data-count-up]').forEach(function(el){
  var target=parseInt(el.getAttribute('data-count-up'),10);
  if(isNaN(target))return;
  var dur=800,start=performance.now();
  el.textContent='0';
  function tick(now){
    var t=Math.min((now-start)/dur,1);
    var ease=1-Math.pow(1-t,3);
    el.textContent=Math.round(ease*target).toString();
    if(t<1)requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
});

// ── Score bar animation ──
document.querySelectorAll('[data-score-bar]').forEach(function(el){
  var w=el.getAttribute('data-score-bar');
  el.style.width='0%';
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ el.style.width=w+'%'; });
  });
});

// ── Issue distribution doughnut ──
var distEl=document.getElementById('issue-dist-chart');
if(distEl){
  var d=JSON.parse(distEl.getAttribute('data-chart-data')||'{}');
  var cv=document.createElement('canvas');
  while(distEl.firstChild)distEl.removeChild(distEl.firstChild);
  distEl.appendChild(cv);
  new Chart(cv,{type:'doughnut',data:{
    labels:['Critical','Warning','Info'],
    datasets:[{data:[d.critical||0,d.warning||0,d.info||0],
      backgroundColor:['#ef4444','#eab308','#3b82f6']}]},
    options:{responsive:true,maintainAspectRatio:false,
      animation:{animateRotate:true,animateScale:true,duration:600},
      plugins:{legend:{position:'bottom',labels:{padding:16,usePointStyle:true}},
        tooltip:{callbacks:{label:function(ctx){
          var sum=ctx.dataset.data.reduce(function(a,b){return a+b},0);
          var pct=sum>0?Math.round(ctx.raw/sum*100):0;
          return ctx.label+': '+ctx.raw+' ('+pct+'%)';
        }}}}}});
}

// ── Category breakdown horizontal bar ──
document.querySelectorAll('[data-chart-type="category-breakdown"]').forEach(function(el){
  var cd=JSON.parse(el.getAttribute('data-chart-data')||'null');
  if(!cd)return;
  var cv=document.createElement('canvas');
  while(el.firstChild)el.removeChild(el.firstChild);
  el.appendChild(cv);
  new Chart(cv,{type:'bar',data:{
    labels:['Technical','Content','AI Readiness','Performance'],
    datasets:[{data:[cd.technical||0,cd.content||0,cd.aiReadiness||0,cd.performance||0],
      backgroundColor:[COLORS.technical,COLORS.content,COLORS.aiReady,COLORS.perf],
      borderRadius:4,barPercentage:0.7}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      animation:{duration:800,easing:'easeOutCubic'},
      scales:{x:{min:0,max:100,grid:{display:false}},y:{grid:{display:false}}},
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:function(ctx){return ctx.raw+'/100'}}}}}});
});

// ── Grade distribution horizontal bar ──
var gradeEl=document.getElementById('grade-dist-chart');
if(gradeEl){
  var gd=JSON.parse(gradeEl.getAttribute('data-chart-data')||'null');
  if(gd){
    var cv3=document.createElement('canvas');
    while(gradeEl.firstChild)gradeEl.removeChild(gradeEl.firstChild);
    gradeEl.appendChild(cv3);
    new Chart(cv3,{type:'bar',data:{
      labels:['A (90+)','B (80-89)','C (70-79)','D (60-69)','F (<60)'],
      datasets:[{data:[gd.A||0,gd.B||0,gd.C||0,gd.D||0,gd.F||0],
        backgroundColor:[COLORS.gradeA,COLORS.gradeB,COLORS.gradeC,COLORS.gradeD,COLORS.gradeF],
        borderRadius:4,barPercentage:0.7}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
        animation:{duration:800,easing:'easeOutCubic'},
        scales:{x:{beginAtZero:true,ticks:{stepSize:1},grid:{display:false}},y:{grid:{display:false}}},
        plugins:{legend:{display:false}}}});
  }
}

// ── Score trend line chart ──
var trendEl=document.getElementById('score-trend-chart');
if(trendEl){
  var td=JSON.parse(trendEl.getAttribute('data-chart-data')||'null');
  if(td){
    var cv2=document.getElementById('score-trend-canvas');
    if(cv2){
      var datasets=[{label:'Overall',data:td.scores,
        borderColor:COLORS.overall,backgroundColor:'rgba(107,114,128,0.05)',
        fill:true,tension:0.3,pointRadius:4,borderWidth:2}];
      if(td.technical){
        datasets.push({label:'Technical',data:td.technical,borderColor:COLORS.technical,
          borderDash:[5,3],tension:0.3,pointRadius:2,borderWidth:1.5,fill:false});
        datasets.push({label:'Content',data:td.content,borderColor:COLORS.content,
          borderDash:[5,3],tension:0.3,pointRadius:2,borderWidth:1.5,fill:false});
        datasets.push({label:'AI Readiness',data:td.aiReadiness,borderColor:COLORS.aiReady,
          borderDash:[5,3],tension:0.3,pointRadius:2,borderWidth:1.5,fill:false});
        datasets.push({label:'Performance',data:td.performance,borderColor:COLORS.perf,
          borderDash:[5,3],tension:0.3,pointRadius:2,borderWidth:1.5,fill:false});
      }
      new Chart(cv2,{type:'line',data:{labels:td.labels,datasets:datasets},
        options:{responsive:true,maintainAspectRatio:false,
          animation:{duration:800,easing:'easeOutCubic'},
          interaction:{mode:'index',intersect:false},
          scales:{y:{min:0,max:100}},
          plugins:{legend:{display:datasets.length>1,position:'bottom',
            labels:{usePointStyle:true,padding:12}},
            tooltip:{mode:'index',intersect:false}}}});
    }
  }
}

})();`;
  return c.body(js, 200, {
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=3600",
  });
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

// ─── Visibility tab ───────────────────────────────────
projectWorkspaceAppRoutes.get("/projects/:id/tab/visibility", async (c) => {
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

// ─── History tab ──────────────────────────────────────
projectWorkspaceAppRoutes.get("/projects/:id/tab/history", async (c) => {
  const db = c.get("db");
  const projectId = c.req.param("id");

  const crawls = await crawlQueries(db).listByProject(projectId);

  const completedIds = crawls
    .filter((cr) => cr.status === "complete")
    .map((cr) => cr.id);

  const scoreMap = new Map<string, number>();
  for (const id of completedIds) {
    const scores = await scoreQueries(db).listByJob(id);
    if (scores.length > 0) {
      const avg = Math.round(
        scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length,
      );
      scoreMap.set(id, avg);
    }
  }

  const STATUS_BADGE: Record<string, string> = {
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
                    class={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[crawl.status] ?? "bg-gray-100 text-gray-600"}`}
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

// ─── Project settings tab ─────────────────────────────
projectWorkspaceAppRoutes.get("/projects/:id/tab/settings", async (c) => {
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

// Legacy crawl detail routes extracted into ./crawl-detail


