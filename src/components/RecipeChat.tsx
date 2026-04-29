'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, ChevronDown, Zap, BrainCircuit, Globe, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChatMessage } from '@/app/api/recipe-chat/route';

type ModelKey = 'fast' | 'reasoning' | 'search';

const MODEL_META: Record<ModelKey, { label: string; Icon: React.ElementType; color: string }> = {
  fast:      { label: 'Fast',      Icon: Zap,         color: 'text-amber-500' },
  reasoning: { label: 'Thinking',  Icon: BrainCircuit, color: 'text-violet-500' },
  search:    { label: 'Web',       Icon: Globe,        color: 'text-sky-500' },
};

interface DisplayMessage extends ChatMessage {
  model?: ModelKey;
}

export default function RecipeChat({ recipeContext }: { recipeContext: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingModel, setStreamingModel] = useState<ModelKey>('fast');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  async function send() {
    const msg = input.trim();
    if (!msg || streaming) return;

    const userMsg: DisplayMessage = { role: 'user', content: msg };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput('');
    setStreaming(true);

    // Placeholder assistant message that we'll stream into
    const assistantIdx = nextHistory.length;
    setHistory((h) => [...h, { role: 'assistant', content: '', model: 'fast' }]);

    try {
      const res = await fetch('/api/recipe-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          recipeContext,
          // Only send role/content to the API — strip display-only fields
          history: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let detectedModel: ModelKey = 'fast';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            // First chunk is our injected model header
            if (parsed.model) {
              detectedModel = parsed.model as ModelKey;
              setStreamingModel(detectedModel);
              setHistory((h) =>
                h.map((m, i) => (i === assistantIdx ? { ...m, model: detectedModel } : m))
              );
              continue;
            }
            const token = parsed.choices?.[0]?.delta?.content ?? '';
            if (token) {
              setHistory((h) =>
                h.map((m, i) =>
                  i === assistantIdx ? { ...m, content: m.content + token } : m
                )
              );
            }
          } catch {}
        }
      }
    } catch (err) {
      setHistory((h) =>
        h.map((m, i) =>
          i === assistantIdx
            ? { ...m, content: 'Something went wrong. Please try again.' }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="mt-10 border-t border-border pt-6">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-2 text-ink-muted group-hover:text-accent transition-colors duration-150">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-medium">Ask about this recipe</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-ink-faint" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-4 flex flex-col gap-3">
              {/* Message history */}
              {history.length > 0 && (
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
                  {history.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      {msg.role === 'assistant' && msg.model && (
                        <ModelBadge modelKey={msg.model} />
                      )}
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-accent text-white rounded-tr-sm'
                            : 'bg-surface-card border border-border text-ink rounded-tl-sm'
                        }`}
                      >
                        {msg.content || (
                          <span className="flex items-center gap-1.5 text-ink-faint">
                            <Loader2 size={12} className="animate-spin" />
                            <span className="text-xs">{MODEL_META[streamingModel].label}…</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}

              {/* Empty state */}
              {history.length === 0 && (
                <div className="flex flex-wrap gap-2 pb-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      className="text-xs border border-border rounded-full px-3 py-1.5 text-ink-muted hover:border-accent/50 hover:text-accent transition-colors duration-150"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="flex items-end gap-2 border border-border rounded-xl px-3 py-2 focus-within:border-accent/60 transition-colors duration-150 bg-surface-card">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask anything about this recipe…"
                  rows={1}
                  disabled={streaming}
                  className="flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none min-h-[24px] max-h-32 leading-relaxed disabled:opacity-50"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || streaming}
                  className="shrink-0 p-1.5 rounded-lg bg-accent text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors duration-150"
                  aria-label="Send"
                >
                  {streaming
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Send size={14} />
                  }
                </button>
              </div>

              <p className="text-[0.65rem] text-ink-faint text-center">
                Shift+Enter for new line · Enter to send
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModelBadge({ modelKey }: { modelKey: ModelKey }) {
  const { label, Icon, color } = MODEL_META[modelKey];
  return (
    <span className={`flex items-center gap-1 text-[0.6rem] font-medium ${color} uppercase tracking-wide`}>
      <Icon size={9} />
      {label}
    </span>
  );
}

const SUGGESTIONS = [
  'What can I substitute for an ingredient?',
  'Can I make this ahead of time?',
  'How do I know when it\'s done?',
  'Make this dairy-free',
];
