'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, X, ShoppingCart, Check, Sparkles } from 'lucide-react';
import type { RecipeSummary } from '@/lib/notion';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(weekStart + 'T00:00:00');
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function formatDayDate(weekStart: string, index: number): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + index);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type PlanEntry = { id: string; slug: string; name: string };
type Plan = Record<string, PlanEntry[]>;

export default function MealPlanClient({ allRecipes }: { allRecipes: RecipeSummary[] }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [plan, setPlan] = useState<Plan>({});
  const [loading, setLoading] = useState(true);
  const [pickerDay, setPickerDay] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [shoppingDone, setShoppingDone] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrefs, setAiPrefs] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meal-plan?weekStart=${weekStart}`)
      .then(r => r.json())
      .then(data => setPlan(data.plan ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [weekStart]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerDay(null);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function addRecipe(day: string, recipe: RecipeSummary) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry: PlanEntry = { id, slug: recipe.slug, name: recipe.name };
    setPlan(prev => ({ ...prev, [day]: [...(prev[day] ?? []), entry] }));
    setPickerDay(null);
    setSearch('');
    await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, slug: recipe.slug, name: recipe.name, day, weekStart }),
    });
  }

  async function removeEntry(day: string, id: string) {
    setPlan(prev => ({ ...prev, [day]: (prev[day] ?? []).filter(e => e.id !== id) }));
    await fetch(`/api/meal-plan?id=${id}`, { method: 'DELETE' });
  }

  async function addWeekToShoppingList() {
    const slugs = Object.values(plan).flat().map(e => e.slug);
    if (slugs.length === 0) return;
    const res = await fetch('/api/shopping/from-recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slugs }),
    });
    if (res.ok) {
      setShoppingDone(true);
      setTimeout(() => setShoppingDone(false), 3000);
    }
  }

  async function runAiPlan() {
    if (!aiPrefs.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: aiPrefs,
          recipes: allRecipes.map(r => ({
            slug: r.slug,
            name: r.name,
            prepTime: r.prepTime,
            cookTime: r.cookTime,
            tags: r.tags,
            mealTypes: r.mealTypes,
          })),
        }),
      });
      const data = await res.json();
      if (data.plan) {
        // Clear current week then save AI plan
        await fetch(`/api/meal-plan?weekStart=${weekStart}`, { method: 'DELETE' });
        const newPlan: Plan = {};
        const saves: Promise<void>[] = [];
        for (const [day, entry] of Object.entries(data.plan as Record<string, { slug: string; name: string }>)) {
          if (!entry) continue;
          const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          newPlan[day] = [{ id, slug: entry.slug, name: entry.name }];
          saves.push(
            fetch('/api/meal-plan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, slug: entry.slug, name: entry.name, day, weekStart }),
            }).then(() => {})
          );
        }
        await Promise.all(saves);
        setPlan(newPlan);
        setAiOpen(false);
        setAiPrefs('');
      }
    } catch {
      // fail silently, user can retry
    } finally {
      setAiLoading(false);
    }
  }

  const totalRecipes = Object.values(plan).flat().length;
  const filtered = allRecipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).slice(0, 20);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">Meal Planner</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekStart(w => addDays(w, -7))}
              className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-ink">{formatWeekRange(weekStart)}</span>
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setWeekStart(getWeekStart(new Date()))}
              className="text-xs text-ink-muted hover:text-ink transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent-light px-3 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-white transition-colors duration-150"
          >
            <Sparkles size={14} />
            Plan with AI
          </button>
          {totalRecipes > 0 && (
            shoppingDone ? (
              <Link
                href="/shopping-list"
                className="flex items-center gap-1.5 rounded-xl border border-green-500/50 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-600 transition-colors"
              >
                <Check size={14} />
                Added · View list
              </Link>
            ) : (
              <button
                onClick={addWeekToShoppingList}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-ink-muted hover:border-accent/30 hover:text-ink transition-colors duration-150"
              >
                <ShoppingCart size={14} />
                Add week to list
              </button>
            )
          )}
        </div>
      </div>

      {/* Day grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {DAYS.map(day => (
            <div key={day} className="rounded-xl border border-border bg-surface-card h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {DAYS.map((day, i) => {
            const dayKey = day.toLowerCase();
            const entries = plan[dayKey] ?? [];
            const dayDate = formatDayDate(weekStart, i);
            return (
              <div key={day} className="rounded-xl border border-border bg-surface-card flex flex-col min-h-[160px]">
                <div className="px-3 pt-3 pb-2 border-b border-border/60">
                  <p className="text-xs font-semibold text-ink uppercase tracking-wide">{day.slice(0, 3)}</p>
                  <p className="text-xs text-ink-faint">{dayDate}</p>
                </div>
                <div className="flex-1 p-2 flex flex-col gap-1.5">
                  {entries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-1 group">
                      <Link
                        href={`/recipes/${entry.slug}`}
                        className="flex-1 text-xs text-ink leading-snug hover:text-accent transition-colors line-clamp-2"
                      >
                        {entry.name}
                      </Link>
                      <button
                        onClick={() => removeEntry(dayKey, entry.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-ink-faint hover:text-red-400 transition-all"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  <div className="relative mt-auto" ref={pickerDay === dayKey ? pickerRef : undefined}>
                    <button
                      onClick={() => { setPickerDay(pickerDay === dayKey ? null : dayKey); setSearch(''); }}
                      className="flex items-center gap-1 text-xs text-ink-faint hover:text-accent transition-colors mt-1"
                    >
                      <Plus size={12} />
                      Add
                    </button>
                    <AnimatePresence>
                      {pickerDay === dayKey && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-6 left-0 z-50 w-64 bg-surface rounded-xl border border-border shadow-lg overflow-hidden"
                        >
                          <div className="p-2 border-b border-border">
                            <input
                              autoFocus
                              value={search}
                              onChange={e => setSearch(e.target.value)}
                              placeholder="Search recipes…"
                              className="w-full text-xs bg-transparent text-ink placeholder:text-ink-faint outline-none px-1 py-0.5"
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {filtered.length === 0 ? (
                              <p className="text-xs text-ink-faint px-3 py-4 text-center">No recipes found</p>
                            ) : (
                              filtered.map(r => (
                                <button
                                  key={r.slug}
                                  onClick={() => addRecipe(dayKey, r)}
                                  className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-surface-hover transition-colors"
                                >
                                  {r.name}
                                </button>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI planner modal */}
      <AnimatePresence>
        {aiOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !aiLoading && setAiOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-surface rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-accent" />
                  <span className="font-semibold text-ink text-sm">Plan with AI</span>
                </div>
                <button onClick={() => setAiOpen(false)} disabled={aiLoading} className="text-ink-muted hover:text-ink transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-ink-muted">
                  Describe what you want this week and AI will pick recipes from your cookbook.
                </p>
                <textarea
                  value={aiPrefs}
                  onChange={e => setAiPrefs(e.target.value)}
                  placeholder="e.g. 5 dinners, 2 vegetarian, nothing that takes more than 45 min…"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
                <button
                  onClick={runAiPlan}
                  disabled={aiLoading || !aiPrefs.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 text-sm font-medium transition-colors"
                >
                  {aiLoading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Planning…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Generate plan
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
