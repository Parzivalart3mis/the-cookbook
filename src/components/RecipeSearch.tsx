'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, X, ChefHat, ChevronDown, Check, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RecipeSummary, Nutrition } from '@/lib/notion';
import { cn } from '@/lib/cn';
import { sGet, sSet } from '@/lib/storage';
import RecipeGrid from './RecipeGrid';
import CollectionShelf from './CollectionShelf';
import MealQueueShelf from './MealQueueShelf';

const ease = [0.22, 1, 0.36, 1] as const;

const SERVING_BUCKETS = [
  { label: '1–2', test: (n: number) => n <= 2 },
  { label: '3–4', test: (n: number) => n >= 3 && n <= 4 },
  { label: '5+',  test: (n: number) => n >= 5 },
] as const;

const NUTRITION_PRESETS: { label: string; test: (n: Nutrition) => boolean }[] = [
  { label: 'High Protein',   test: n => n.protein     !== null && n.protein     >= 20  },
  { label: 'Low Sodium',     test: n => n.sodium       !== null && n.sodium       <= 600 },
  { label: 'Under 500 cal',  test: n => n.calories     !== null && n.calories     < 500  },
  { label: 'Low Fat',        test: n => n.totalFat     !== null && n.totalFat     <= 10  },
  { label: 'High Fiber',     test: n => n.dietaryFiber !== null && n.dietaryFiber >= 5   },
];

// ── Dropdown shell ────────────────────────────────────────────────────────────

function FilterDropdown({
  label, badge, open, onToggle, onClose, children,
}: {
  label: string; badge?: number; open: boolean;
  onToggle: () => void; onClose: () => void; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          open || (badge && badge > 0)
            ? 'border-accent/50 bg-accent-light text-accent'
            : 'border-border bg-surface-card text-ink-muted hover:border-accent/30 hover:text-ink'
        )}
      >
        {label}
        {badge ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease }} className="inline-flex">
          <ChevronDown size={13} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease }}
            className="absolute left-0 top-full z-50 mt-2 min-w-[170px] rounded-xl border border-border bg-surface-card shadow-card-hover"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecipeSearch({
  recipes,
  initialTag,
}: {
  recipes: RecipeSummary[];
  initialTag?: string;
}) {
  const [query, setQuery]             = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(initialTag ? new Set([initialTag]) : new Set());
  const [servingBucket, setServingBucket] = useState<string | null>(null);
  const [nutritionFilter, setNutritionFilter] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'tags' | 'serves' | 'nutrition' | null>(null);
  const [pantryOpen, setPantryOpen]   = useState(false);
  const [pantryInput, setPantryInput] = useState('');
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(initialTag ?? null);

  // Load pantry from localStorage on mount
  useEffect(() => {
    const stored = sGet<string[]>('cookbook-pantry');
    if (stored?.length) {
      setPantryItems(stored);
      setPantryInput(stored.join(', '));
    }
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    recipes.forEach(r => r.tags.forEach(t => tags.add(t)));
    return [...tags].sort();
  }, [recipes]);

  const topCollections = useMemo(() => {
    const counts = new Map<string, number>();
    recipes.forEach(r => r.tags.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [recipes]);

  const showServings    = recipes.some(r => r.servings !== null);
  const hasNutrition    = recipes.some(r => Object.values(r.nutrition).some(v => v !== null));
  const hasActiveFilters = selectedTags.size > 0 || servingBucket !== null || nutritionFilter !== null || pantryItems.length > 0;
  const hasQuery        = query.trim().length > 0;

  const filtered = useMemo(() => {
    let result = recipes;

    const q = query.trim().toLowerCase();
    if (q) result = result.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q))
    );

    if (selectedTags.size > 0)
      result = result.filter(r => [...selectedTags].every(t => r.tags.includes(t)));

    if (servingBucket) {
      const bucket = SERVING_BUCKETS.find(b => b.label === servingBucket);
      if (bucket) result = result.filter(r => r.servings === null || bucket.test(r.servings));
    }

    if (nutritionFilter) {
      const preset = NUTRITION_PRESETS.find(p => p.label === nutritionFilter);
      if (preset) result = result.filter(r => preset.test(r.nutrition));
    }

    if (pantryItems.length > 0) {
      result = result.filter(r => {
        const haystack = [r.name, ...r.tags].join(' ').toLowerCase();
        return pantryItems.some(item => item.trim() && haystack.includes(item.trim().toLowerCase()));
      });
    }

    return result;
  }, [recipes, query, selectedTags, servingBucket, nutritionFilter, pantryItems]);

  function toggleTag(tag: string) {
    setActiveCollection(null);
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function selectCollection(tag: string | null) {
    setActiveCollection(tag);
    setSelectedTags(tag ? new Set([tag]) : new Set());
  }

  function clearFilters() {
    setSelectedTags(new Set());
    setServingBucket(null);
    setNutritionFilter(null);
    setPantryItems([]);
    setPantryInput('');
    setActiveCollection(null);
    sSet('cookbook-pantry', []);
  }

  function handlePantryChange(val: string) {
    setPantryInput(val);
    const items = val.split(',').map(s => s.trim()).filter(Boolean);
    setPantryItems(items);
    sSet('cookbook-pantry', items);
  }

  const closeDropdown = useCallback(() => setOpenDropdown(null), []);
  const showEmpty = (hasQuery || hasActiveFilters) && filtered.length === 0;

  return (
    <div>
      <MealQueueShelf />

      {topCollections.length > 0 && (
        <CollectionShelf tags={topCollections} selected={activeCollection} onSelect={selectCollection} />
      )}

      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="relative mb-4 max-w-sm"
      >
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          placeholder="Search recipes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-card py-2 pl-9 pr-8 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 transition-colors duration-150"
        />
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

      {/* Filter row */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease }}
        className="mb-6 flex flex-wrap items-center gap-2"
      >
        {/* Tags */}
        {allTags.length > 0 && (
          <FilterDropdown
            label="Tags"
            badge={selectedTags.size || undefined}
            open={openDropdown === 'tags'}
            onToggle={() => setOpenDropdown(o => o === 'tags' ? null : 'tags')}
            onClose={closeDropdown}
          >
            <div className="p-1.5 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
              {allTags.map(tag => {
                const active = selectedTags.has(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100"
                  >
                    <span className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150',
                      active ? 'border-accent bg-accent' : 'border-border bg-surface'
                    )}>
                      {active && <Check size={10} className="text-white" strokeWidth={3} />}
                    </span>
                    {tag}
                  </button>
                );
              })}
            </div>
          </FilterDropdown>
        )}

        {/* Serves */}
        {showServings && (
          <FilterDropdown
            label="Serves"
            badge={servingBucket ? 1 : undefined}
            open={openDropdown === 'serves'}
            onToggle={() => setOpenDropdown(o => o === 'serves' ? null : 'serves')}
            onClose={closeDropdown}
          >
            <div className="p-1.5 flex flex-col gap-0.5">
              {SERVING_BUCKETS.map(bucket => {
                const active = servingBucket === bucket.label;
                return (
                  <button
                    key={bucket.label}
                    onClick={() => { setServingBucket(active ? null : bucket.label); closeDropdown(); }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100"
                  >
                    <span className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
                      active ? 'border-accent bg-accent' : 'border-border bg-surface'
                    )}>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    {bucket.label} servings
                  </button>
                );
              })}
            </div>
          </FilterDropdown>
        )}

        {/* Nutrition */}
        {hasNutrition && (
          <FilterDropdown
            label="Nutrition"
            badge={nutritionFilter ? 1 : undefined}
            open={openDropdown === 'nutrition'}
            onToggle={() => setOpenDropdown(o => o === 'nutrition' ? null : 'nutrition')}
            onClose={closeDropdown}
          >
            <div className="p-1.5 flex flex-col gap-0.5">
              {NUTRITION_PRESETS.map(preset => {
                const active = nutritionFilter === preset.label;
                return (
                  <button
                    key={preset.label}
                    onClick={() => { setNutritionFilter(active ? null : preset.label); closeDropdown(); }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100"
                  >
                    <span className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
                      active ? 'border-accent bg-accent' : 'border-border bg-surface'
                    )}>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </FilterDropdown>
        )}

        {/* Pantry toggle */}
        <button
          onClick={() => setPantryOpen(o => !o)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150',
            pantryOpen || pantryItems.length > 0
              ? 'border-accent/50 bg-accent-light text-accent'
              : 'border-border bg-surface-card text-ink-muted hover:border-accent/30 hover:text-ink'
          )}
        >
          <Leaf size={13} />
          Pantry
          {pantryItems.length > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
              {pantryItems.length}
            </span>
          )}
        </button>

        {/* Active summary + clear */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.2, ease }}
              className="flex items-center gap-2 ml-1"
            >
              <span className="text-xs text-ink-faint">
                {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}
              </span>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors duration-150"
              >
                <X size={11} />
                Clear
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Pantry drawer */}
      <AnimatePresence>
        {pantryOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-6"
          >
            <div className="rounded-xl border border-border bg-surface-card p-4">
              <p className="text-sm font-semibold text-ink mb-1 flex items-center gap-1.5">
                <Leaf size={13} className="text-accent" />
                What&apos;s in your pantry?
              </p>
              <p className="text-xs text-ink-muted mb-3">
                Comma-separated ingredients. Recipes matching any of them will show up.
              </p>
              <input
                type="text"
                placeholder="chicken, pasta, garlic, olive oil…"
                value={pantryInput}
                onChange={e => handlePantryChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence mode="wait">
        {showEmpty ? (
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
              {hasQuery ? `Nothing matches "${query.trim()}".` : 'No recipes match the selected filters.'}
              {hasActiveFilters && (
                <>{' '}<button onClick={clearFilters} className="text-accent underline underline-offset-2 hover:text-accent-hover transition-colors duration-150">Clear filters</button></>
              )}
            </p>
          </motion.div>
        ) : (
          <motion.div key="grid" initial={false} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <RecipeGrid recipes={filtered} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
