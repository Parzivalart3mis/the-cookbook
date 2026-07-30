import type { Metadata } from 'next';
import { getAllRecipes, type RecipeSummary } from '@/lib/notion';
import LandingPage, { type LandingData } from '@/components/landing/LandingPage';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'The Cookbook — Your kitchen, perfectly remembered',
  description:
    'A private cookbook that plans your week, tracks every macro, and talks you through dinner — hands-free.',
};

/** Every number and name on the landing page is read live from Notion. */
function buildLandingData(recipes: RecipeSummary[]): LandingData {
  const tags = new Set<string>();
  const mealTypes = new Set<string>();

  for (const r of recipes) {
    r.tags.forEach((t) => tags.add(t));
    r.mealTypes.forEach((m) => mealTypes.add(m));
  }

  const nutritionTracked = recipes.filter((r) => r.nutrition.calories !== null).length;

  return {
    recipeCount: recipes.length,
    tagCount: tags.size,
    mealTypeCount: mealTypes.size,
    nutritionTracked,
    // Longest names read best in the marquee and constellation.
    recipeNames: recipes.map((r) => r.name).slice(0, 24),
  };
}

export default async function WelcomePage() {
  let recipes: RecipeSummary[] = [];
  try {
    recipes = await getAllRecipes();
  } catch {
    // Notion unreachable — the page still renders, just with zeroed stats.
    recipes = [];
  }

  return <LandingPage data={buildLandingData(recipes)} />;
}
