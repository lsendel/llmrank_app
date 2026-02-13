import Link from "next/link";
import {
  ArrowLeft,
  Play,
  BarChart3,
  FileText,
  AlertTriangle,
} from "lucide-react";

// Placeholder data -- will be replaced with API calls
const project = {
  id: "1",
  name: "acme.com",
  domain: "https://acme.com",
  createdAt: "2025-01-01T00:00:00Z",
  settings: {
    maxPages: 100,
    maxDepth: 3,
    schedule: "weekly" as const,
  },
};

const crawlHistory = [
  {
    id: "c1",
    startedAt: "2025-01-15T10:30:00Z",
    completedAt: "2025-01-15T10:45:00Z",
    pagesScanned: 45,
    overallScore: 72,
    letterGrade: "C" as const,
    issuesFound: 8,
  },
  {
    id: "c2",
    startedAt: "2025-01-08T10:00:00Z",
    completedAt: "2025-01-08T10:12:00Z",
    pagesScanned: 42,
    overallScore: 65,
    letterGrade: "D" as const,
    issuesFound: 12,
  },
  {
    id: "c3",
    startedAt: "2025-01-01T10:00:00Z",
    completedAt: "2025-01-01T10:10:00Z",
    pagesScanned: 38,
    overallScore: 60,
    letterGrade: "D" as const,
    issuesFound: 15,
  },
];

const latestScores = {
  overall: 72,
  technical: 78,
  content: 65,
  aiReadiness: 70,
  performance: 74,
};

function gradeColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

function gradeBg(score: number): string {
  if (score >= 80) return "bg-success/10";
  if (score >= 60) return "bg-warning/10";
  return "bg-destructive/10";
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // TODO: fetch project by id from API
  void id;

  return (
    <div className="space-y-8">
      {/* Back + header */}
      <div>
        <Link
          href="/dashboard/projects"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {project.domain}
            </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Play className="h-4 w-4" />
            Run Crawl
          </button>
        </div>
      </div>

      {/* Latest scores */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Latest Scores</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(latestScores).map(([key, value]) => {
            const label = key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (s) => s.toUpperCase());
            return (
              <div
                key={key}
                className={`rounded-xl border border-border p-4 ${gradeBg(value)}`}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {label}
                </p>
                <p className={`mt-1 text-3xl font-bold ${gradeColor(value)}`}>
                  {value}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Crawl history */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Crawl History</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Pages
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Score
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Grade
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Issues
                </th>
              </tr>
            </thead>
            <tbody>
              {crawlHistory.map((crawl) => (
                <tr
                  key={crawl.id}
                  className="border-b border-border last:border-0 hover:bg-muted/50"
                >
                  <td className="px-4 py-3">
                    {new Date(crawl.startedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {crawl.pagesScanned}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span
                        className={`font-semibold ${gradeColor(crawl.overallScore)}`}
                      >
                        {crawl.overallScore}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {crawl.letterGrade}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                      {crawl.issuesFound}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
