import { Skeleton } from "@/components/ui/Skeleton";

export default function LearnLoading() {
  return (
    <div className="section min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-20 bg-terminal-gray/50 rounded animate-pulse mb-8" />

        {/* Header skeleton */}
        <div className="mb-16 text-center">
          <div className="h-4 w-32 bg-terminal-gray/50 rounded animate-pulse mx-auto mb-4" />
          <div className="h-12 w-80 bg-terminal-gray/50 rounded animate-pulse mx-auto mb-4" />
          <div className="h-5 w-96 max-w-full bg-terminal-gray/50 rounded animate-pulse mx-auto" />
        </div>

        {/* Learning paths skeleton */}
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-8">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="flex items-center gap-4 lg:w-1/3">
                  <Skeleton className="w-16 h-16 rounded-xl" />
                  <div>
                    <Skeleton className="h-3 w-16 mb-2" />
                    <Skeleton className="h-7 w-32" />
                  </div>
                </div>
                <div className="lg:w-1/3">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="lg:w-1/3 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-44" />
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-terminal-border">
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
