import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center" role="status" aria-busy="true">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-12 w-12 rounded-full" />
        <Skeleton className="mx-auto h-4 w-48" />
      </div>
    </div>
  );
}
