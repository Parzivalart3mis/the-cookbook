'use client';

import { useState, useEffect, useRef } from 'react';
import { StickyNote, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/nextjs';

export default function RecipeNotes({ slug }: { slug: string }) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    fetch(`/api/notes/${slug}`)
      .then(r => r.json())
      .then(data => {
        const t = data.text ?? '';
        setText(t);
        if (t.trim()) setOpen(true);
      })
      .catch(() => {});
  }, [slug, isSignedIn, authLoaded]);

  function handleChange(val: string) {
    setText(val);
    setSaveStatus('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/notes/${slug}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: val }),
        });
        if (!res.ok) throw new Error();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('error');
      }
    }, 500);
  }

  if (!isSignedIn) return null;

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
              {saveStatus === 'saving' && <span className="text-xs text-ink-faint">Saving…</span>}
              {saveStatus === 'saved'  && <span className="text-xs text-green-500">Saved ✓</span>}
              {saveStatus === 'error'  && <span className="text-xs text-red-500">Failed to save</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
