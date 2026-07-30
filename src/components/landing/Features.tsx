'use client';

import {
  Mic,
  CalendarRange,
  Activity,
  ShoppingCart,
  Shuffle,
  RefreshCw,
  MonitorSmartphone,
  type LucideIcon,
} from 'lucide-react';
import { Reveal, Stagger, StaggerItem, GlowCard, Eyebrow } from './primitives';

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Tailwind grid span for the bento layout. */
  span: string;
  glow?: string;
};

/** Edit this array to change the grid — layout adapts automatically. */
const FEATURES: Feature[] = [
  {
    icon: Mic,
    title: 'Ask mid-cook',
    body: 'Hands covered in flour? Tap once and ask out loud. It answers from the recipe you are standing in — and reads it back to you.',
    span: 'md:col-span-4 lg:col-span-3 lg:row-span-2',
    glow: 'var(--l-ember-hot)',
  },
  {
    icon: CalendarRange,
    title: 'Plan the whole week',
    body: 'Drop recipes onto days, then turn the week into one shopping list.',
    span: 'md:col-span-2 lg:col-span-3',
  },
  {
    icon: Activity,
    title: '20 nutrients, per serving',
    body: 'Calories to vitamin D — tracked, scaled, and filterable.',
    span: 'md:col-span-2 lg:col-span-3',
  },
  {
    icon: RefreshCw,
    title: 'Write in Notion. Live in 60 seconds.',
    body: 'Your database is the source of truth. Edit a recipe there and it appears here — no export, no copy-paste, no second system to maintain.',
    span: 'md:col-span-4 lg:col-span-4',
    glow: 'var(--l-plasma)',
  },
  {
    icon: Shuffle,
    title: 'Out of cream?',
    body: 'Get a substitution and what it changes.',
    span: 'md:col-span-2 lg:col-span-2',
  },
  {
    icon: ShoppingCart,
    title: 'Sorted by aisle',
    body: 'Ingredients auto-grouped into produce, dairy, pantry.',
    span: 'md:col-span-3 lg:col-span-3',
  },
  {
    icon: MonitorSmartphone,
    title: 'Screen never sleeps',
    body: 'The page stays lit while your hands are busy.',
    span: 'md:col-span-3 lg:col-span-3',
  },
];

export default function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 px-5 py-28 sm:px-8 sm:py-36">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>What&apos;s inside</Eyebrow>
          <h2 className="mt-6 font-[family-name:var(--font-display)] text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--l-text)]">
            Built for the ten minutes
            <br />
            <span className="bg-gradient-to-r from-[var(--l-ember-hot)] to-[var(--l-plasma)] bg-clip-text text-transparent">
              that actually matter.
            </span>
          </h2>
          <p className="mt-5 text-balance text-[var(--l-text-muted)]">
            Not a recipe archive. A kitchen tool that knows what you are cooking
            and gets out of the way.
          </p>
        </Reveal>

        {/* Bento grid */}
        <Stagger
          className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12"
          gap={0.07}
        >
          {FEATURES.map(({ icon: Icon, title, body, span, glow }) => (
            <StaggerItem key={title} className={span}>
              <GlowCard glow={glow} className="h-full">
                <div className="flex h-full flex-col p-7">
                  <div
                    className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--l-line)] bg-[var(--l-void)]/50"
                    style={{
                      boxShadow:
                        '0 0 24px -8px color-mix(in oklab, var(--glow) 60%, transparent)',
                    }}
                  >
                    <Icon size={19} className="text-[var(--l-ember-hot)]" />
                  </div>

                  <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold leading-snug tracking-[-0.01em] text-[var(--l-text)]">
                    {title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[var(--l-text-muted)]">
                    {body}
                  </p>
                </div>
              </GlowCard>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
