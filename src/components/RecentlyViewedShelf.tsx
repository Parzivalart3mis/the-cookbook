'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';

type ViewedItem = { slug: string; name: string };

const STORAGE_KEY = 'cookbook-recently-viewed';
const EMPTY: ViewedItem[] = [];

/** Memoised on the raw string so getSnapshot returns a stable reference. */
let cachedRaw: string | null = null;
let cachedItems: ViewedItem[] = EMPTY;

function getViewedItems(): ViewedItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = raw ? JSON.parse(raw) : EMPTY;
      cachedItems = Array.isArray(parsed) ? parsed : EMPTY;
    } catch {
      cachedItems = EMPTY;
    }
  }
  return cachedItems;
}

function subscribeToViewed(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export default function RecentlyViewedShelf() {
  const items = useSyncExternalStore(subscribeToViewed, getViewedItems, () => EMPTY);

  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-widest mb-2 flex items-center gap-1.5">
        <History size={11} />
        Recently Viewed
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <Link
            key={item.slug}
            href={`/recipes/${item.slug}`}
            className="rounded-full border border-border bg-surface-card px-3 py-1 text-sm text-ink-muted hover:text-ink hover:border-accent/30 transition-colors duration-150"
          >
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
