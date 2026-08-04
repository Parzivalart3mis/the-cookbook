import Link from 'next/link';
import { ChefHat, ShoppingCart, CalendarDays, CalendarRange } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import HeaderAuthArea from './HeaderAuthArea';

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
            href="/meal-plan"
            title="Meal Planner"
            aria-label="Meal Planner"
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
          >
            <CalendarRange size={18} />
          </Link>
          <Link
            href="/timeline"
            title="Timeline"
            aria-label="Timeline"
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
          >
            <CalendarDays size={18} />
          </Link>
          <Link
            href="/shopping-list"
            title="Shopping List"
            aria-label="Shopping List"
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
          >
            <ShoppingCart size={18} />
          </Link>
          <ThemeToggle />
          <HeaderAuthArea />
        </div>
      </div>
    </header>
  );
}
