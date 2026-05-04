import { getAllRecipes, type RecipeSummary } from '@/lib/notion';
import RecipeSearch from '@/components/RecipeSearch';
import { ChefHat } from 'lucide-react';

export const revalidate = 60;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;

  let recipes: RecipeSummary[] = [];
  let error = false;
  try {
    recipes = await getAllRecipes();
  } catch {
    recipes = [];
    error = true;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <div className="mb-12">
        <p className="text-ink-muted text-lg max-w-md">
          {error
            ? 'Could not connect to Notion. Check your integration.'
            : recipes.length > 0
              ? `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'} and counting.`
              : 'A personal collection of recipes.'}
        </p>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
            <ChefHat size={24} className="text-red-400" />
          </div>
          <p className="font-display text-xl font-medium text-ink">Notion unavailable</p>
          <p className="text-ink-muted text-sm max-w-xs">
            Could not fetch recipes. Make sure the Notion integration is connected to your database.
          </p>
        </div>
      ) : recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-light flex items-center justify-center">
            <ChefHat size={24} className="text-accent" />
          </div>
          <p className="font-display text-xl font-medium text-ink">No recipes yet</p>
          <p className="text-ink-muted text-sm max-w-xs">
            Add one in Notion and it will appear here within a minute.
          </p>
        </div>
      ) : (
        <RecipeSearch recipes={recipes} initialTag={tag} />
      )}
    </div>
  );
}
