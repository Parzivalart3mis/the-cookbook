'use client';

import { Utensils } from 'lucide-react';

function Row({
  items,
  reverse = false,
  duration = 60,
}: {
  items: string[];
  reverse?: boolean;
  duration?: number;
}) {
  // Duplicated once so the -50% keyframe loops seamlessly.
  const loop = [...items, ...items];

  return (
    <div className="flex w-max shrink-0" style={{ animation: `landing-marquee ${duration}s linear infinite ${reverse ? 'reverse' : ''}` }}>
      {loop.map((name, i) => (
        <div key={`${name}-${i}`} className="flex items-center gap-6 px-6">
          <span className="whitespace-nowrap font-[family-name:var(--font-display)] text-xl font-medium text-[var(--l-text-muted)] transition-colors duration-300 hover:text-[var(--l-ember-hot)] sm:text-2xl">
            {name}
          </span>
          <Utensils size={12} className="shrink-0 text-[var(--l-ember)]/45" />
        </div>
      ))}
    </div>
  );
}

export default function Marquee({ recipeNames }: { recipeNames: string[] }) {
  if (recipeNames.length === 0) return null;

  const mid = Math.ceil(recipeNames.length / 2);
  const top = recipeNames.slice(0, mid);
  const bottom = recipeNames.slice(mid).length > 0 ? recipeNames.slice(mid) : top;

  return (
    <section
      aria-label="Recipes in the collection"
      className="relative border-y border-[var(--l-line)] py-10"
    >
      {/* Fade the edges so names dissolve rather than clip */}
      <div
        className="flex flex-col gap-5 overflow-hidden"
        style={{
          maskImage:
            'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
          WebkitMaskImage:
            'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
        }}
      >
        <div className="flex">
          <Row items={top} duration={64} />
        </div>
        <div className="flex opacity-55">
          <Row items={bottom} reverse duration={78} />
        </div>
      </div>
    </section>
  );
}
