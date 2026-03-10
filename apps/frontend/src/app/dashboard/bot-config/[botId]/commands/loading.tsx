export default function CommandsLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="h-8 w-48 bg-muted rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
