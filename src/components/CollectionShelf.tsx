'use client';

import { motion } from 'framer-motion';

export default function CollectionShelf({
  tags,
  selected,
  onSelect,
}: {
  tags: { name: string; count: number }[];
  selected: string | null;
  onSelect: (tag: string | null) => void;
}) {
  if (tags.length === 0) return null;

  return (
    <div className="mb-5 -mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tags.map(({ name, count }) => {
        const active = selected === name;
        return (
          <motion.button
            key={name}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(active ? null : name)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
              active
                ? 'bg-accent text-white'
                : 'border border-border bg-surface-card text-ink-muted hover:border-accent/40 hover:text-ink'
            }`}
          >
            {name}
            <span className={`ml-1.5 font-normal ${active ? 'text-white/70' : 'text-ink-faint'}`}>{count}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
