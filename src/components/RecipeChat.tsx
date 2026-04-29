'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Zap, BrainCircuit, Globe, Loader2, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChatMessage } from '@/app/api/recipe-chat/route';

type ModelKey = 'fast' | 'reasoning' | 'search';

const MODELS: { key: ModelKey | 'auto'; label: string; Icon: React.ElementType; color: string; description: string }[] = [
  { key: 'auto',      label: 'Auto',     Icon: Sparkles,    color: 'text-accent',       description: 'Picks the best model for your question' },
  { key: 'fast',      label: 'Fast',     Icon: Zap,         color: 'text-amber-500',    description: '~1000 tok/s · Great for quick questions' },
  { key: 'reasoning', label: 'Thinking', Icon: BrainCircuit, color: 'text-violet-500',  description: '~500 tok/s · Multi-step analysis' },
  { key: 'search',    label: 'Web',      Icon: Globe,        color: 'text-sky-500',      description: '~450 tok/s · Live web search' },
];

interface DisplayMessage extends ChatMessage {
  model?: ModelKey;
  thinking?: string;  // chain-of-thought text from delta.reasoning
}

export default function RecipeChat({ recipeContext }: { recipeContext: string }) {
  const [open, setOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelKey | 'auto'>('auto');
  const [history, setHistory] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingModel, setStreamingModel] = useState<ModelKey>('fast');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function send() {
    const msg = input.trim();
    if (!msg || streaming) return;

    const userMsg: DisplayMessage = { role: 'user', content: msg };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput('');
    setStreaming(true);

    const assistantIdx = nextHistory.length;
    setHistory((h) => [...h, { role: 'assistant', content: '', model: undefined }]);

    try {
      const res = await fetch('/api/recipe-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          recipeContext,
          history: history.map(({ role, content }) => ({ role, content })),
          modelOverride: selectedModel === 'auto' ? undefined : selectedModel,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${errText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            if (parsed.model) {
              const m = parsed.model as ModelKey;
              setStreamingModel(m);
              setHistory((h) => h.map((msg, i) => i === assistantIdx ? { ...msg, model: m } : msg));
              continue;
            }
            const delta = parsed.choices?.[0]?.delta ?? {};
            // Reasoning / thinking tokens
            if (delta.reasoning) {
              setHistory((h) =>
                h.map((msg, i) =>
                  i === assistantIdx
                    ? { ...msg, thinking: (msg.thinking ?? '') + delta.reasoning }
                    : msg
                )
              );
            }
            // Actual response content
            if (delta.content) {
              setHistory((h) =>
                h.map((msg, i) =>
                  i === assistantIdx ? { ...msg, content: msg.content + delta.content } : msg
                )
              );
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('[RecipeChat]', err);
      setHistory((h) =>
        h.map((msg, i) =>
          i === assistantIdx
            ? { ...msg, content: `Error: ${err instanceof Error ? err.message : 'Something went wrong. Please try again.'}` }
            : msg
        )
      );
    } finally {
      setStreaming(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const activeModel = MODELS.find((m) => m.key === selectedModel)!;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-accent/30 bg-accent-light text-accent text-sm font-medium hover:bg-accent hover:text-white hover:border-accent transition-colors duration-150"
      >
        <Sparkles size={15} />
        AI Assistant
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Panel */}
            <motion.div
              className="relative z-10 w-full sm:max-w-lg h-[85dvh] sm:h-[70vh] flex flex-col bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden"
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            >
              {/* Header */}
              <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-accent" />
                    <span className="font-medium text-ink text-sm">AI Assistant</span>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors duration-150"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Model picker */}
                <div className="flex gap-1.5 flex-wrap">
                  {MODELS.map(({ key, label, Icon, color }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedModel(key)}
                      title={MODELS.find(m => m.key === key)?.description}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors duration-150 ${
                        selectedModel === key
                          ? 'border-accent bg-accent text-white'
                          : 'border-border text-ink-muted hover:border-accent/50 hover:text-ink'
                      }`}
                    >
                      <Icon size={11} className={selectedModel === key ? 'text-white' : color} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                {history.length === 0 ? (
                  <div className="flex flex-col gap-3 h-full justify-center">
                    <p className="text-xs text-ink-faint text-center">
                      Ask anything about this recipe. Try one of these:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
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
                  </div>
                ) : (
                  history.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      {msg.role === 'assistant' && msg.model && (
                        <ModelLabel modelKey={msg.model} />
                      )}
                      {msg.role === 'assistant' && msg.thinking && (
                        <ThinkingBlock text={msg.thinking} done={!!msg.content} />
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
                            <span className="text-xs">
                              {msg.thinking ? 'Writing answer…' : `${MODELS.find(m => m.key === streamingModel)?.label ?? 'Loading'}…`}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 px-4 py-3 border-t border-border">
                <div className="flex items-end gap-2 border border-border rounded-xl px-3 py-2 focus-within:border-accent/60 transition-colors duration-150 bg-surface-card">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={`Ask ${activeModel.label === 'Auto' ? 'anything' : `${activeModel.label} model`}…`}
                    rows={1}
                    disabled={streaming}
                    className="flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none min-h-[24px] max-h-28 leading-relaxed disabled:opacity-50"
                    style={{ fieldSizing: 'content' } as React.CSSProperties}
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || streaming}
                    className="shrink-0 p-1.5 rounded-lg bg-accent text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors duration-150"
                    aria-label="Send"
                  >
                    {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
                <p className="text-[0.6rem] text-ink-faint text-center mt-1.5">
                  Shift+Enter for new line · Enter to send
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ThinkingBlock({ text, done }: { text: string; done: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="text-[0.65rem] text-ink-faint border border-border rounded-lg overflow-hidden mb-1 max-w-[85%]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 w-full hover:bg-surface-hover transition-colors duration-100"
      >
        {!done && <Loader2 size={9} className="animate-spin shrink-0" />}
        <BrainCircuit size={9} className="text-violet-400 shrink-0" />
        <span className="font-medium">Thinking{!done ? '…' : ''}</span>
        <ChevronDown
          size={9}
          className={`ml-auto transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 pt-0.5 border-t border-border text-ink-faint whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  );
}

function ModelLabel({ modelKey }: { modelKey: ModelKey }) {
  const meta = MODELS.find((m) => m.key === modelKey);
  if (!meta) return null;
  const { label, Icon, color } = meta;
  return (
    <span className={`flex items-center gap-1 text-[0.6rem] font-medium uppercase tracking-wide ${color}`}>
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
  'What wine pairs with this?',
];
