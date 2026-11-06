import type { PantryFailureReason } from './tote';
import type { YouTubeVideo } from './youtube';

/** Shared request/response types for the AI Kitchen (client + API routes). */

export const DEFAULT_TARGETS = { minProtein: 25, maxCalories: 500 } as const;
export const TARGET_LIMITS = {
  minProtein: { min: 0, max: 150 },
  maxCalories: { min: 100, max: 2000 },
} as const;

export type Targets = { minProtein: number; maxCalories: number };

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type RecipeIdea = {
  name: string;
  description: string;
  cuisine: string;
  timeMinutes: number;
  difficulty: Difficulty;
  whyPopular: string;
  searchQuery: string;
  videos: YouTubeVideo[];
  searchUrl: string;
};

export type IdeasResponse = { ideas: RecipeIdea[]; youtube: boolean };
export type TrendingResponse = { videos: YouTubeVideo[]; youtube: boolean };

export type Nutrition = { calories: number; protein: number; carbs: number; fat: number };

export type PantryRecipe = {
  name: string;
  description: string;
  timeMinutes: number;
  servings: number;
  difficulty: Difficulty;
  /** Canonical tote pantry item names used by this dish. */
  usesFromPantry: string[];
  /** Subset of usesFromPantry that tote marks Running low. */
  lowStockUsed: string[];
  /** Ingredients you'd still need (staples like salt, oil and water excluded). */
  missing: string[];
  steps: string[];
  /** Per serving, AI-estimated. */
  nutrition: Nutrition;
  proteinPer100kcal: number;
  searchUrl: string;
};

export type PantryMode = 'pantry' | 'protein';

export type PantryRecipesRequest = {
  mode: PantryMode;
  refine?: string;
  targets?: Targets;
  cuisine?: string;
  diet?: Diet;
};

export type PantryRecipesResponse =
  | {
      ok: true;
      pantry: { count: number; lowCount: number; items: { name: string; low: boolean }[] };
      recipes: PantryRecipe[];
      fingerprint: string;
      checkedAt: number;
      /** Protein mode only: the targets actually applied. */
      targets?: Targets;
      /** Protein mode only: nothing met the targets. */
      noneMatched?: boolean;
    }
  | { ok: false; pantryError: { reason: PantryFailureReason | 'empty'; message: string } };

export function clampTargets(t: Partial<Targets> | undefined): Targets {
  const clamp = (v: unknown, lo: number, hi: number, d: number) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
  };
  return {
    minProtein: clamp(t?.minProtein, TARGET_LIMITS.minProtein.min, TARGET_LIMITS.minProtein.max, DEFAULT_TARGETS.minProtein),
    maxCalories: clamp(t?.maxCalories, TARGET_LIMITS.maxCalories.min, TARGET_LIMITS.maxCalories.max, DEFAULT_TARGETS.maxCalories),
  };
}

export function isDefaultTargets(t: Targets): boolean {
  return t.minProtein === DEFAULT_TARGETS.minProtein && t.maxCalories === DEFAULT_TARGETS.maxCalories;
}

/** Keep free-text refinements short so they can't swamp the prompt. */
export function cleanRefine(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

/** One-tap cuisine choices in every tab; anything else goes in the custom field. */
export const CUISINES = ['Indian', 'Chinese', 'Italian', 'American'] as const;

/** A cuisine name such as "Thai" or "Tex-Mex". Empty means any cuisine. */
export function cleanCuisine(v: unknown): string {
  return typeof v === 'string'
    ? v.replace(/[^a-zA-ZÀ-ɏ\s'&-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
    : '';
}

export type Diet = 'vegetarian' | 'eggetarian' | 'non-veg';

export const DIETS: { id: Diet; label: string; hint: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian', hint: 'No meat, fish or eggs' },
  { id: 'eggetarian', label: 'Eggetarian', hint: 'Vegetarian, plus eggs' },
  { id: 'non-veg', label: 'Non-veg', hint: 'Meat, fish and eggs too' },
];

export const DEFAULT_DIET: Diet = 'vegetarian';

export function cleanDiet(v: unknown): Diet {
  return DIETS.some(d => d.id === v) ? (v as Diet) : DEFAULT_DIET;
}

/** Good protein-per-calorie foods each diet allows. */
export const LEAN_PROTEINS: Record<Diet, string> = {
  vegetarian: 'Greek yogurt, paneer, cottage cheese, tofu, soya chunks, lentils, beans',
  eggetarian: 'eggs, egg whites, Greek yogurt, paneer, tofu, soya chunks, lentils',
  'non-veg': 'chicken breast, fish, prawns, eggs, Greek yogurt, tofu, lentils',
};

const HIDDEN_ANIMAL = 'gelatin, fish sauce, oyster sauce, anchovies, lard, or meat, chicken or fish stock';

/** The diet, as an instruction for the model. */
export function dietRule(diet: Diet): string {
  switch (diet) {
    case 'vegetarian':
      return `The cook is vegetarian: no meat, poultry, fish, seafood or eggs, and no hidden animal products (${HIDDEN_ANIMAL}). Dairy is fine.`;
    case 'eggetarian':
      return `The cook is vegetarian but eats eggs: no meat, poultry, fish or seafood, and no hidden animal products (${HIDDEN_ANIMAL}). Eggs and dairy are fine; include some egg dishes.`;
    case 'non-veg':
      return 'The cook eats meat, poultry, fish, seafood and eggs, and wants dishes with them: at least half the dishes MUST be built around meat, poultry, fish, seafood or eggs. The rest can be vegetarian.';
  }
}

// Word stems; plurals are matched too. "egg" skips eggplant and eggless, "oyster" skips oyster mushrooms.
const MEAT_WORDS = [
  'meat(?!less)', 'chicken', 'beef', 'pork', 'mutton', 'lamb', 'goat(?! cheese| milk)', 'veal', 'venison', 'turkey',
  'duck', 'goose', 'quail', 'bacon', 'ham', 'sausage', 'salami', 'pepperoni', 'prosciutto', 'chorizo', 'pancetta',
  'meatball', 'brisket', 'sirloin', 'ribeye', 'bone broth', 'lard', 'gelatine?', 'liver', 'jerky', 'foie gras',
  'carnitas', 'birria', 'murgh?', 'gosht', 'yakhni', 'nihari', 'haleem', 'rogan josh', 'paya', 'kaleji',
  'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'sardine', 'anchov(?:y|ie)', 'mackerel', 'pomfret', 'trout',
  'basa', 'surimi', 'caviar', 'machh?li', 'seafood', 'shrimp', 'prawn', 'jhinga', 'crab', 'lobster', 'squid',
  'calamari', 'octopus', 'clam', 'mussel', 'scallop', 'oyster(?! mushroom)',
];
const EGG_WORDS = ['egg(?![- ]free)', 'omelette?', 'omlette', 'frittata', 'shakshuka', 'quiche', 'anda'];
const wordsPattern = (words: string[]) => new RegExp(`\\b(?:${words.join('|')})(?:e?s)?\\b`, 'i');
const MEAT = wordsPattern(MEAT_WORDS);
const EGG = wordsPattern(EGG_WORDS);

/**
 * A check on the model's output (and on YouTube titles): true unless the text
 * names something the diet rules out. Errs towards dropping, so "vegan
 * chicken" is dropped for a vegetarian too.
 */
export function fitsDiet(text: string, diet: Diet): boolean {
  if (diet === 'non-veg') return true;
  return !MEAT.test(text) && (diet === 'eggetarian' || !EGG.test(text));
}
