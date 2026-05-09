'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UtensilsCrossed, Bookmark, BookmarkCheck, ShoppingCart, Check } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import CookMode from './CookMode';
import { addToQueue, removeFromQueue, isInQueue } from './MealQueueShelf';
import { sGet, sSet } from '@/lib/storage';

type ShoppingItem = {
  id: string;
  text: string;
  category: string;
  checked: boolean;
  recipeName: string;
};

const CATEGORIES: [string, string[]][] = [
  ['Produce', ['tomato', 'onion', 'garlic', 'pepper', 'lettuce', 'spinach', 'carrot', 'celery', 'potato', 'lemon', 'lime', 'mushroom', 'zucchini', 'cucumber', 'avocado', 'broccoli', 'kale', 'basil', 'cilantro', 'parsley', 'ginger', 'apple', 'banana', 'berry', 'mint', 'shallot', 'leek', 'cabbage']],
  ['Protein', ['chicken', 'beef', 'pork', 'fish', 'shrimp', 'tofu', 'tempeh', 'egg', 'salmon', 'tuna', 'lamb', 'turkey', 'bacon', 'sausage', 'beans', 'lentils', 'chickpea', 'prawn', 'steak', 'mince', 'ground beef', 'ground turkey']],
  ['Dairy', ['milk', 'butter', 'cream', 'cheese', 'yogurt', 'parmesan', 'mozzarella', 'cheddar', 'sour cream', 'ghee', 'ricotta', 'feta', 'brie', 'gouda', 'half-and-half']],
  ['Pantry', ['flour', 'sugar', 'oil', 'vinegar', 'sauce', 'pasta', 'rice', 'bread', 'broth', 'stock', 'canned', 'tomato paste', 'coconut milk', 'soy sauce', 'honey', 'maple syrup', 'oats', 'nuts', 'seeds', 'cornstarch', 'baking', 'vanilla', 'noodle', 'cracker', 'breadcrumb']],
  ['Spices', ['salt', 'pepper', 'cumin', 'paprika', 'oregano', 'thyme', 'rosemary', 'cinnamon', 'turmeric', 'cayenne', 'chili', 'bay leaf', 'seasoning', 'powder', 'flake', 'cardamom', 'clove', 'nutmeg', 'allspice', 'anise']],
];

function categorize(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of CATEGORIES) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'Other';
}

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
  const [cookModeOpen, setCookModeOpen] = useState(false);
  const [inQueue, setInQueue] = useState(() => isInQueue(slug));
  const [shoppingDone, setShoppingDone] = useState<number | false>(false);

  function toggleQueue() {
    if (inQueue) {
      removeFromQueue(slug);
    } else {
      addToQueue({ slug, name, prepTime, cookTime });
    }
    setInQueue(q => !q);
  }

  function addShopping() {
    const existing = sGet<ShoppingItem[]>('cookbook-shopping') ?? [];
    const seen = new Set(existing.map(i => i.text.toLowerCase()));
    const newItems: ShoppingItem[] = [];
    for (const block of blocks) {
      if (block.type !== 'bulleted_list_item' && block.type !== 'numbered_list_item') continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rich = (block as any)[block.type]?.rich_text ?? [];
      const text = rich.map((r: { plain_text: string }) => r.plain_text).join('').trim();
      if (!text || seen.has(text.toLowerCase())) continue;
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text,
        category: categorize(text),
        checked: false,
        recipeName: name,
      });
    }
    sSet('cookbook-shopping', [...existing, ...newItems]);
    setShoppingDone(newItems.length);
    setTimeout(() => setShoppingDone(false), 3000);
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mt-4">
        <button
          onClick={() => setCookModeOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm font-semibold transition-colors duration-150"
        >
          <UtensilsCrossed size={14} />
          Cook Mode
        </button>

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

        {shoppingDone !== false ? (
          <Link
            href="/shopping-list"
            className="flex items-center gap-1.5 rounded-xl border border-green-500/50 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-600 transition-colors duration-150 hover:bg-green-500/20"
          >
            <Check size={14} />
            {shoppingDone > 0 ? `Added ${shoppingDone} item${shoppingDone !== 1 ? 's' : ''} · View list` : 'Already in list'}
          </Link>
        ) : (
          <button
            onClick={addShopping}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-150 hover:border-accent/30 hover:text-ink"
          >
            <ShoppingCart size={14} />
            Shopping List
          </button>
        )}
      </div>

      <AnimatePresence>
        {cookModeOpen && (
          <CookMode
            blocks={blocks}
            recipeName={name}
            prepTime={prepTime}
            cookTime={cookTime}
            onClose={() => setCookModeOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
