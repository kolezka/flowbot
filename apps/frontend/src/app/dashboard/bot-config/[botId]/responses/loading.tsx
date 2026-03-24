import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function ResponsesLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-9 w-64 rounded-lg" />
      <SkeletonTable rows={4} cols={2} />
    </div>
  );
}
