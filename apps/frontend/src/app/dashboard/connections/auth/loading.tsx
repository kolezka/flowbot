export default function Loading() {
  return (
    <div className="mx-auto max-w-lg animate-pulse space-y-4">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-36 bg-muted rounded-xl" />
        <div className="h-36 bg-muted rounded-xl" />
      </div>
    </div>
  );
}
