export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center" role="status" aria-busy="true">
      <div className="animate-pulse text-muted-foreground">Loading live view...</div>
    </div>
  );
}
