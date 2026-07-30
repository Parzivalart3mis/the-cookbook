'use client';

import Link from 'next/link';
import { ArrowRight, CalendarRange } from 'lucide-react';
import { Reveal, Magnetic, Aurora } from './primitives';

export default function CallToAction({ recipeCount }: { recipeCount: number }) {
  return (
    <section className="relative px-5 py-28 sm:px-8 sm:py-36">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          {/* Gradient-border shell: bright ring, dark core */}
          <div className="relative overflow-hidden rounded-[2rem] p-px">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(140deg, rgba(251,191,36,0.65), rgba(249,115,22,0.25) 40%, rgba(255,226,183,0.08) 70%)',
              }}
            />

            <div className="relative overflow-hidden rounded-[calc(2rem-1px)] bg-[var(--l-deep)]">
              <Aurora className="opacity-45" />

              {/* Sweeping scan line */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-40"
                style={{
                  background:
                    'linear-gradient(180deg, transparent, rgba(251,191,36,0.14), transparent)',
                  animation: 'landing-scan 9s ease-in-out infinite',
                }}
              />

              <div className="relative px-7 py-20 text-center sm:px-14 sm:py-28">
                <h2 className="mx-auto max-w-2xl text-balance font-[family-name:var(--font-display)] text-[clamp(2.1rem,6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-[var(--l-text)]">
                  Dinner is in{' '}
                  <span className="bg-gradient-to-r from-[var(--l-ember-hot)] to-[var(--l-plasma)] bg-clip-text text-transparent">
                    three taps.
                  </span>
                </h2>

                <p className="mx-auto mt-6 max-w-lg text-balance text-[var(--l-text-muted)]">
                  {recipeCount} recipes, every macro counted, the week already
                  planned. Open it and start cooking.
                </p>

                <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Magnetic>
                    <Link
                      href="/"
                      className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-[var(--l-ember-hot)] to-[var(--l-plasma)] px-9 py-4 text-sm font-semibold text-[#1a0f02] shadow-[0_0_46px_-8px_rgba(245,158,11,0.7)] transition-shadow duration-300 hover:shadow-[0_0_70px_-6px_rgba(245,158,11,0.9)]"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                      />
                      <span className="relative">Open the cookbook</span>
                      <ArrowRight
                        size={16}
                        className="relative transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </Link>
                  </Magnetic>

                  <Magnetic strength={0.2}>
                    <Link
                      href="/meal-plan"
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--l-line-strong)] bg-[var(--l-raise)]/50 px-8 py-4 text-sm font-medium text-[var(--l-text)] backdrop-blur-xl transition-colors duration-300 hover:border-[var(--l-ember)]/45 hover:bg-[var(--l-raise)]/80"
                    >
                      <CalendarRange size={15} className="text-[var(--l-ember)]" />
                      Plan this week
                    </Link>
                  </Magnetic>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
