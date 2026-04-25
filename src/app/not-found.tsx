import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-32 flex flex-col items-center text-center gap-5">
      <span className="font-display text-7xl font-semibold text-accent/30 select-none">
        404
      </span>
      <h1 className="font-display text-2xl font-semibold text-ink">
        Recipe not found
      </h1>
      <p className="text-ink-muted max-w-xs">
        This page doesn&apos;t exist. It may have been moved or the URL is wrong.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Back to recipes
      </Link>
    </div>
  );
}
