'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play, Pause, RotateCcw, UtensilsCrossed } from 'lucide-react';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

type Step = { text: string; section: string };

function extractSteps(blocks: BlockObjectResponse[]): Step[] {
  const steps: Step[] = [];
  let section = '';
  for (const block of blocks) {
    if (block.type === 'heading_2' || block.type === 'heading_3') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rich = (block as any)[block.type]?.rich_text ?? [];
      section = rich.map((r: { plain_text: string }) => r.plain_text).join('');
    } else if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rich = (block as any)[block.type]?.rich_text ?? [];
      const text = rich.map((r: { plain_text: string }) => r.plain_text).join('').trim();
      if (text) steps.push({ text, section });
    }
  }
  return steps;
}

function useWakeLock() {
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wl = (navigator as any).wakeLock as
      | { request: (t: string) => Promise<{ release: () => Promise<void> }> }
      | undefined;
    if (wl) wl.request('screen').then(s => { sentinel = s; }).catch(() => {});
    return () => { sentinel?.release(); };
  }, []);
}

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function CookMode({
  blocks,
  recipeName,
  prepTime,
  cookTime,
  onClose,
}: {
  blocks: BlockObjectResponse[];
  recipeName: string;
  prepTime: number | null;
  cookTime: number | null;
  onClose: () => void;
}) {
  const steps = extractSteps(blocks);
  const [current, setCurrent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  useWakeLock();

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (countdown !== null) {
        setCountdown(c => {
          if (c === null || c <= 0) { setRunning(false); return 0; }
          return c - 1;
        });
      } else {
        setElapsed(e => e + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, countdown]);

  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent(c => Math.min(steps.length - 1, c + 1)), [steps.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev, onClose]);

  const startCountdown = (min: number) => {
    setCountdown(min * 60);
    setElapsed(0);
    setRunning(true);
  };

  const resetTimer = () => {
    setRunning(false);
    setElapsed(0);
    setCountdown(null);
  };

  const displayTime = countdown !== null ? fmt(countdown) : fmt(elapsed);
  const timerDone = countdown === 0;

  if (steps.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center text-white">
        <div className="text-center px-8">
          <UtensilsCrossed size={48} className="mx-auto mb-4 text-amber-400/40" />
          <p className="font-display text-2xl font-semibold mb-2">No steps found</p>
          <p className="text-white/50 text-sm mb-6">Add list items to your recipe in Notion to use Cook Mode.</p>
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm font-semibold transition-colors">
            Close
          </button>
        </div>
      </div>
    );
  }

  const step = steps[current];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] bg-[#1a1008] flex flex-col text-white select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/60">Cook Mode</p>
          <p className="text-sm font-display font-medium text-white/75 mt-0.5 truncate max-w-[240px]">{recipeName}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Section label */}
      {step.section && (
        <div className="px-5 pt-5 pb-0 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/60">{step.section}</span>
        </div>
      )}

      {/* Step */}
      <div className="flex-1 flex items-center px-5 py-4 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          <motion.p
            key={current}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-3xl sm:text-4xl lg:text-5xl leading-snug font-medium"
          >
            {step.text}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/10 px-5 pt-4 pb-6 space-y-4">
        {/* Timer */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`font-mono text-2xl font-bold tabular-nums ${
            timerDone ? 'text-red-400 animate-pulse' : countdown !== null ? 'text-amber-400' : 'text-white/50'
          }`}>
            {displayTime}
          </span>
          <button
            onClick={() => setRunning(r => !r)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-bold transition-colors"
          >
            {running ? <Pause size={12} /> : <Play size={12} />}
            {running ? 'Pause' : 'Start'}
          </button>
          <button onClick={resetTimer} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors">
            <RotateCcw size={13} />
          </button>
          {(prepTime || cookTime) && (
            <div className="ml-auto flex gap-3 text-xs text-white/35">
              {prepTime && <button onClick={() => startCountdown(prepTime)} className="hover:text-amber-400 transition-colors">↓ Prep {prepTime}m</button>}
              {cookTime && <button onClick={() => startCountdown(cookTime)} className="hover:text-amber-400 transition-colors">↓ Cook {cookTime}m</button>}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            disabled={current === 0}
            className="flex items-center gap-1 rounded-xl border border-white/20 px-3 py-2 text-sm font-semibold disabled:opacity-25 hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={15} /> Prev
          </button>
          <div className="flex-1 flex items-center justify-center gap-1.5 overflow-hidden">
            {steps.slice(0, 30).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 shrink-0 rounded-full transition-all duration-200 ${
                  i === current ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/20 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            disabled={current === steps.length - 1}
            className="flex items-center gap-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-3 py-2 text-sm font-semibold disabled:opacity-25 transition-colors"
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
        <p className="text-center text-xs text-white/25">
          Step {current + 1} of {steps.length} · ← → to navigate · Esc to exit
        </p>
      </div>
    </motion.div>
  );
}
