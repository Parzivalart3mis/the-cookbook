'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, X, ChefHat, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RecipeSummary } from '@/lib/notion';
import { cn } from '@/lib/cn';
import RecipeGrid from './RecipeGrid';

const ease = [0.22, 1, 0.36, 1] as const;

const SERVING_BUCKETS = [
  { label: '1–2', test: (n: number) => n <= 2 },
  { label: '3–4', test: (n: number) => n >= 3 && n <= 4 },
  { label: '5+',  test: (n: number) => n >= 5 },
] as const;

// ── Dropdown shell ────────────────────────────────────────────────────────────

function FilterDropdown({
  label,
  badge,
  open,
  onToggle,
  onClose,
  children,
}: {
  label: string;
  badge?: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease }}
          className="inline-flex"
        >
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
            className="absolute left-0 top-full z-50 mt-2 min-w-[160px] rounded-xl border border-border bg-surface-card shadow-card-hover"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecipeSearch({ recipes }: { recipes: RecipeSummary[] }) {
  const [query, setQuery]               = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [servingBucket, setServingBucket] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'tags' | 'serves' | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    recipes.forEach((r) => r.tags.forEach((t) => tags.add(t)));
    return [...tags].sort();
  }, [recipes]);

  const showServings = recipes.some((r) => r.servings !== null);

  const hasActiveFilters = selectedTags.size > 0 || servingBucket !== null;
  const hasQuery = query.trim().length > 0;

  const filtered = useMemo(() => {
    let result = recipes;

    const q = query.trim().toLowerCase();
    if (q) result = result.filter((r) => r.name.toLowerCase().includes(q));

    // Tags: AND logic — recipe must have every selected tag
    if (selectedTags.size > 0)
      result = result.filter((r) => [...selectedTags].every((t) => r.tags.includes(t)));

    // Servings bucket
    if (servingBucket) {
      const bucket = SERVING_BUCKETS.find((b) => b.label === servingBucket);
      if (bucket) result = result.filter((r) => r.servings !== null && bucket.test(r.servings));
    }

    return result;
  }, [recipes, query, selectedTags, servingBucket]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function clearFilters() {
    setSelectedTags(new Set());
    setServingBucket(null);
  }

  const closeDropdown = useCallback(() => setOpenDropdown(null), []);
  const showEmpty = (hasQuery || hasActiveFilters) && filtered.length === 0;

  return (
    <div>
      {/* ── Search bar ── */}
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
          onChange={(e) => setQuery(e.target.value)}
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

      {/* ── Filter dropdowns ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease }}
        className="mb-8 flex flex-wrap items-center gap-2"
      >
        {/* Tags dropdown */}
        {allTags.length > 0 && (
          <FilterDropdown
            label="Tags"
            badge={selectedTags.size || undefined}
            open={openDropdown === 'tags'}
            onToggle={() => setOpenDropdown((o) => (o === 'tags' ? null : 'tags'))}
            onClose={closeDropdown}
          >
            <div className="p-1.5 flex flex-col gap-0.5">
              {allTags.map((tag) => {
                const active = selectedTags.has(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-150',
                        active ? 'border-accent bg-accent' : 'border-border bg-surface'
                      )}
                    >
                      {active && <Check size={10} className="text-white" strokeWidth={3} />}
                    </span>
                    {tag}
                  </button>
                );
              })}
            </div>
          </FilterDropdown>
        )}

        {/* Serves dropdown */}
        {showServings && (
          <FilterDropdown
            label="Serves"
            badge={servingBucket ? 1 : undefined}
            open={openDropdown === 'serves'}
            onToggle={() => setOpenDropdown((o) => (o === 'serves' ? null : 'serves'))}
            onClose={closeDropdown}
          >
            <div className="p-1.5 flex flex-col gap-0.5">
              {SERVING_BUCKETS.map((bucket) => {
                const active = servingBucket === bucket.label;
                return (
                  <button
                    key={bucket.label}
                    onClick={() => {
                      setServingBucket(active ? null : bucket.label);
                      closeDropdown();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface-hover transition-colors duration-100"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
                        active ? 'border-accent bg-accent' : 'border-border bg-surface'
                      )}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    {bucket.label} servings
                  </button>
                );
              })}
            </div>
          </FilterDropdown>
        )}

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

      {/* ── Results ── */}
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
                <>
                  {' '}
                  <button
                    onClick={clearFilters}
                    className="text-accent underline underline-offset-2 hover:text-accent-hover transition-colors duration-150"
                  >
                    Clear filters
                  </button>
                </>
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
