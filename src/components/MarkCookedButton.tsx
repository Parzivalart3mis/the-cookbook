'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';

export default function MarkCookedButton({ slug }: { slug: string }) {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [cookedDate, setCookedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    fetch('/api/cooked')
      .then(r => r.json())
      .then(data => setCookedDate(data.cooked?.[slug] ?? null))
      .catch(() => {});
  }, [slug, isSignedIn, authLoaded]);

  async function toggleCooked() {
    if (cookedDate) {
      setCookedDate(null);
      await fetch(`/api/cooked?slug=${slug}`, { method: 'DELETE' });
    } else {
      const now = new Date().toISOString();
      setCookedDate(now);
      await fetch('/api/cooked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
    }
  }

  if (!isSignedIn) return null;

  const label = cookedDate
    ? `Cooked ${new Date(cookedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Mark as cooked';

  return (
    <button
      onClick={toggleCooked}
      className={`flex items-center gap-1.5 text-xs font-medium transition-colors duration-150 shrink-0 ${
        cookedDate ? 'text-green-500 hover:text-red-400' : 'text-ink-faint hover:text-accent'
      }`}
      title={cookedDate ? 'Click to unmark' : 'Mark as cooked today'}
    >
      {cookedDate ? <CheckCircle2 size={13} /> : <Circle size={13} />}
      {label}
    </button>
  );
}
