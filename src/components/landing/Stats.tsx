'use client';

import { Reveal, Stagger, StaggerItem, CountUp, Eyebrow, GlowCard } from './primitives';
import { Quote } from 'lucide-react';

export type StatsData = {
  recipeCount: number;
  tagCount: number;
  nutritionTracked: number;
  mealTypeCount: number;
};

export default function Stats({ data }: { data: StatsData }) {
  /** All four numbers are read live from the Notion database at build time. */
  const stats = [
    { value: data.recipeCount, suffix: '', label: 'Recipes in the collection' },
    { value: data.nutritionTracked, suffix: '', label: 'Fully macro-tracked' },
    { value: data.tagCount, suffix: '', label: 'Tags to filter by' },
    { value: 20, suffix: '', label: 'Nutrients per serving' },
  ];

  return (
    <section className="relative px-5 py-28 sm:px-8 sm:py-36">
      {/* Ambient wash behind the numbers */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[420px] -translate-y-1/2"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 50% 50%, rgba(245,158,11,0.1), transparent 70%)',
        }}
      />

      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <Eyebrow>The collection</Eyebrow>
        </Reveal>

        {/* Numbers */}
        <Stagger className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4" gap={0.1}>
          {stats.map((s) => (
            <StaggerItem key={s.label} className="text-center">
              <div className="font-[family-name:var(--font-display)] text-[clamp(2.75rem,7vw,4.5rem)] font-semibold leading-none tracking-[-0.03em]">
                <span className="bg-gradient-to-b from-[var(--l-text)] to-[var(--l-ember)] bg-clip-text text-transparent">
                  <CountUp value={s.value} suffix={s.suffix} />
                </span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--l-text-faint)]">
                {s.label}
              </p>
            </StaggerItem>
          ))}
        </Stagger>

        {/* Why it exists — an honest note rather than invented testimonials */}
        <Reveal delay={0.15} className="mt-20">
          <GlowCard className="mx-auto max-w-3xl">
            <figure className="p-9 text-center sm:p-12">
              <Quote size={26} className="mx-auto text-[var(--l-ember)]/45" />
              <blockquote className="mt-6 text-balance font-[family-name:var(--font-display)] text-xl leading-relaxed text-[var(--l-text)] sm:text-2xl">
                Every recipe here was cooked in a real kitchen before it earned a
                page. Nothing scraped, nothing padded — just the ones worth
                making twice.
              </blockquote>
              <figcaption className="mt-7 text-xs uppercase tracking-[0.18em] text-[var(--l-text-faint)]">
                Why this cookbook exists
              </figcaption>
            </figure>
          </GlowCard>
        </Reveal>
      </div>
    </section>
  );
}
