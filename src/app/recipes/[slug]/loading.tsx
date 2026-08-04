import { Skeleton } from '@/components/Skeleton';

/** Mirrors the recipe detail layout: hero, title, meta, action row, body. */
const BODY_LINES = ['w-full', 'w-11/12', 'w-full', 'w-4/5', 'w-full', 'w-3/4', 'w-11/12', 'w-2/3'];

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Skeleton className="mb-6 h-4 w-24" />
      <Skeleton className="mb-6 h-56 w-full rounded-2xl" />
      <Skeleton className="mb-4 h-10 w-3/4" />
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mb-8 flex gap-2">
        <Skeleton className="h-9 w-32 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <Skeleton className="mb-4 h-6 w-40" />
      <div className="space-y-3">
        {BODY_LINES.map((w, i) => (
          <Skeleton key={i} className={`h-4 ${w}`} />
        ))}
      </div>
    </div>
  );
}
