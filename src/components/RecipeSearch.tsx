'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ChefHat, ChevronDown, Check, Wand2, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RecipeSummary, Nutrition } from '@/lib/notion';
import { cn } from '@/lib/cn';
import RecipeGrid from './RecipeGrid';
import MealQueueShelf from './MealQueueShelf';
import RecentlyViewedPopover from './RecentlyViewedPopover';

const ease = [0.22, 1, 0.36, 1] as const;

/** Module scope: random selection is impure and must not sit in render scope. */
function pickRandom<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

const ALL_MEAL_TYPES = [
  'Breakfast', 'Lunch', 'Dinner', 'Meal Prep',
  'Snack', 'Dessert', 'Drink', 'Side Dish',
];

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

export default function RecipeSearch({
  recipes,
  initialTag,
}: {
  recipes: RecipeSummary[];
  initialTag?: string;
}) {
  const [query, setQuery]                     = useState('');
  const [selectedTags, setSelectedTags]       = useState<Set<string>>(initialTag ? new Set([initialTag]) : new Set<string>());
  const [selectedMeals, setSelectedMeals]     = useState<Set<string>>(new Set());
  const [servingBucket, setServingBucket]     = useState<string | null>(null);
  const [nutritionFilter, setNutritionFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen]           = useState(false);
  const [surpriseOpen, setSurpriseOpen]       = useState(false);
  const [surpriseMsg, setSurpriseMsg]         = useState<string | null>(null);
  const filterRef   = useRef<HTMLDivElement>(null);
  const surpriseRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!filterOpen) return;
    function h(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [filterOpen]);

  useEffect(() => {
    if (!surpriseOpen) return;
    function h(e: MouseEvent) {
      if (surpriseRef.current && !surpriseRef.current.contains(e.target as Node)) {
        setSurpriseOpen(false);
        setSurpriseMsg(null);
      }
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [surpriseOpen]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    recipes.forEach(r => r.tags.forEach(t => tags.add(t)));
    return [...tags].sort();
  }, [recipes]);

  const mealTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    recipes.forEach(r => r.mealTypes.forEach(mt => counts.set(mt, (counts.get(mt) ?? 0) + 1)));
    return counts;
  }, [recipes]);

  const showServings = recipes.some(r => r.servings !== null);
  const hasNutrition = recipes.some(r => Object.values(r.nutrition).some(v => v !== null));

  const totalActiveBadge =
    selectedMeals.size + selectedTags.size + (servingBucket ? 1 : 0) + (nutritionFilter ? 1 : 0);
  const hasActiveFilters = totalActiveBadge > 0;
  const hasQuery         = query.trim().length > 0;

  const filtered = useMemo(() => {
    let result = recipes;
    const q = query.trim().toLowerCase();
    if (q) result = result.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      r.mealTypes.some(mt => mt.toLowerCase().includes(q))
    );
    if (selectedTags.size > 0)
      result = result.filter(r => [...selectedTags].every(t => r.tags.includes(t)));
    if (selectedMeals.size > 0)
      result = result.filter(r => [...selectedMeals].some(mt => r.mealTypes.includes(mt)));
    if (servingBucket) {
      const bucket = SERVING_BUCKETS.find(b => b.label === servingBucket);
      if (bucket) result = result.filter(r => r.servings === null || bucket.test(r.servings));
    }
    if (nutritionFilter) {
      const preset = NUTRITION_PRESETS.find(p => p.label === nutritionFilter);
      if (preset) result = result.filter(r => preset.test(r.nutrition));
    }
    return result;
  }, [recipes, query, selectedTags, selectedMeals, servingBucket, nutritionFilter]);

  function toggleTag(tag: string) {
    setSelectedTags(prev => {
      const n = new Set(prev);
      if (n.has(tag)) n.delete(tag); else n.add(tag);
      return n;
    });
  }
  function toggleMeal(mt: string) {
    setSelectedMeals(prev => {
      const n = new Set(prev);
      if (n.has(mt)) n.delete(mt); else n.add(mt);
      return n;
    });
  }
  function clearFilters() {
    setSelectedTags(new Set());
    setSelectedMeals(new Set());
    setServingBucket(null);
    setNutritionFilter(null);
  }

  function handleSurpriseMe(mealType: string) {
    const pool = recipes.filter(r => r.mealTypes.includes(mealType));
    if (pool.length === 0) {
      setSurpriseMsg(`No recipes tagged as "${mealType}" yet.`);
      return;
    }
    const pick = pickRandom(pool);
    setSurpriseOpen(false);
    setSurpriseMsg(null);
    router.push(`/recipes/${pick.slug}`);
  }

  const showEmpty = (hasQuery || hasActiveFilters) && filtered.length === 0;

  return (
    <div>
      <MealQueueShelf />

      {/* Row 1 — search bar only */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="mb-2"
      >
        <div className="relative">
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
        </div>
      </motion.div>

      {/* Row 2 — Filter + Wand + History */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06, ease }}
        className="mb-6 flex items-center gap-2"
      >
        {/* Unified Filter dropdown */}
        <div ref={filterRef} className="relative">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              filterOpen || hasActiveFilters
                ? 'border-accent/50 bg-accent-light text-accent'
                : 'border-border bg-surface-card text-ink-muted hover:border-accent/30 hover:text-ink'
            )}
          >
            <SlidersHorizontal size={13} />
            Filter
            {totalActiveBadge > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
                {totalActiveBadge}
              </span>
            )}
            <motion.span animate={{ rotate: filterOpen ? 180 : 0 }} transition={{ duration: 0.2, ease }} className="inline-flex">
              <ChevronDown size={13} />
            </motion.span>
          </button>

          <AnimatePresence>
            {filterOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18, ease }}
                className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-surface-card shadow-card-hover max-h-[70vh] overflow-y-auto"
              >
                {/* Meal Type */}
                <div className="px-3 pt-3 pb-1">
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Meal Type</p>
                </div>
                <div className="px-1.5 pb-1.5 flex flex-col gap-0.5">
                  {ALL_MEAL_TYPES.map(mt => {
                    const active = selectedMeals.has(mt);
                    const count  = mealTypeCounts.get(mt) ?? 0;
                    return (
                      <button
                        key={mt}
                        onClick={() => toggleMeal(mt)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100"
                      >
                        <span className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150',
                          active ? 'border-accent bg-accent' : 'border-border bg-surface'
                        )}>
                          {active && <Check size={10} className="text-white" strokeWidth={3} />}
                        </span>
                        <span className="flex-1 text-left">{mt}</span>
                        {count > 0 && <span className="text-xs text-ink-faint tabular-nums">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Tags */}
                {allTags.length > 0 && (
                  <>
                    <div className="px-3 pt-2 pb-1 border-t border-border/60">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Tags</p>
                    </div>
                    <div className="px-1.5 pb-1.5 flex flex-col gap-0.5">
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
                  </>
                )}

                {/* Serves */}
                {showServings && (
                  <>
                    <div className="px-3 pt-2 pb-1 border-t border-border/60">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Serves</p>
                    </div>
                    <div className="px-1.5 pb-1.5 flex flex-col gap-0.5">
                      {SERVING_BUCKETS.map(bucket => {
                        const active = servingBucket === bucket.label;
                        return (
                          <button
                            key={bucket.label}
                            onClick={() => setServingBucket(active ? null : bucket.label)}
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
                  </>
                )}

                {/* Nutrition */}
                {hasNutrition && (
                  <>
                    <div className="px-3 pt-2 pb-1 border-t border-border/60">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Nutrition</p>
                    </div>
                    <div className="px-1.5 pb-1.5 flex flex-col gap-0.5">
                      {NUTRITION_PRESETS.map(preset => {
                        const active = nutritionFilter === preset.label;
                        return (
                          <button
                            key={preset.label}
                            onClick={() => setNutritionFilter(active ? null : preset.label)}
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
                  </>
                )}

                {/* Clear all */}
                {hasActiveFilters && (
                  <div className="border-t border-border/60 p-1.5">
                    <button
                      onClick={() => { clearFilters(); setFilterOpen(false); }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs text-accent hover:bg-accent-light transition-colors duration-100"
                    >
                      <X size={11} />
                      Clear all filters
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Wand — icon only */}
        <div ref={surpriseRef} className="relative">
          <button
            onClick={() => { setSurpriseOpen(o => !o); setSurpriseMsg(null); }}
            title="Surprise me"
            aria-label="Pick a random recipe"
            className={cn(
              'flex items-center justify-center rounded-lg border p-1.5 transition-colors duration-150',
              surpriseOpen
                ? 'border-accent/50 bg-accent-light text-accent'
                : 'border-border bg-surface-card text-ink-muted hover:border-accent/30 hover:text-ink'
            )}
          >
            <Wand2 size={15} />
          </button>

          <AnimatePresence>
            {surpriseOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18, ease }}
                className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-surface-card shadow-card-hover"
              >
                <div className="px-3 pt-3 pb-1">
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Which meal?</p>
                </div>
                <div className="p-1.5 flex flex-col gap-0.5">
                  {ALL_MEAL_TYPES.map(mt => {
                    const count = mealTypeCounts.get(mt) ?? 0;
                    return (
                      <button
                        key={mt}
                        onClick={() => handleSurpriseMe(mt)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100"
                      >
                        <span>{mt}</span>
                        <span className={cn('text-xs tabular-nums', count > 0 ? 'text-ink-faint' : 'text-ink-faint/40')}>
                          {count > 0 ? `${count}` : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {surpriseMsg && (
                  <div className="mx-1.5 mb-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    {surpriseMsg}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recently viewed */}
        <RecentlyViewedPopover />

        {/* Active filter summary */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.2, ease }}
              className="text-xs text-ink-faint ml-1"
            >
              {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

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
