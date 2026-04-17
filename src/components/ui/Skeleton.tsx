"use client";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-terminal-gray/50 rounded ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="card">
      <Skeleton className="w-10 h-10 rounded-lg mb-4" />
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function PlaybookCardSkeleton() {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="w-20 h-6 rounded-full" />
      </div>
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-2/3" />
      <div className="mt-4 pt-4 border-t border-terminal-border">
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-8 w-1/4 mt-8" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-8 w-1/3 mt-8" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-12">
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="flex items-start gap-4">
        <Skeleton className="w-14 h-14 rounded-lg flex-shrink-0" />
        <div className="flex-grow">
          <Skeleton className="h-10 w-2/3 mb-4" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
      </div>
    </div>
  );
}
