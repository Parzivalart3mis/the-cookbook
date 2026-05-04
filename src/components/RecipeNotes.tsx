'use client';

import { useState, useEffect, useRef } from 'react';
import { StickyNote, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RecipeNotes({ slug }: { slug: string }) {
  const key = `cookbook-notes-${slug}`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const t = parsed.text ?? '';
        setText(t);
        setSavedAt(parsed.savedAt ?? null);
        if (t.trim()) setOpen(true);
      }
    } catch {}
  }, [key]);

  function handleChange(val: string) {
    setText(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      try { localStorage.setItem(key, JSON.stringify({ text: val, savedAt: now })); } catch {}
      setSavedAt(now);
    }, 500);
  }

  return (
    <div className="mt-10 border-t border-border pt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors duration-150 mb-3"
      >
        <StickyNote size={14} />
        My Notes
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="inline-flex">
          <ChevronDown size={13} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <textarea
              value={text}
              onChange={e => handleChange(e.target.value)}
              placeholder="Next time use less salt… family loved this… try with sourdough…"
              className="w-full h-28 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-ink-faint">{text.length} chars</span>
              {savedAt && <span className="text-xs text-ink-faint">Saved at {savedAt}</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
