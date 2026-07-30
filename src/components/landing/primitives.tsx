'use client';

/**
 * Shared motion + visual primitives for the landing page.
 * Every piece here is theme-independent (scoped under `.landing`)
 * and respects `prefers-reduced-motion`.
 */

import {
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useReducedMotion,
  animate,
  type Variants,
} from 'framer-motion';

/** Shared cinematic easing — slow out, fast settle. */
export const EASE = [0.16, 1, 0.3, 1] as const;

// ── Scroll reveal ────────────────────────────────────────────────────────────

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

/**
 * Fades + lifts its children into view once, when scrolled to.
 * `delay` staggers siblings manually; `as` keeps semantics correct.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={revealVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: '-80px' }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Container that staggers any `Reveal`-less motion children. */
export function Stagger({
  children,
  className,
  gap = 0.08,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

/** Child of `Stagger`. */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={revealVariants}
      transition={{ duration: 0.8, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// ── Spotlight glass card ─────────────────────────────────────────────────────

/**
 * Glassmorphic panel with a cursor-tracking glow.
 * Pointer position is written to CSS vars so the glow costs no re-renders.
 */
export function GlowCard({
  children,
  className = '',
  glow = 'var(--l-ember)',
}: {
  children: ReactNode;
  className?: string;
  glow?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={`group relative overflow-hidden rounded-3xl border border-[var(--l-line)] bg-[var(--l-raise)]/60 backdrop-blur-xl transition-colors duration-500 hover:border-[var(--l-line-strong)] ${className}`}
      style={{ ['--glow' as string]: glow }}
    >
      {/* Cursor spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(360px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, var(--glow) 16%, transparent), transparent 70%)',
        }}
      />
      {/* Top edge highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in oklab, var(--glow) 55%, transparent), transparent)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

// ── Magnetic button ──────────────────────────────────────────────────────────

/**
 * Button that leans toward the cursor on hover. Springs back on leave.
 */
export function Magnetic({
  children,
  className,
  strength = 0.35,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

  function handleMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Count-up number ──────────────────────────────────────────────────────────

/**
 * Counts from 0 → `value` when scrolled into view.
 */
export function CountUp({
  value,
  duration = 1.8,
  suffix = '',
  className,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, duration, reduced]);

  // Reduced motion skips the tween entirely rather than animating to the value.
  const shown = reduced ? value : display;

  return (
    <span ref={ref} className={className}>
      {shown}
      {suffix}
    </span>
  );
}

// ── Eyebrow label ────────────────────────────────────────────────────────────

export function Eyebrow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--l-line)] bg-[var(--l-raise)]/50 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--l-text-muted)] backdrop-blur-md ${className}`}
    >
      {children}
    </span>
  );
}

// ── Ambient background layers ────────────────────────────────────────────────

/** Drifting aurora blobs — the primary light source of the page. */
export function Aurora({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div
        className="absolute -top-[30%] left-[5%] h-[70vh] w-[70vh] rounded-full blur-[130px]"
        style={{
          background:
            'radial-gradient(circle, rgba(245,158,11,0.5), rgba(245,158,11,0) 65%)',
          animation: 'landing-aurora 22s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -right-[10%] top-[10%] h-[60vh] w-[60vh] rounded-full blur-[130px]"
        style={{
          background:
            'radial-gradient(circle, rgba(249,115,22,0.4), rgba(249,115,22,0) 65%)',
          animation: 'landing-aurora 28s ease-in-out infinite reverse',
        }}
      />
      <div
        className="absolute bottom-[-20%] left-[30%] h-[55vh] w-[55vh] rounded-full blur-[140px]"
        style={{
          background:
            'radial-gradient(circle, rgba(180,83,9,0.45), rgba(180,83,9,0) 70%)',
          animation: 'landing-aurora 34s ease-in-out infinite',
          animationDelay: '-8s',
        }}
      />
    </div>
  );
}

/** Fine grain overlay — kills gradient banding, adds filmic texture. */
export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.16] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

/** Perspective grid floor — depth cue under the hero. */
export function GridFloor() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh] overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(245,158,11,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.16) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          transform: 'perspective(340px) rotateX(58deg)',
          transformOrigin: 'bottom center',
        }}
      />
    </div>
  );
}
