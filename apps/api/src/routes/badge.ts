import { Hono } from "hono";
import type { AppEnv } from "../index";
import { crawlQueries, projectQueries } from "@llm-boost/db";

const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: "#22c55e", text: "#ffffff" },
  B: { bg: "#3b82f6", text: "#ffffff" },
  C: { bg: "#eab308", text: "#1a1a1a" },
  D: { bg: "#f97316", text: "#ffffff" },
  F: { bg: "#ef4444", text: "#ffffff" },
};

function renderBadgeSvg(data: {
  grade: string;
  score: number;
  technical: number;
  content: number;
  aiReadiness: number;
  performance: number;
  domain: string;
  scannedAt: string;
}): string {
  const color = GRADE_COLORS[data.grade] ?? GRADE_COLORS.F;
  const dateStr = new Date(data.scannedAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e1e2e"/>
      <stop offset="100%" stop-color="#181825"/>
    </linearGradient>
  </defs>
  <rect width="320" height="120" rx="8" fill="url(#bg)"/>
  <rect x="1" y="1" width="318" height="118" rx="7" fill="none" stroke="#333" stroke-width="1"/>
  <text x="16" y="24" font-family="system-ui,sans-serif" font-size="11" fill="#a0a0b0" font-weight="500">AI Readiness Score</text>
  <rect x="16" y="32" width="40" height="40" rx="6" fill="${color.bg}"/>
  <text x="36" y="59" font-family="system-ui,sans-serif" font-size="22" fill="${color.text}" font-weight="700" text-anchor="middle">${data.grade}</text>
  <text x="68" y="50" font-family="system-ui,sans-serif" font-size="20" fill="#e0e0e0" font-weight="600">${data.score}</text>
  <text x="${68 + String(data.score).length * 12}" y="50" font-family="system-ui,sans-serif" font-size="12" fill="#666"> / 100</text>
  <text x="16" y="90" font-family="system-ui,sans-serif" font-size="10" fill="#888">Tech ${data.technical}  ·  Content ${data.content}  ·  AI ${data.aiReadiness}  ·  Perf ${data.performance}</text>
  <text x="16" y="108" font-family="system-ui,sans-serif" font-size="10" fill="#555">${data.domain}  ·  Scanned ${dateStr}</text>
  <text x="304" y="108" font-family="system-ui,sans-serif" font-size="9" fill="#444" text-anchor="end">LLM Rank</text>
</svg>`;
}

export const badgeRoutes = new Hono<AppEnv>();

badgeRoutes.get("/:token.svg", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  if (!token) {
    c.header("Content-Type", "image/svg+xml");
    c.header("Cache-Control", "public, max-age=300");
    return c.body(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="30" viewBox="0 0 200 30">
        <rect width="200" height="30" rx="4" fill="#333"/>
        <text x="100" y="19" font-family="system-ui,sans-serif" font-size="11" fill="#999" text-anchor="middle">Report not found</text>
      </svg>`,
    );
  }

  const crawlJob = await crawlQueries(db).getByShareToken(token);
  if (!crawlJob) {
    c.header("Content-Type", "image/svg+xml");
    c.header("Cache-Control", "public, max-age=300");
    return c.body(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="30" viewBox="0 0 200 30">
        <rect width="200" height="30" rx="4" fill="#333"/>
        <text x="100" y="19" font-family="system-ui,sans-serif" font-size="11" fill="#999" text-anchor="middle">Report not found</text>
      </svg>`,
    );
  }

  const project = await projectQueries(db).getById(crawlJob.projectId);
  if (!project) {
    c.header("Content-Type", "image/svg+xml");
    c.header("Cache-Control", "public, max-age=300");
    return c.body(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="30"><text x="10" y="20" fill="#999" font-size="11">Not found</text></svg>`,
    );
  }

  const sd = (crawlJob.summaryData as Record<string, unknown>) ?? {};
  const cats = (sd.categoryScores as Record<string, number>) ?? {};

  const badge = renderBadgeSvg({
    grade: typeof sd.letterGrade === "string" ? sd.letterGrade : "F",
    score:
      typeof sd.overallScore === "number" ? Math.round(sd.overallScore) : 0,
    technical: Math.round(cats.technical ?? 0),
    content: Math.round(cats.content ?? 0),
    aiReadiness: Math.round(cats.aiReadiness ?? 0),
    performance: Math.round(cats.performance ?? 0),
    domain: project.domain,
    scannedAt:
      crawlJob.completedAt?.toISOString() ?? crawlJob.createdAt.toISOString(),
  });

  c.header("Content-Type", "image/svg+xml");
  c.header("Cache-Control", "public, max-age=3600");
  return c.body(badge);
});
