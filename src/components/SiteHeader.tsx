import Link from 'next/link';
import { ChefHat } from 'lucide-react';
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
        <ThemeToggle />
      </div>
    </header>
  );
}
