'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { sGet } from '@/lib/storage';
import type { RecipeSummary } from '@/lib/notion';

type CookedMap = Record<string, string>;

export default function RecentlyCookedSection({ recipes }: { recipes: RecipeSummary[] }) {
  const [recent, setRecent] = useState<{ recipe: RecipeSummary; date: Date }[]>([]);

  useEffect(() => {
    const map = sGet<CookedMap>('cookbook-cooked') ?? {};
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const items = Object.entries(map)
      .filter(([, iso]) => new Date(iso).getTime() > cutoff)
      .map(([slug, iso]) => {
        const recipe = recipes.find(r => r.slug === slug);
        return recipe ? { recipe, date: new Date(iso) } : null;
      })
      .filter(Boolean) as { recipe: RecipeSummary; date: Date }[];
    items.sort((a, b) => b.date.getTime() - a.date.getTime());
    setRecent(items);
  }, [recipes]);

  if (recent.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-3">Recently Cooked</h2>
      <div className="rounded-xl border border-border bg-surface-card px-4">
        {recent.map(({ recipe, date }) => (
          <div key={recipe.id} className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
            <div>
              <Link href={`/recipes/${recipe.slug}`} className="font-medium text-ink hover:text-accent transition-colors duration-150">
                {recipe.name}
              </Link>
              <p className="text-xs text-ink-muted mt-0.5">
                Cooked {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
            <CheckCircle2 size={16} className="text-green-500 shrink-0" />
          </div>
        ))}
      </div>
    </section>
  );
}
