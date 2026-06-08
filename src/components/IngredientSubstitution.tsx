'use client';

import { useState } from 'react';
import { Shuffle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Substitute = { name: string; note: string };

export default function IngredientSubstitution({ recipeName }: { recipeName: string }) {
  const [open, setOpen] = useState(false);
  const [ingredient, setIngredient] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Substitute[] | null>(null);
  const [error, setError] = useState(false);

  async function lookup() {
    if (!ingredient.trim()) return;
    setLoading(true);
    setResults(null);
    setError(false);
    try {
      const res = await fetch('/api/ai/substitute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient: ingredient.trim(), recipeName }),
      });
      const data = await res.json();
      setResults(data.substitutes ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setOpen(false);
    setIngredient('');
    setResults(null);
    setError(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-accent transition-colors duration-150 mt-4"
      >
        <Shuffle size={12} />
        Need a substitution?
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={reset}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm bg-surface rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Shuffle size={15} className="text-accent" />
                  <span className="font-semibold text-ink text-sm">Ingredient Substitution</span>
                </div>
                <button onClick={reset} className="text-ink-muted hover:text-ink transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={ingredient}
                    onChange={e => { setIngredient(e.target.value); setResults(null); setError(false); }}
                    onKeyDown={e => e.key === 'Enter' && lookup()}
                    placeholder="e.g. heavy cream, ghee, eggs…"
                    className="flex-1 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                  />
                  <button
                    onClick={lookup}
                    disabled={loading || !ingredient.trim()}
                    className="flex items-center justify-center rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 transition-colors"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />}
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {error && (
                    <motion.p key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-xs text-red-500">
                      Something went wrong. Try again.
                    </motion.p>
                  )}
                  {results !== null && results.length === 0 && (
                    <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-xs text-ink-muted">
                      No substitutions found for this ingredient.
                    </motion.p>
                  )}
                  {results !== null && results.length > 0 && (
                    <motion.div key="results" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="space-y-2">
                      {results.map((s, i) => (
                        <div key={i} className="rounded-lg bg-surface-card border border-border px-3 py-2.5">
                          <p className="text-sm font-medium text-ink">{s.name}</p>
                          <p className="text-xs text-ink-muted mt-0.5">{s.note}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
