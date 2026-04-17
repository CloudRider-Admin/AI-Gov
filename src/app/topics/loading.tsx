import { Skeleton } from "@/components/ui/Skeleton";

export default function TopicsLoading() {
  return (
    <div className="section min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-24 bg-terminal-gray/50 rounded animate-pulse mb-8" />

        {/* Header skeleton */}
        <div className="mb-12">
          <div className="h-4 w-32 bg-terminal-gray/50 rounded animate-pulse mb-4" />
          <div className="h-12 w-1/2 bg-terminal-gray/50 rounded animate-pulse mb-4" />
          <div className="h-5 w-full max-w-xl bg-terminal-gray/50 rounded animate-pulse" />
        </div>

        {/* Categories skeleton */}
        <div className="space-y-12">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-8">
              <div className="flex items-start gap-4 mb-6">
                <Skeleton className="w-14 h-14 rounded-lg" />
                <div className="flex-grow">
                  <Skeleton className="h-7 w-40 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="p-4 border border-terminal-border rounded-lg">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
