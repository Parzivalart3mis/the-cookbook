'use client';

import { useState, useEffect, useRef } from 'react';
import { Lightbulb, Plus, Check, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type FutureRecipe = {
  id: string;
  name: string;
  done: boolean;
  createdAt: string;
};

export default function FutureRecipesPage() {
  const [items, setItems] = useState<FutureRecipe[]>([]);
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/future-recipes')
      .then(r => r.json())
      .then(data => setItems(data.items ?? []))
      .catch(() => {})
      .finally(() => setMounted(true));
  }, []);

  async function addItem() {
    const name = input.trim();
    if (!name) return;
    setInput('');
    const res = await fetch('/api/future-recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const item = await res.json();
    setItems(prev => [item, ...prev]);
    inputRef.current?.focus();
  }

  async function toggleDone(id: string, done: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: !done } : i));
    await fetch('/api/future-recipes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, done: !done }),
    });
  }

  async function remove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/future-recipes?id=${id}`, { method: 'DELETE' });
  }

  async function clearDone() {
    setItems(prev => prev.filter(i => !i.done));
    await fetch('/api/future-recipes?clearDone=1', { method: 'DELETE' });
  }

  const pending = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb size={20} className="text-accent" />
          <h1 className="font-display text-2xl font-semibold text-ink">Future Recipes</h1>
        </div>
        <p className="text-sm text-ink-muted">Recipes you want to make someday.</p>
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-8">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Butter chicken, sourdough bread…"
          className="flex-1 rounded-xl border border-border bg-surface-card px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
        />
        <button
          onClick={addItem}
          disabled={!input.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          <Plus size={15} />
          Add
        </button>
      </div>

      {/* Pending list */}
      {pending.length === 0 && done.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-light flex items-center justify-center">
            <Lightbulb size={24} className="text-accent" />
          </div>
          <p className="font-display text-xl font-medium text-ink">Nothing yet</p>
          <p className="text-ink-muted text-sm max-w-xs">
            Add recipes you&apos;ve been meaning to make — from Instagram, a friend&apos;s recommendation, or your own imagination.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-3">
                Want to make · {pending.length}
              </p>
              <div className="rounded-xl border border-border bg-surface-card divide-y divide-border">
                <AnimatePresence>
                  {pending.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => toggleDone(item.id, item.done)}
                          className="shrink-0 flex h-5 w-5 items-center justify-center rounded border border-border hover:border-accent/50 transition-colors"
                        >
                          <Check size={11} className="text-transparent" strokeWidth={3} />
                        </button>
                        <span className="flex-1 text-sm text-ink">{item.name}</span>
                        <button
                          onClick={() => remove(item.id)}
                          className="shrink-0 text-ink-faint hover:text-ink transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {done.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">
                  Added · {done.length}
                </p>
                <button
                  onClick={clearDone}
                  className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink transition-colors"
                >
                  <Trash2 size={11} />
                  Clear
                </button>
              </div>
              <div className="rounded-xl border border-border bg-surface-card divide-y divide-border">
                <AnimatePresence>
                  {done.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => toggleDone(item.id, item.done)}
                          className="shrink-0 flex h-5 w-5 items-center justify-center rounded border border-accent bg-accent transition-colors"
                        >
                          <Check size={11} className="text-white" strokeWidth={3} />
                        </button>
                        <span className="flex-1 text-sm text-ink-faint line-through">{item.name}</span>
                        <button
                          onClick={() => remove(item.id)}
                          className="shrink-0 text-ink-faint hover:text-ink transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
