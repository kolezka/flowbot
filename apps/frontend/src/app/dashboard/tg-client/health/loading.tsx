export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="flex gap-3">
          <div className="h-9 w-20 bg-muted rounded animate-pulse" />
          <div className="h-9 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border bg-card p-6 shadow"
          >
            <div className="h-4 w-2/3 bg-muted rounded mb-3" />
            <div className="h-8 w-1/2 bg-muted rounded mb-2" />
            <div className="h-3 w-3/4 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-72" />
        <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-72" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-72" />
        <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-72" />
      </div>
      <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-72" />
      <div className="animate-pulse rounded-xl border bg-card p-6 shadow h-48" />
    </div>
  );
}
