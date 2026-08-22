import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while the URL-driven explorer state resolves. Mirrors the real layout's
 * proportions so nothing shifts once the table renders.
 */
export function ExplorerSkeleton() {
  return (
    <div className="px-3 pt-5 sm:px-5" aria-busy="true" aria-label="Loading questions">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-72" />

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 bg-background px-3 py-2.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Skeleton className="h-8 flex-1 basis-full sm:basis-56" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>

      <div className="mt-5 space-y-px">
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
