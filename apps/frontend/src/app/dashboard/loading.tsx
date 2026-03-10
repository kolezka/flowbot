import { Skeleton, SkeletonCard, SkeletonChart } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}
