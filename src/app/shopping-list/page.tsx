'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Trash2, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sGet, sSet } from '@/lib/storage';

type ShoppingItem = {
  id: string;
  text: string;
  category: string;
  checked: boolean;
  recipeName: string;
};

const CATEGORY_ORDER = ['Produce', 'Protein', 'Dairy', 'Pantry', 'Spices', 'Other'];

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(sGet<ShoppingItem[]>('cookbook-shopping') ?? []);
    setMounted(true);
  }, []);

  function save(next: ShoppingItem[]) {
    setItems(next);
    sSet('cookbook-shopping', next);
  }

  function toggle(id: string) {
    save(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  }

  function remove(id: string) {
    save(items.filter(i => i.id !== id));
  }

  function clearChecked() {
    save(items.filter(i => !i.checked));
  }

  function toggleCollapse(cat: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, ShoppingItem[]>>((acc, cat) => {
    const catItems = items.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {});

  const checkedCount = items.filter(i => i.checked).length;

  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart size={20} className="text-accent" />
            <h1 className="font-display text-2xl font-semibold text-ink">Shopping List</h1>
          </div>
          <p className="text-sm text-ink-muted">
            {items.length} item{items.length !== 1 ? 's' : ''}
            {checkedCount > 0 ? `, ${checkedCount} checked` : ''}
          </p>
        </div>
        {checkedCount > 0 && (
          <button
            onClick={clearChecked}
            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            <Trash2 size={12} />
            Clear checked
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-light flex items-center justify-center">
            <ShoppingCart size={24} className="text-accent" />
          </div>
          <p className="font-display text-xl font-medium text-ink">List is empty</p>
          <p className="text-ink-muted text-sm max-w-xs">
            Open a recipe and tap &ldquo;Shopping List&rdquo; to add its ingredients here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} className="rounded-xl border border-border bg-surface-card overflow-hidden">
              <button
                onClick={() => toggleCollapse(cat)}
                className="flex w-full items-center justify-between px-4 py-3"
              >
                <span className="font-semibold text-sm text-ink">{cat}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted">
                    {catItems.filter(i => i.checked).length}/{catItems.length}
                  </span>
                  <motion.span
                    animate={{ rotate: collapsed.has(cat) ? -90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="inline-flex"
                  >
                    <ChevronDown size={14} className="text-ink-muted" />
                  </motion.span>
                </span>
              </button>

              <AnimatePresence>
                {!collapsed.has(cat) && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border">
                      {catItems.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0"
                        >
                          <button
                            onClick={() => toggle(item.id)}
                            className={`shrink-0 flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                              item.checked ? 'bg-accent border-accent' : 'border-border hover:border-accent/50'
                            }`}
                          >
                            {item.checked && <Check size={11} className="text-white" strokeWidth={3} />}
                          </button>
                          <span className={`flex-1 text-sm ${item.checked ? 'line-through text-ink-faint' : 'text-ink'}`}>
                            {item.text}
                          </span>
                          <span className="text-xs text-ink-faint shrink-0">{item.recipeName}</span>
                          <button
                            onClick={() => remove(item.id)}
                            className="shrink-0 text-ink-faint hover:text-ink transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
