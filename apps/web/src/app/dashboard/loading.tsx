export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Welcome skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-muted" />
          <div className="h-4 w-96 rounded bg-muted" />
        </div>
        <div className="hidden gap-2 sm:flex">
          <div className="h-9 w-28 rounded bg-muted" />
          <div className="h-9 w-28 rounded bg-muted" />
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-muted" />
                <div className="h-7 w-12 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity skeleton */}
      <div className="rounded-lg border">
        <div className="border-b p-6">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="mt-1.5 h-3.5 w-56 rounded bg-muted" />
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              </div>
              <div className="h-6 w-8 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
