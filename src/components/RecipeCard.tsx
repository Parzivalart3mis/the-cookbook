'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import type { RecipeSummary } from '@/lib/notion';

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    <motion.div variants={cardVariants}>
      <Link href={`/recipes/${recipe.slug}`} className="group block h-full">
        <motion.article
          whileHover={{ y: -3 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="h-full rounded-xl border border-border bg-surface-card p-5 shadow-card group-hover:shadow-card-hover group-hover:border-accent/20 transition-[border-color,box-shadow] duration-200"
        >
          <h2 className="font-display text-lg font-semibold leading-snug text-ink group-hover:text-accent transition-colors duration-150 mb-3">
            {recipe.name}
          </h2>

          <div className="flex items-center justify-between gap-3 mt-auto">
            {recipe.servings !== null && (
              <span className="text-xs text-ink-muted tabular-nums">
                {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
              </span>
            )}

            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 ml-auto">
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block rounded-full bg-tag-bg px-2.5 py-0.5 text-xs font-medium text-tag-text"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.article>
      </Link>
    </motion.div>
  );
}
