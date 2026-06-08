'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

// Build plain-text recipe content for AI context
function blocksToText(blocks: BlockObjectResponse[]): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = blocks as any[];
  const lines: string[] = [];
  for (const block of b) {
    const rich = block[block.type]?.rich_text;
    if (!Array.isArray(rich)) continue;
    const text = rich.map((r: { plain_text: string }) => r.plain_text).join('').trim();
    if (text) lines.push(text);
  }
  return lines.join('\n');
}

// Minimal Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export default function VoiceAssistant({ blocks, recipeName }: { blocks: BlockObjectResponse[]; recipeName: string }) {
  const [state, setState] = useState<'idle' | 'listening' | 'loading' | 'answer'>('idle');
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [supported, setSupported] = useState(true);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const r: SpeechRecognitionInstance = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? '';
      setTranscript(text);
    };
    r.onerror = () => setState('idle');
    r.onend = () => {
      setState(prev => prev === 'listening' ? 'idle' : prev);
    };
    recogRef.current = r;
  }, []);

  // When transcript arrives, fire the API call
  useEffect(() => {
    if (!transcript) return;
    setState('loading');
    const recipeText = `Recipe: ${recipeName}\n\n${blocksToText(blocks)}`;
    fetch('/api/ai/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: transcript, recipeText }),
    })
      .then(r => r.json())
      .then(data => {
        setAnswer(data.answer ?? 'No answer.');
        setState('answer');
        // Read answer aloud
        if ('speechSynthesis' in window) {
          const utt = new SpeechSynthesisUtterance(data.answer);
          utt.rate = 0.95;
          window.speechSynthesis.speak(utt);
        }
      })
      .catch(() => setState('idle'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  function startListening() {
    if (!recogRef.current) return;
    setTranscript('');
    setAnswer('');
    setState('listening');
    recogRef.current.start();
  }

  function stopListening() {
    recogRef.current?.stop();
    setState('idle');
  }

  function dismiss() {
    window.speechSynthesis?.cancel();
    setState('idle');
    setTranscript('');
    setAnswer('');
  }

  if (!supported) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {(state === 'answer' || state === 'loading' || state === 'listening') && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative max-w-xs w-72 bg-surface rounded-2xl border border-border shadow-xl px-4 py-3"
          >
            <button onClick={dismiss} className="absolute top-2 right-2 text-ink-faint hover:text-ink transition-colors">
              <X size={14} />
            </button>
            {state === 'listening' && (
              <p className="text-sm text-ink-muted animate-pulse pr-4">Listening…</p>
            )}
            {state === 'loading' && (
              <>
                {transcript && <p className="text-xs text-ink-faint mb-1.5 pr-4">&ldquo;{transcript}&rdquo;</p>}
                <p className="text-sm text-ink-muted animate-pulse">Thinking…</p>
              </>
            )}
            {state === 'answer' && (
              <>
                {transcript && <p className="text-xs text-ink-faint mb-1.5 pr-4">&ldquo;{transcript}&rdquo;</p>}
                <p className="text-sm text-ink leading-relaxed pr-4">{answer}</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={state === 'listening' ? stopListening : state === 'idle' || state === 'answer' ? startListening : undefined}
        whileTap={{ scale: 0.92 }}
        className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors duration-150 ${
          state === 'listening'
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : state === 'loading'
            ? 'bg-accent/60 text-white cursor-wait'
            : 'bg-accent hover:bg-accent-hover text-white'
        }`}
        title={state === 'listening' ? 'Stop listening' : 'Ask about this recipe'}
      >
        {state === 'listening' ? <MicOff size={20} /> : <Mic size={20} />}
      </motion.button>
    </div>
  );
}
