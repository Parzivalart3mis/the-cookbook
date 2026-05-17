'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { History, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';

const ease = [0.22, 1, 0.36, 1] as const;

type ViewedItem = { slug: string; name: string };

export default function RecentlyViewedPopover() {
  const [items, setItems] = useState<ViewedItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cookbook-recently-viewed');
      setItems(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

  if (items.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Recently viewed"
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors duration-150 shrink-0',
          open
            ? 'border-accent/50 bg-accent-light text-accent'
            : 'border-border bg-surface-card text-ink-muted hover:border-accent/30 hover:text-ink'
        )}
      >
        <History size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Modal card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.22, ease }}
              className="relative w-full max-w-sm bg-surface rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <History size={15} className="text-accent" />
                  <h3 className="font-semibold text-ink">Recently Viewed</h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* List */}
              <div className="p-2 flex flex-col gap-0.5 max-h-80 overflow-y-auto">
                {items.map((item, i) => (
                  <Link
                    key={item.slug}
                    href={`/recipes/${item.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-surface-hover transition-colors duration-100 group"
                  >
                    <span className="text-xs tabular-nums text-ink-faint w-4 shrink-0">{i + 1}</span>
                    <span className="text-sm text-ink group-hover:text-accent transition-colors duration-100 truncate">
                      {item.name}
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
