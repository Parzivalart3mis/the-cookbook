'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const ease = [0.22, 1, 0.36, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

export function MotionPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

export function BackLink() {
  return (
    <motion.div variants={item} className="mb-10">
      <Link
        href="/"
        className="group inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-accent transition-colors duration-150"
      >
        <motion.span
          className="inline-flex"
          whileHover={{ x: -3 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <ArrowLeft size={14} />
        </motion.span>
        All recipes
      </Link>
    </motion.div>
  );
}
