import { getAllRecipes, getRecipeBlocks } from './notion';
import { extractIngredients } from './ingredients';
import type { CookbookRecipe } from './pantry-matching';

// Per-process cache coalesces concurrent requests; never cache a failed/partial index.
let cached: { at: number; recipes: CookbookRecipe[] } | undefined;
let pending: Promise<CookbookRecipe[]> | undefined;
export async function getCookbookIndex(): Promise<CookbookRecipe[]> {
  if (cached && Date.now() - cached.at < 300_000) return cached.recipes;
  if (pending) return pending;
  pending = (async () => {
    const summaries = await getAllRecipes();
    const recipes: CookbookRecipe[] = [];
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, summaries.length) }, async () => {
      while (next < summaries.length) {
        const recipe = summaries[next++];
        recipes.push({ ...recipe, ingredients: extractIngredients(await getRecipeBlocks(recipe.id)) });
      }
    }));
    cached = { at: Date.now(), recipes };
    return recipes;
  })();
  try { return await pending; } finally { pending = undefined; }
}
