import Link from 'next/link';
import { ChefHat, ShoppingCart, CalendarDays, CalendarRange, Sparkles, type LucideIcon } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import HeaderAuthArea from './HeaderAuthArea';
import { FEATURES } from '@/lib/features';

const NAV: { href: string; label: string; icon: LucideIcon; enabled: boolean }[] = [
  { href: '/kitchen-ai', label: 'AI Kitchen', icon: Sparkles, enabled: true },
  { href: '/meal-plan', label: 'Meal Planner', icon: CalendarRange, enabled: FEATURES.mealPlanner },
  { href: '/timeline', label: 'Timeline', icon: CalendarDays, enabled: FEATURES.timeline },
  { href: '/shopping-list', label: 'Shopping List', icon: ShoppingCart, enabled: FEATURES.shoppingList },
];

export default function SiteHeader() {
  const links = NAV.filter(l => l.enabled);
  // With every feature on, the row only fits a phone if the name collapses to the hat.
  const crowded = links.length > 2;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 flex h-14 items-center justify-between">
        <Link
          href="/"
          aria-label="The Cookbook home"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-xl font-semibold tracking-tight text-ink hover:text-accent transition-colors duration-150"
        >
          <ChefHat size={22} className="text-accent shrink-0" />
          <span className={crowded ? 'hidden min-[430px]:inline' : undefined}>The Cookbook</span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors duration-150"
            >
              <Icon size={18} />
            </Link>
          ))}
          <ThemeToggle />
          <HeaderAuthArea />
        </div>
      </div>
    </header>
  );
}
