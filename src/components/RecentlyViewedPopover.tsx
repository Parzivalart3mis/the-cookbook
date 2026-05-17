'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';

const ease = [0.22, 1, 0.36, 1] as const;

type ViewedItem = { slug: string; name: string };

export default function RecentlyViewedPopover() {
  const [items, setItems] = useState<ViewedItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cookbook-recently-viewed');
      setItems(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        title="Recently viewed"
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors duration-150',
          open
            ? 'border-accent/50 bg-accent-light text-accent'
            : 'border-border bg-surface-card text-ink-muted hover:border-accent/30 hover:text-ink'
        )}
      >
        <History size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease }}
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-surface-card shadow-card-hover"
          >
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Recently Viewed</p>
            </div>
            <div className="p-1.5 flex flex-col gap-0.5 max-h-72 overflow-y-auto">
              {items.map(item => (
                <Link
                  key={item.slug}
                  href={`/recipes/${item.slug}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100 truncate"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
