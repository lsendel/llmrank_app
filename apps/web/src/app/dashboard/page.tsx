import Link from "next/link";
import { FolderKanban, Activity, BarChart3, Clock } from "lucide-react";

// Placeholder data -- will be replaced with API calls
const placeholderProjects = [
  { id: "1", name: "acme.com", domain: "https://acme.com", lastScore: 72 },
  {
    id: "2",
    name: "widgets.io",
    domain: "https://widgets.io",
    lastScore: 58,
  },
  {
    id: "3",
    name: "blog.example.com",
    domain: "https://blog.example.com",
    lastScore: 85,
  },
];

const stats = [
  {
    label: "Total Projects",
    value: "3",
    icon: FolderKanban,
  },
  {
    label: "Last Crawl",
    value: "2 hours ago",
    icon: Clock,
  },
  {
    label: "Overall Score",
    value: "72 / 100",
    icon: BarChart3,
  },
  {
    label: "Issues Found",
    value: "14",
    icon: Activity,
  },
];

function gradeColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Welcome back. Here is an overview of your projects.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-secondary p-2">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-semibold">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Project list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Link
            href="/dashboard/projects/new"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            New Project
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Domain
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {placeholderProjects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-border last:border-0 hover:bg-muted/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {project.domain}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold ${gradeColor(project.lastScore)}`}
                    >
                      {project.lastScore}
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
