'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, FlaskConical } from 'lucide-react';
import NutritionFacts from './NutritionFacts';
import type { Nutrition } from '@/lib/notion';
import { useState } from 'react';

export default function NutritionModal({
  nutrition,
  servings,
}: {
  nutrition: Nutrition;
  servings: number | null;
}) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const hasAny = Object.values(nutrition).some((v) => v !== null);
  if (!hasAny) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 hover:text-accent transition-colors duration-150 text-sm"
      >
        <FlaskConical size={13} />
        Nutrition
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Panel */}
            <motion.div
              className="relative z-10 w-full max-w-xs max-h-[90dvh] overflow-y-auto rounded-lg shadow-2xl"
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-2 right-2 z-20 rounded-full bg-white/80 p-1 text-black hover:bg-white transition-colors"
                aria-label="Close nutrition panel"
              >
                <X size={14} />
              </button>
              <NutritionFacts nutrition={nutrition} servings={servings} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
