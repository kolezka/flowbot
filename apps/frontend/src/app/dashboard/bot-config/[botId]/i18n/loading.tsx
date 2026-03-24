import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function I18nLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-9 w-48 rounded-lg" />
      <SkeletonTable rows={6} cols={3} />
    </div>
  );
}
