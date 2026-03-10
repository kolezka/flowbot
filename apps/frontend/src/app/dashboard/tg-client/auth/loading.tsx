export default function Loading() {
  return (
    <div className="mx-auto max-w-md animate-pulse space-y-4">
      <div className="h-8 w-64 bg-muted rounded" />
      <div className="h-10 bg-muted rounded" />
      <div className="h-48 bg-muted rounded-xl" />
    </div>
  );
}
