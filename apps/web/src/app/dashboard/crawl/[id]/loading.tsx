export default function CrawlDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="mb-3 h-4 w-32 rounded bg-muted" />
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="h-7 w-36 rounded bg-muted" />
            <div className="h-4 w-52 rounded bg-muted" />
          </div>
          <div className="h-6 w-20 rounded-full bg-muted" />
        </div>
      </div>

      {/* Progress skeleton */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex justify-between">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
        <div className="h-3 w-full rounded-full bg-muted" />
        <div className="flex gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-5 w-8 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Score skeleton */}
      <div className="rounded-lg border p-6">
        <div className="mb-4 h-5 w-32 rounded bg-muted" />
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
          <div className="h-28 w-28 rounded-full bg-muted" />
          <div className="grid grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center space-y-1">
                <div className="mx-auto h-3 w-16 rounded bg-muted" />
                <div className="mx-auto h-7 w-10 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
