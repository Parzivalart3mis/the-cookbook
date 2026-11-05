'use client';
import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';

export default function MarkCookedButton({ slug }: { slug: string }) {
  const { userId } = useAuth();
  const key = `${userId}:${slug}`;
  const [record, setRecord] = useState<{ key: string; date: string | null } | null>(null);
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const lock = useRef<string | null>(null);
  const cookedDate = record?.key === key ? record.date : null;

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    fetch('/api/cooked', { signal: controller.signal, cache: 'no-store' })
      .then(async res => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!controller.signal.aborted) setRecord({ key, date: data.cooked?.[slug] ?? null });
      }).catch(() => { if (!controller.signal.aborted) setError({ key, text: 'Could not load cooking status. Reload to retry.' }); });
    return () => controller.abort();
  }, [key, slug, userId]);

  async function toggleCooked() {
    if (!userId || record?.key !== key || lock.current === key) return;
    lock.current = key;
    setBusyKey(key);
    try {
      const res = await fetch(cookedDate ? `/api/cooked?slug=${encodeURIComponent(slug)}` : '/api/cooked', cookedDate
        ? { method: 'DELETE', signal: AbortSignal.timeout(15_000) }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }), signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRecord(current => current?.key === key ? { key, date: cookedDate ? null : data.cookedAt } : current);
      setError(null);
    } catch { setError({ key, text: 'Cooking status was not saved. Try again.' }); }
    finally { if (lock.current === key) { lock.current = null; setBusyKey(null); } }
  }

  if (!userId) return null;
  const label = cookedDate ? `Cooked ${new Date(cookedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Mark as cooked';
  return (
    <span>
      <button onClick={toggleCooked} disabled={busyKey === key || record?.key !== key}
        className={`flex items-center gap-1.5 text-xs font-medium transition-colors duration-150 shrink-0 disabled:opacity-50 ${cookedDate ? 'text-green-500 hover:text-red-400' : 'text-ink-faint hover:text-accent'}`}
        title={cookedDate ? 'Click to unmark' : 'Mark as cooked today'}>
        {cookedDate ? <CheckCircle2 size={13} /> : <Circle size={13} />}{busyKey === key ? 'Saving…' : label}
      </button>
      {error?.key === key && <span role="alert" className="block text-xs text-red-600">{error.text}</span>}
    </span>
  );
}
