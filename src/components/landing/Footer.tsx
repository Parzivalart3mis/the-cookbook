'use client';

import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { Reveal } from './primitives';

const LINKS: { heading: string; items: { label: string; href: string }[] }[] = [
  {
    heading: 'Cook',
    items: [
      { label: 'All recipes', href: '/recipes' },
      { label: 'Meal planner', href: '/meal-plan' },
      { label: 'Shopping list', href: '/shopping-list' },
    ],
  },
  {
    heading: 'Track',
    items: [
      { label: 'Timeline', href: '/timeline' },
      { label: 'Future recipes', href: '/future-recipes' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-[var(--l-line)] px-5 pb-12 pt-20 sm:px-8">
      {/* Horizon glow along the top edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(245,158,11,0.5), transparent)',
        }}
      />

      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex flex-col justify-between gap-12 md:flex-row">
            {/* Brand */}
            <div className="max-w-xs">
              <Link href="/" className="group inline-flex items-center gap-2.5">
                <ChefHat
                  size={22}
                  className="text-[var(--l-ember)] transition-transform duration-300 group-hover:-rotate-12"
                />
                <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--l-text)]">
                  The Cookbook
                </span>
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-[var(--l-text-faint)]">
                A personal collection, pulled fresh from Notion. Built for one
                kitchen — this one.
              </p>
            </div>

            {/* Link columns */}
            <nav className="flex gap-16 sm:gap-24">
              {LINKS.map((group) => (
                <div key={group.heading}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--l-text-faint)]">
                    {group.heading}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {group.items.map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          className="text-sm text-[var(--l-text-muted)] transition-colors duration-200 hover:text-[var(--l-ember-hot)]"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </Reveal>

        {/* Oversized wordmark — decorative depth */}
        <div
          aria-hidden
          className="mt-20 select-none overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 85%)',
          }}
        >
          <p className="whitespace-nowrap text-center font-[family-name:var(--font-display)] text-[clamp(3rem,15vw,11rem)] font-semibold leading-[0.8] tracking-[-0.04em] text-[var(--l-text)]/[0.045]">
            The Cookbook
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--l-line)] pt-7 text-xs text-[var(--l-text-faint)] sm:flex-row">
          <p>© {new Date().getFullYear()} The Cookbook</p>
          <p>Pulled fresh from Notion</p>
        </div>
      </div>
    </footer>
  );
}
