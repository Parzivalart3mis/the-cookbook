'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { ChefHat, ArrowRight } from 'lucide-react';
import { EASE } from './primitives';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Recipes', href: '/' },
  { label: 'Meal plan', href: '/meal-plan' },
];

export default function Nav() {
  const [condensed, setCondensed] = useState(false);
  const { scrollY } = useScroll();

  // Condense into a glass pill once the hero starts leaving.
  useMotionValueEvent(scrollY, 'change', (v) => setCondensed(v > 80));

  return (
    <motion.header
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <motion.nav
        animate={{
          maxWidth: condensed ? 660 : 1152,
          backgroundColor: condensed ? 'rgba(29,23,18,0.72)' : 'rgba(29,23,18,0)',
          borderColor: condensed ? 'rgba(255,226,183,0.14)' : 'rgba(255,226,183,0)',
        }}
        transition={{ duration: 0.55, ease: EASE }}
        className="flex w-full items-center justify-between gap-6 rounded-full border px-4 py-2.5 backdrop-blur-xl sm:px-5"
      >
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <ChefHat
            size={19}
            className="text-[var(--l-ember)] transition-transform duration-300 group-hover:-rotate-12"
          />
          <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-[var(--l-text)]">
            The Cookbook
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="group relative text-sm text-[var(--l-text-muted)] transition-colors duration-200 hover:text-[var(--l-text)]"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-[var(--l-ember)] transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </div>

        <Link
          href="/"
          className="group flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--l-line-strong)] bg-[var(--l-raise)]/60 px-4 py-2 text-xs font-medium text-[var(--l-text)] backdrop-blur-md transition-colors duration-300 hover:border-[var(--l-ember)]/50 hover:bg-[var(--l-raise)]"
        >
          Open app
          <ArrowRight
            size={13}
            className="transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </Link>
      </motion.nav>
    </motion.header>
  );
}
