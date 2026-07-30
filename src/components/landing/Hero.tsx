'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChefHat, Sparkles, ChevronDown } from 'lucide-react';
import { Aurora, GridFloor, Eyebrow, Magnetic, EASE } from './primitives';

/** Ambient depth: real recipe names drifting behind the headline. */
const CONSTELLATION = [
  { top: '18%', left: '6%', depth: 0.5, delay: 0 },
  { top: '30%', left: '82%', depth: 0.8, delay: 0.6 },
  { top: '62%', left: '10%', depth: 0.65, delay: 1.2 },
  { top: '72%', left: '78%', depth: 0.4, delay: 0.3 },
  { top: '44%', left: '90%', depth: 0.55, delay: 1.6 },
  { top: '82%', left: '38%', depth: 0.7, delay: 0.9 },
];

export default function Hero({
  recipeNames,
  recipeCount,
}: {
  recipeNames: string[];
  recipeCount: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // Foreground drifts up and dissolves; background lags behind → parallax depth.
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '38%']);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  const headline = ['Your', 'kitchen,'];

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 pb-24 pt-28 sm:px-8"
    >
      {/* ── Background layers ── */}
      <motion.div style={reduced ? undefined : { y: bgY, scale }} className="absolute inset-0">
        <Aurora />
        <GridFloor />
      </motion.div>

      {/* Vignette — pulls focus to the centre */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 55% at 50% 45%, transparent 0%, rgba(10,7,5,0.55) 70%, var(--l-void) 100%)',
        }}
      />

      {/* ── Floating recipe constellation (desktop only) ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        {CONSTELLATION.map((pos, i) => {
          const name = recipeNames[i % Math.max(recipeNames.length, 1)];
          if (!name) return null;
          return (
            <motion.div
              key={`${name}-${i}`}
              className="absolute"
              style={{ top: pos.top, left: pos.left }}
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={{ opacity: pos.depth * 0.65, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 1.4, delay: 1 + pos.delay, ease: EASE }}
            >
              <div
                className="rounded-full border border-[var(--l-line)] bg-[var(--l-raise)]/40 px-4 py-2 backdrop-blur-md"
                style={{
                  transform: `scale(${0.8 + pos.depth * 0.25})`,
                  animation: reduced
                    ? undefined
                    : `landing-float ${7 + i * 1.3}s ease-in-out ${pos.delay}s infinite`,
                }}
              >
                <span className="whitespace-nowrap text-xs font-medium text-[var(--l-text-muted)]">
                  {name}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Foreground content ── */}
      <motion.div
        style={reduced ? undefined : { y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <Eyebrow>
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full rounded-full bg-[var(--l-ember)]"
                style={{ animation: 'landing-pulse-ring 2.4s ease-out infinite' }}
              />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--l-ember)]" />
            </span>
            Synced live from Notion
          </Eyebrow>
        </motion.div>

        {/* Headline — word-by-word mask reveal */}
        <h1 className="mt-8 font-[family-name:var(--font-display)] text-[clamp(2.75rem,9vw,7rem)] font-semibold leading-[0.95] tracking-[-0.03em] text-[var(--l-text)]">
          <span className="block">
            {headline.map((word, i) => (
              <span key={word} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
                <motion.span
                  className="inline-block"
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1.1, delay: 0.15 + i * 0.09, ease: EASE }}
                >
                  {word}
                  {i < headline.length - 1 && ' '}
                </motion.span>
              </span>
            ))}
          </span>
          <span className="block overflow-hidden pb-[0.1em]">
            <motion.span
              className="inline-block bg-gradient-to-br from-[var(--l-ember-hot)] via-[var(--l-ember)] to-[var(--l-plasma)] bg-clip-text text-transparent"
              initial={{ y: '110%' }}
              animate={{ y: 0 }}
              transition={{ duration: 1.1, delay: 0.34, ease: EASE }}
            >
              perfectly remembered.
            </motion.span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: EASE }}
          className="mt-7 max-w-xl text-balance text-base leading-relaxed text-[var(--l-text-muted)] sm:text-lg"
        >
          A private cookbook that plans your week, tracks every macro, and talks
          you through dinner — hands-free.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.75, ease: EASE }}
          className="mt-11 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Magnetic>
            <Link
              href="/"
              className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-r from-[var(--l-ember-hot)] to-[var(--l-plasma)] px-8 py-4 text-sm font-semibold text-[#1a0f02] shadow-[0_0_40px_-8px_rgba(245,158,11,0.65)] transition-shadow duration-300 hover:shadow-[0_0_60px_-6px_rgba(245,158,11,0.85)]"
            >
              {/* Sheen sweep on hover */}
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              />
              <ChefHat size={17} className="relative" />
              <span className="relative">Browse {recipeCount} recipes</span>
              <ArrowRight
                size={16}
                className="relative transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </Magnetic>

          <Magnetic strength={0.2}>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--l-line-strong)] bg-[var(--l-raise)]/40 px-7 py-4 text-sm font-medium text-[var(--l-text)] backdrop-blur-xl transition-colors duration-300 hover:border-[var(--l-ember)]/45 hover:bg-[var(--l-raise)]/70"
            >
              <Sparkles size={15} className="text-[var(--l-ember)]" />
              See how it works
            </a>
          </Magnetic>
        </motion.div>
      </motion.div>

      {/* ── Scroll cue ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.6 }}
        style={reduced ? undefined : { opacity: contentOpacity }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <motion.div
          animate={reduced ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--l-text-faint)]">
            Scroll
          </span>
          <ChevronDown size={15} className="text-[var(--l-text-faint)]" />
        </motion.div>
      </motion.div>
    </section>
  );
}
