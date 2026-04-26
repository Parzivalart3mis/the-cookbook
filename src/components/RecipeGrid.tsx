'use client';

import { AnimatePresence } from 'framer-motion';
import RecipeCard from './RecipeCard';
import type { RecipeSummary } from '@/lib/notion';

export default function RecipeGrid({ recipes }: { recipes: RecipeSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {recipes.map((recipe, i) => (
          <RecipeCard key={recipe.id} recipe={recipe} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}
