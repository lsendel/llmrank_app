import Link from "next/link";
import { Plus } from "lucide-react";

// Placeholder data -- will be replaced with API calls
const placeholderProjects = [
  {
    id: "1",
    name: "acme.com",
    domain: "https://acme.com",
    lastScore: 72,
    lastCrawl: "2025-01-15T10:30:00Z",
    pagesScanned: 45,
  },
  {
    id: "2",
    name: "widgets.io",
    domain: "https://widgets.io",
    lastScore: 58,
    lastCrawl: "2025-01-14T08:15:00Z",
    pagesScanned: 22,
  },
  {
    id: "3",
    name: "blog.example.com",
    domain: "https://blog.example.com",
    lastScore: 85,
    lastCrawl: "2025-01-15T12:00:00Z",
    pagesScanned: 12,
  },
];

function gradeColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your website projects and view their AI-readiness scores.
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      {/* Projects grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholderProjects.map((project) => (
          <Link
            key={project.id}
            href={`/dashboard/projects/${project.id}`}
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold group-hover:text-primary">
                  {project.name}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {project.domain}
                </p>
              </div>
              <span
                className={`text-2xl font-bold ${gradeColor(project.lastScore)}`}
              >
                {project.lastScore}
              </span>
            </div>
            <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
              <span>{project.pagesScanned} pages scanned</span>
              <span>
                Last crawl: {new Date(project.lastCrawl).toLocaleDateString()}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty state for when there are no projects */}
      {placeholderProjects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <p className="text-muted-foreground">No projects yet.</p>
          <Link
            href="/dashboard/projects/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create your first project
          </Link>
        </div>
      )}
    </div>
  );
}
