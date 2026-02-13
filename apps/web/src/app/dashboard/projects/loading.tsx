export default function ProjectsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-28 rounded bg-muted" />
          <div className="h-4 w-80 rounded bg-muted" />
        </div>
        <div className="h-9 w-28 rounded bg-muted" />
      </div>

      {/* Project cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <div className="h-5 w-32 rounded bg-muted" />
                <div className="h-3.5 w-40 rounded bg-muted" />
              </div>
              <div className="h-10 w-10 rounded bg-muted" />
            </div>
            <div className="mt-4 flex gap-4">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
