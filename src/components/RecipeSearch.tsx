'use client';

import { useState, useMemo } from 'react';
import { Search, X, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RecipeSummary } from '@/lib/notion';
import RecipeGrid from './RecipeGrid';

const ease = [0.22, 1, 0.36, 1] as const;

export default function RecipeSearch({ recipes }: { recipes: RecipeSummary[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, query]);

  const hasQuery = query.trim().length > 0;

  return (
    <div>
      {/* Search bar — slides down on mount */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="relative mb-8 max-w-sm"
      >
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          type="search"
          placeholder="Search recipes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-card py-2 pl-9 pr-8 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors duration-150"
        />
        {/* Clear button — pops in/out */}
        <AnimatePresence>
          {hasQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors duration-150"
            >
              <X size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Grid ↔ empty-state crossfade */}
      <AnimatePresence mode="wait">
        {hasQuery && filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease }}
            className="flex flex-col items-center justify-center py-24 gap-4 text-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, ease }}
              className="w-14 h-14 rounded-2xl bg-accent-light flex items-center justify-center"
            >
              <ChefHat size={24} className="text-accent" />
            </motion.div>
            <p className="font-display text-xl font-medium text-ink">No recipes found</p>
            <p className="text-ink-muted text-sm max-w-xs">
              Nothing matches &ldquo;{query.trim()}&rdquo;. Try a different name.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={false}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <RecipeGrid recipes={filtered} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
