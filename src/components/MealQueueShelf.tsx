'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Clock, CalendarDays } from 'lucide-react';
import { sGet, sSet } from '@/lib/storage';

export type QueueItem = {
  slug: string;
  name: string;
  prepTime: number | null;
  cookTime: number | null;
};

export function addToQueue(item: QueueItem) {
  const q = sGet<QueueItem[]>('cookbook-queue') ?? [];
  if (q.some(i => i.slug === item.slug)) return;
  sSet('cookbook-queue', [...q, item]);
  window.dispatchEvent(new Event('cookbook-queue-change'));
}

export function removeFromQueue(slug: string) {
  const q = sGet<QueueItem[]>('cookbook-queue') ?? [];
  sSet('cookbook-queue', q.filter(i => i.slug !== slug));
  window.dispatchEvent(new Event('cookbook-queue-change'));
}

export function isInQueue(slug: string): boolean {
  const q = sGet<QueueItem[]>('cookbook-queue') ?? [];
  return q.some(i => i.slug === slug);
}

function fmtTime(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function MealQueueShelf() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [open, setOpen] = useState(true);

  const refresh = () => setQueue(sGet<QueueItem[]>('cookbook-queue') ?? []);

  useEffect(() => {
    refresh();
    window.addEventListener('cookbook-queue-change', refresh);
    return () => window.removeEventListener('cookbook-queue-change', refresh);
  }, []);

  if (queue.length === 0) return null;

  const totalMin = queue.reduce((t, i) => t + (i.prepTime ?? 0) + (i.cookTime ?? 0), 0);

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
      >
        <span className="flex items-center gap-2">
          <CalendarDays size={15} className="text-accent" />
          This Week&apos;s Plan
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent font-medium">
            {queue.length}
          </span>
        </span>
        <span className="flex items-center gap-3">
          {totalMin > 0 && (
            <span className="flex items-center gap-1 text-xs text-ink-muted font-normal">
              <Clock size={11} />
              {fmtTime(totalMin)} total
            </span>
          )}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="inline-flex">
            <ChevronDown size={14} />
          </motion.span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {queue.map(item => (
                <div key={item.slug} className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm">
                  <Link href={`/recipes/${item.slug}`} className="font-medium text-ink hover:text-accent transition-colors">
                    {item.name}
                  </Link>
                  {((item.prepTime ?? 0) + (item.cookTime ?? 0)) > 0 && (
                    <span className="text-xs text-ink-faint">
                      · {fmtTime((item.prepTime ?? 0) + (item.cookTime ?? 0))}
                    </span>
                  )}
                  <button onClick={() => removeFromQueue(item.slug)} className="ml-0.5 text-ink-faint hover:text-ink transition-colors">
                    <X size={11} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => { sSet('cookbook-queue', []); window.dispatchEvent(new Event('cookbook-queue-change')); }}
                className="rounded-full px-3 py-1 text-xs text-ink-faint hover:text-ink transition-colors"
              >
                Clear all
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
