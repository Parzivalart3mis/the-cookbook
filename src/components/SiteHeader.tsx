import Link from 'next/link';
import { ChefHat, ShoppingCart, CalendarDays } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex h-14 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink hover:text-accent transition-colors duration-150"
        >
          <ChefHat size={22} className="text-accent shrink-0" />
          The Cookbook
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/timeline"
            title="Timeline"
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
          >
            <CalendarDays size={18} />
          </Link>
          <Link
            href="/shopping-list"
            title="Shopping List"
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
          >
            <ShoppingCart size={18} />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
