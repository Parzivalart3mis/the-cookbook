'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';

type ViewedItem = { slug: string; name: string };

export default function RecentlyViewedShelf() {
  const [items, setItems] = useState<ViewedItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cookbook-recently-viewed');
      setItems(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

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
