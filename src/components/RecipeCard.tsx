'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import type { RecipeSummary } from '@/lib/notion';

const ease = [0.22, 1, 0.36, 1] as const;

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function RecipeCard({
  recipe,
  index = 0,
}: {
  recipe: RecipeSummary;
  index?: number;
}) {
  const totalTime =
    recipe.prepTime !== null && recipe.cookTime !== null
      ? recipe.prepTime + recipe.cookTime
      : recipe.prepTime ?? recipe.cookTime ?? null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15, ease: 'easeIn' } }}
      transition={{ duration: 0.4, delay: index * 0.055, ease }}
    >
      <Link href={`/recipes/${recipe.slug}`} className="group block h-full">
        <motion.article
          whileHover={{ y: -6, scale: 1.018 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="h-full rounded-xl border border-border bg-surface-card p-5 shadow-card group-hover:shadow-card-hover group-hover:border-accent/30 transition-[border-color,box-shadow] duration-200"
        >
          <h2 className="font-display text-lg font-semibold leading-snug text-ink group-hover:text-accent transition-colors duration-150 mb-3">
            {recipe.name}
          </h2>

          <div className="flex items-center justify-between gap-3 mt-auto flex-wrap">
            <div className="flex items-center gap-3">
              {recipe.servings !== null && (
                <span className="text-xs text-ink-muted tabular-nums">
                  {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
                </span>
              )}
              {totalTime !== null && (
                <span className="flex items-center gap-1 text-xs text-ink-muted tabular-nums">
                  <Clock size={11} className="text-accent" />
                  {formatTime(totalTime)}
                </span>
              )}
            </div>

            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 ml-auto">
                {recipe.tags.map((tag) => (
                  <motion.span
                    key={tag}
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.15 }}
                    className="inline-block cursor-default rounded-full bg-tag-bg px-2.5 py-0.5 text-xs font-medium text-tag-text"
                  >
                    {tag}
                  </motion.span>
                ))}
              </div>
            )}
          </div>
        </motion.article>
      </Link>
    </motion.div>
  );
}
