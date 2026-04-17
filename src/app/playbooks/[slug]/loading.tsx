import { PageHeaderSkeleton, ContentSkeleton } from "@/components/ui/Skeleton";

export default function PlaybookLoading() {
  return (
    <div className="section min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-48 bg-terminal-gray/50 rounded animate-pulse mb-8" />

        {/* Header skeleton */}
        <PageHeaderSkeleton />

        {/* Meta info skeleton */}
        <div className="flex gap-6 mb-12 pb-8 border-b border-terminal-border">
          <div className="h-4 w-24 bg-terminal-gray/50 rounded animate-pulse" />
          <div className="h-4 w-32 bg-terminal-gray/50 rounded animate-pulse" />
        </div>

        {/* Content skeleton */}
        <ContentSkeleton />
      </div>
    </div>
  );
}
