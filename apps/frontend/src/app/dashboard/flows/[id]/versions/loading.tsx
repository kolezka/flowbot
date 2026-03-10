export default function VersionsLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}
