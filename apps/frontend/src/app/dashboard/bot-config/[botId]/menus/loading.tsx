export default function MenusLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 bg-muted rounded" />
        <div className="h-8 w-48 bg-muted rounded" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}
