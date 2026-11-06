import { recipeCuisineStatus } from './recipe-cuisine';
import type { RecipeSummary } from './notion';
import { ingredientWords, matchPantry, type PantryItem } from './tote';
import { fitsDiet, type Diet, type Targets } from './kitchen-ai';

export type CookbookRecipe = RecipeSummary & { ingredients: string[] };
export type CookbookMatch = CookbookRecipe & {
  available: string[]; missing: string[]; low: string[]; coverage: number;
};
export type MatchOptions = { cuisine: string; diet: Diet; refine: string; protein: boolean; targets: Targets };

export const STAPLES = ['salt', 'black pepper', 'pepper', 'water', 'oil', 'cooking oil', 'vegetable oil', 'ice'];
const stapleKeys = new Set(STAPLES.map(s => ingredientWords(s).join(' ')));
export const isStaple = (s: string) => stapleKeys.has(ingredientWords(s).join(' '));

/** Include quantities and status, and ignore ordering. Never expose the sharing secret. */
export function pantryFingerprint(items: PantryItem[], connectionId?: string): string {
  const content = JSON.stringify(items.map(i => [i.name.trim().toLowerCase(), i.quantity, i.unit, i.status, i.category]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  return connectionId ? JSON.stringify([connectionId, content]) : content;
}

/** Remove amounts/preparation notes while preserving identity: garlic powder != garlic. */
export function ingredientName(line: string): string {
  return line
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^[\s\d¼½¾⅓⅔⅛⅜⅝⅞./–—-]+/, '')
    .replace(/^(?:(?:cups?|tablespoons?|teaspoons?|tbsp|tsp|grams?|kilograms?|kg|g|ml|liters?|litres?|l|ounces?|oz|pounds?|lbs?|pinch(?:es)?|handfuls?|pieces?|cloves?)\b[\s.-]*(?:of\s+)?)+/i, '')
    .replace(/(?:,|\s[—–]\s).*$/, '')
    .replace(/\s+(?:[—–-]\s*)?\d[\d\s./¼½¾⅓⅔]*(?:g|kg|ml|cups?|tbsp|tsp)\b.*$/i, '')
    .replace(/\b(?:to taste|as needed|for garnish|finely|roughly)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function dishKey(name: string): string {
  return name.toLowerCase().replace(/\b(?:classic|traditional|homemade|easy|recipe)\b/g, '').replace(/[^a-z0-9]/g, '');
}

export function matchCookbook(recipes: CookbookRecipe[], pantry: PantryItem[], options: MatchOptions) {
  let missingNutrition = 0;
  let missingIngredients = 0;
  const excluded = { diet: 0, cuisine: 0, meal: 0, time: 0, nutrition: 0, noPantryOverlap: 0 };
  const cuisineUnknown: CookbookMatch[] = [];
  const meals = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'drink', 'side dish', 'meal prep'];
  const requestedMeals = meals.filter(m => new RegExp(`\\b${m}s?\\b`, 'i').test(options.refine));
  const time = /(?:under|within|less than|max)\s*(\d+)\s*(?:min|minute)/i.exec(options.refine);
  const matches: CookbookMatch[] = [];
  for (const recipe of recipes) {
    if (!fitsDiet([recipe.name, ...recipe.ingredients].join('. '), options.diet)) { excluded.diet++; continue; }
    const labels = [...recipe.tags, ...recipe.mealTypes].map(t => t.toLowerCase());
    const cuisine = recipeCuisineStatus(recipe, options.cuisine);
    if (cuisine === 'different') { excluded.cuisine++; continue; }
    if (requestedMeals.length && !requestedMeals.some(m => labels.some(t => t === m || t === `${m}s`))) { excluded.meal++; continue; }
    if (time && (recipe.prepTime === null || recipe.cookTime === null || recipe.prepTime + recipe.cookTime > Number(time[1]))) { excluded.time++; continue; }
    if (!recipe.ingredients.length) { missingIngredients++; continue; }
    if (options.protein) {
      const { protein, calories } = recipe.nutrition;
      if (protein === null || calories === null) { missingNutrition++; continue; }
      if (protein < options.targets.minProtein || calories > options.targets.maxCalories) { excluded.nutrition++; continue; }
    }
    const available = new Set<string>();
    const low = new Set<string>();
    const missing: string[] = [];
    let found = 0;
    let total = 0;
    for (const raw of recipe.ingredients) {
      const name = ingredientName(raw);
      if (isStaple(name)) continue;
      total++;
      const hit = matchPantry(name, pantry);
      if (hit) { found++; available.add(hit.name); if (hit.status === 'LOW') low.add(hit.name); }
      else missing.push(raw);
    }
    // Do not recommend a recipe with no evidence of pantry overlap.
    if (!found) { excluded.noPantryOverlap++; continue; }
    (cuisine === 'unknown' ? cuisineUnknown : matches).push({ ...recipe, available: [...available], missing, low: [...low], coverage: total ? found / total : 0 });
  }
  const rank = (a: CookbookMatch, b: CookbookMatch) => b.coverage - a.coverage || a.missing.length - b.missing.length || (options.protein
    ? (b.nutrition.protein! / Math.max(1, b.nutrition.calories!)) - (a.nutrition.protein! / Math.max(1, a.nutrition.calories!))
    : a.name.localeCompare(b.name));
  matches.sort(rank);
  cuisineUnknown.sort(rank);
  return { matches: matches.slice(0, 12), cuisineUnknown: cuisineUnknown.slice(0, 12), missingNutrition, missingIngredients, excluded };
}
