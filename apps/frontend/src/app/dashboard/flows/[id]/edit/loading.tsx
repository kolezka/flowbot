import { Skeleton } from "@/components/ui/skeleton";

export default function FlowEditorLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-muted/30">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-10 w-10 rounded-full" />
        <Skeleton className="mx-auto h-4 w-36" />
        <Skeleton className="mx-auto h-3 w-24" />
      </div>
    </div>
  );
}
