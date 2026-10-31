import Link from 'next/link';
import { ChefHat, ShoppingCart, CalendarDays, CalendarRange, Sparkles } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import HeaderAuthArea from './HeaderAuthArea';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex h-14 items-center justify-between">
        <Link
          href="/"
          aria-label="The Cookbook home"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-xl font-semibold tracking-tight text-ink hover:text-accent transition-colors duration-150"
        >
          <ChefHat size={22} className="text-accent shrink-0" />
          {/* Phones show just the hat so the nav icons + avatar fit on one row. */}
          <span className="hidden min-[430px]:inline">The Cookbook</span>
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <Link
            href="/kitchen-ai"
            title="AI Kitchen"
            aria-label="AI Kitchen"
            className="p-1.5 sm:p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
          >
            <Sparkles size={18} />
          </Link>
          <Link
            href="/meal-plan"
            title="Meal Planner"
            aria-label="Meal Planner"
            className="p-1.5 sm:p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
          >
            <CalendarRange size={18} />
          </Link>
          <Link
            href="/timeline"
            title="Timeline"
            aria-label="Timeline"
            className="p-1.5 sm:p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
          >
            <CalendarDays size={18} />
          </Link>
          <Link
            href="/shopping-list"
            title="Shopping List"
            aria-label="Shopping List"
            className="p-1.5 sm:p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
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
