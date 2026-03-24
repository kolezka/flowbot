import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CommandsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-48" />
      </div>
      <SkeletonTable rows={5} cols={3} />
    </div>
  );
}
