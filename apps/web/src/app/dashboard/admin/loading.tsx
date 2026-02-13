export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="mt-2 h-4 w-72 rounded bg-muted" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6 space-y-2">
            <div className="flex justify-between">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-4 w-4 rounded bg-muted" />
            </div>
            <div className="h-8 w-28 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex justify-between">
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="h-9 w-64 rounded bg-muted" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between py-3">
            <div className="space-y-1">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-56 rounded bg-muted" />
            </div>
            <div className="h-5 w-16 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
