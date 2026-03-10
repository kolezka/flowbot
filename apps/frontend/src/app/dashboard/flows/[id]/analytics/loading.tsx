export default function AnalyticsLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-48 bg-muted rounded-xl" />
    </div>
  );
}
