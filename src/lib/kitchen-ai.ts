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
};

export type PantryRecipesResponse =
  | {
      ok: true;
      pantry: { count: number; lowCount: number; items: { name: string; low: boolean }[] };
      recipes: PantryRecipe[];
      /** Protein mode only: the targets actually applied. */
      targets?: Targets;
      /** Protein mode only: nothing met the targets. */
      noneMatched?: boolean;
    }
  | { ok: false; pantryError: { reason: 'not-configured' | 'unreachable' | 'empty'; message: string } };

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
