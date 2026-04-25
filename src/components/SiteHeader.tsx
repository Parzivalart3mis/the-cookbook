import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex h-14 items-center justify-between">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-ink hover:text-accent transition-colors duration-150"
        >
          The Cookbook
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
