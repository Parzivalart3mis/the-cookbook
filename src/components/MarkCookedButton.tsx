'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { sGet, sSet } from '@/lib/storage';

type CookedMap = Record<string, string>; // slug → ISO date

export default function MarkCookedButton({ slug }: { slug: string }) {
  const [cookedDate, setCookedDate] = useState<string | null>(null);

  useEffect(() => {
    const map = sGet<CookedMap>('cookbook-cooked') ?? {};
    setCookedDate(map[slug] ?? null);
  }, [slug]);

  function toggleCooked() {
    const map = sGet<CookedMap>('cookbook-cooked') ?? {};
    if (cookedDate) {
      delete map[slug];
      setCookedDate(null);
    } else {
      const now = new Date().toISOString();
      map[slug] = now;
      setCookedDate(now);
    }
    sSet('cookbook-cooked', map);
  }

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
