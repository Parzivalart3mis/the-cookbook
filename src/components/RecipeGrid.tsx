'use client';

import { motion } from 'framer-motion';
import RecipeCard from './RecipeCard';
import type { RecipeSummary } from '@/lib/notion';

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

export default function RecipeGrid({ recipes }: { recipes: RecipeSummary[] }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </motion.div>
  );
}
