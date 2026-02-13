export default function ProjectDetailLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Back link + header skeleton */}
      <div>
        <div className="mb-3 h-4 w-32 rounded bg-muted" />
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="h-7 w-48 rounded bg-muted" />
            <div className="h-4 w-36 rounded bg-muted" />
          </div>
          <div className="h-9 w-28 rounded bg-muted" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded bg-muted" />
        ))}
      </div>

      {/* Score + breakdown skeleton */}
      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center rounded-lg border p-8">
          <div className="h-40 w-40 rounded-full bg-muted" />
        </div>
        <div className="rounded-lg border p-6 space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="h-4 w-28 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
