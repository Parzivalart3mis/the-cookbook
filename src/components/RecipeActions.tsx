'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bookmark, BookmarkCheck, ShoppingCart, Check } from 'lucide-react';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { useQueue } from './QueueProvider';
import { useAuth } from '@clerk/nextjs';
import MarkCookedButton from './MarkCookedButton';
import { extractIngredients, categorize } from '@/lib/ingredients';

export default function RecipeActions({
  blocks,
  slug,
  name,
  prepTime,
  cookTime,
}: {
  blocks: BlockObjectResponse[];
  slug: string;
  name: string;
  prepTime: number | null;
  cookTime: number | null;
}) {
  const [shoppingDone, setShoppingDone] = useState<boolean | null>(null);
  const [shoppingError, setShoppingError] = useState(false);
  const { isSignedIn } = useAuth();
  const { addToQueue, removeFromQueue, isInQueue } = useQueue();
  const inQueue = isInQueue(slug);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cookbook-recently-viewed');
      const list: { slug: string; name: string }[] = raw ? JSON.parse(raw) : [];
      const updated = [{ slug, name }, ...list.filter(r => r.slug !== slug)].slice(0, 6);
      localStorage.setItem('cookbook-recently-viewed', JSON.stringify(updated));
    } catch {}
  }, [slug, name]);

  function toggleQueue() {
    if (inQueue) {
      removeFromQueue(slug);
    } else {
      addToQueue({ slug, name, prepTime, cookTime });
    }
  }

  async function addShopping() {
    setShoppingError(false);
    const ingredients = extractIngredients(blocks);
    if (ingredients.length === 0) {
      setShoppingError(true);
      setTimeout(() => setShoppingError(false), 4000);
      return;
    }
    const items = ingredients.map(text => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      category: categorize(text),
      recipeName: name,
    }));
    try {
      const res = await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error();
      setShoppingDone(true);
      setTimeout(() => setShoppingDone(null), 3000);
    } catch {
      setShoppingError(true);
      setTimeout(() => setShoppingError(false), 4000);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mt-4">
        {isSignedIn && <MarkCookedButton slug={slug} />}
        {isSignedIn && (
          <button
            onClick={toggleQueue}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              inQueue
                ? 'border-accent/50 bg-accent-light text-accent'
                : 'border-border text-ink-muted hover:border-accent/30 hover:text-ink'
            }`}
          >
            {inQueue ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {inQueue ? 'In Queue' : 'Add to Queue'}
          </button>
        )}

        {isSignedIn && (
          shoppingDone ? (
            <Link
              href="/shopping-list"
              className="flex items-center gap-1.5 rounded-xl border border-green-500/50 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-600 transition-colors duration-150 hover:bg-green-500/20"
            >
              <Check size={14} />
              Added · View list
            </Link>
          ) : shoppingError ? (
            <span className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-sm font-medium text-red-500">
              No ingredients found
            </span>
          ) : (
            <button
              onClick={addShopping}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-150 hover:border-accent/30 hover:text-ink"
            >
              <ShoppingCart size={14} />
              Shopping List
            </button>
          )
        )}
      </div>

    </>
  );
}
