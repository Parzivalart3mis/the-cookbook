/**
 * Shared loading placeholders.
 *
 * Geometry deliberately mirrors the real components so the swap from skeleton
 * to content produces no layout shift. The shimmer itself lives in
 * globals.css (`.skeleton`) so every placeholder animates identically.
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

/** Matches RecipeCard: 144px cover, title, badge row, meta row. */
export function RecipeCardSkeleton() {
  return (
    <div className="h-full overflow-hidden rounded-xl border border-border bg-surface-card">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="p-5">
        <Skeleton className="mb-3 h-5 w-3/4" />
        <div className="mb-3 flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Matches RecipeGrid's responsive columns. */
export function RecipeGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <RecipeCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Matches the browse page: count line, search bar, filter row, grid. */
export function BrowseSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-3 h-6 w-48" />
      <Skeleton className="mb-2 h-9 w-full rounded-lg" />
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <RecipeGridSkeleton />
    </div>
  );
}
