import { PlaybookCardSkeleton } from "@/components/ui/Skeleton";

export default function PlaybooksLoading() {
  return (
    <div className="section min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-32 bg-terminal-gray/50 rounded animate-pulse mb-8" />

        {/* Header skeleton */}
        <div className="mb-12">
          <div className="h-4 w-40 bg-terminal-gray/50 rounded animate-pulse mb-4" />
          <div className="h-12 w-2/3 bg-terminal-gray/50 rounded animate-pulse mb-4" />
          <div className="h-5 w-full max-w-xl bg-terminal-gray/50 rounded animate-pulse" />
        </div>

        {/* Filter tabs skeleton */}
        <div className="flex gap-3 mb-8">
          <div className="h-8 w-20 bg-terminal-gray/50 rounded-full animate-pulse" />
          <div className="h-8 w-28 bg-terminal-gray/50 rounded-full animate-pulse" />
          <div className="h-8 w-24 bg-terminal-gray/50 rounded-full animate-pulse" />
        </div>

        {/* Cards grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <PlaybookCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
