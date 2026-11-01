import { auth } from '@clerk/nextjs/server';
import { aiErrorResponse, generateJson } from '@/lib/gemini';
import {
  LEAN_PROTEINS,
  clampTargets,
  cleanCuisine,
  cleanDiet,
  cleanRefine,
  dietRule,
  fitsDiet,
  type Diet,
  type Difficulty,
  type Nutrition,
  type PantryMode,
  type PantryRecipe,
  type PantryRecipesResponse,
  type Targets,
} from '@/lib/kitchen-ai';
import { formatPantryItem, getPantry, ingredientWords, matchPantry, type PantryItem } from '@/lib/tote';
import { youtubeSearchUrl } from '@/lib/youtube';

export const maxDuration = 60;

/** Assumed to be in every kitchen, so never listed as "missing". */
const STAPLES = ['salt', 'black pepper', 'pepper', 'water', 'oil', 'cooking oil', 'vegetable oil', 'ice'];

const SHOW = 6;
/** Protein mode asks for extra candidates because the hard filter drops some. */
const ASK: Record<PantryMode, number> = { pantry: 6, protein: 9 };

function schema(count: number) {
  return {
    type: 'object',
    properties: {
      recipes: {
        type: 'array',
        minItems: 1,
        maxItems: count,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string', description: 'One appetising sentence' },
            timeMinutes: { type: 'integer', minimum: 5, maximum: 600 },
            servings: { type: 'integer', minimum: 1, maximum: 12 },
            difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
            usesFromPantry: {
              type: 'array',
              items: { type: 'string' },
              description: 'Pantry items used, copied exactly as named in the pantry list',
            },
            missing: {
              type: 'array',
              items: { type: 'string' },
              description: 'Ingredients needed that are NOT in the pantry (exclude salt, pepper, water, cooking oil)',
            },
            steps: { type: 'array', minItems: 2, maxItems: 8, items: { type: 'string' } },
            nutrition: {
              type: 'object',
              description: 'Realistic estimate PER SERVING',
              properties: {
                calories: { type: 'integer', minimum: 0, description: 'kcal per serving' },
                protein: { type: 'integer', minimum: 0, description: 'grams per serving' },
                carbs: { type: 'integer', minimum: 0, description: 'grams per serving' },
                fat: { type: 'integer', minimum: 0, description: 'grams per serving' },
              },
              required: ['calories', 'protein', 'carbs', 'fat'],
            },
          },
          required: ['name', 'description', 'timeMinutes', 'servings', 'difficulty', 'usesFromPantry', 'missing', 'steps', 'nutrition'],
        },
      },
    },
    required: ['recipes'],
  };
}

type RawRecipe = {
  name: string;
  description: string;
  timeMinutes: number;
  servings: number;
  difficulty: Difficulty;
  usesFromPantry: string[];
  missing: string[];
  steps: string[];
  nutrition: Nutrition;
};

const STAPLE_KEYS = new Set(STAPLES.map(s => ingredientWords(s).join(' ')));
const isStaple = (s: string) => STAPLE_KEYS.has(ingredientWords(s).join(' '));

/**
 * True when the calories roughly agree with the macros (4 kcal/g protein and
 * carbs, 9 kcal/g fat). Asked for an impossible target, the model invents
 * numbers that hit it ("140 g protein, 140 kcal"); those dishes fail this check.
 */
function nutritionAddsUp(n: Nutrition): boolean {
  const fromMacros = 4 * n.protein + 4 * n.carbs + 9 * n.fat;
  return n.calories > 0 && Math.abs(n.calories - fromMacros) <= Math.max(40, 0.2 * fromMacros);
}

/** Everything that could reveal meat, fish or eggs. The description is left out: "a veggie take on butter chicken" is fine. */
const dishText = (r: PantryRecipe) => [r.name, ...r.usesFromPantry, ...r.missing, ...r.steps].join('. ');

function finalize(raw: RawRecipe, pantry: PantryItem[]): PantryRecipe {
  const uses = new Map<string, PantryItem>();
  const missing = new Set<string>();
  for (const u of raw.usesFromPantry ?? []) {
    const hit = matchPantry(u, pantry);
    if (hit) uses.set(hit.name, hit);
    else if (!isStaple(u)) missing.add(u); // claimed from the pantry but isn't there
  }
  for (const m of raw.missing ?? []) {
    if (isStaple(m)) continue;
    const hit = matchPantry(m, pantry);
    if (hit) uses.set(hit.name, hit); // the model missed that you have it
    else missing.add(m);
  }
  const n = raw.nutrition ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  return {
    name: raw.name,
    description: raw.description,
    timeMinutes: raw.timeMinutes,
    servings: raw.servings,
    difficulty: raw.difficulty,
    usesFromPantry: [...uses.keys()],
    lowStockUsed: [...uses.values()].filter(p => p.status === 'LOW').map(p => p.name),
    missing: [...missing],
    steps: raw.steps ?? [],
    nutrition: n,
    proteinPer100kcal: n.calories > 0 ? Math.round((n.protein / n.calories) * 1000) / 10 : 0,
    searchUrl: youtubeSearchUrl(`${raw.name} recipe`),
  };
}

function prompts(mode: PantryMode, pantry: PantryItem[], refine: string, targets: Targets, cuisine: string, diet: Diet) {
  const base = `You are a practical home-cooking assistant. Suggest dishes the cook can make RIGHT NOW from their pantry. Most ingredients must come from the pantry list; at most 3 missing ingredients per dish, fewer is better. Salt, pepper, water and cooking oil are always available. Items marked [running low] can be used but only in small amounts. In usesFromPantry, copy pantry item names exactly as written. Steps are short and actionable. Nutrition is a realistic per-serving estimate.${
    cuisine ? ` Every dish must be ${cuisine} cuisine; don't relabel a dish from another cuisine as ${cuisine}.` : ''
  }`;
  const goal =
    mode === 'protein'
      ? `Every dish MUST be high-protein and low-calorie: at least ${targets.minProtein} g protein and at most ${targets.maxCalories} kcal per serving. Maximise protein per calorie (for example ${LEAN_PROTEINS[diet]}). Pick a serving size that makes the numbers honest. Don't shrink portions to hit the targets. Report each dish's real nutrition even if it misses the targets; never adjust the numbers to fit them. Calories must match the macros (4 kcal per g of protein and carbs, 9 per g of fat).`
      : `Vary the dishes (breakfast, mains, snacks${cuisine ? '' : '; different cuisines'}) and prefer ones that use up items marked [running low].`;
  // Last, so it outweighs "cook from the pantry" when the pantry has no meat or eggs.
  const dietText = `${dietRule(diet)}${
    diet === 'non-veg' ? ' If the pantry has none, put the meat, fish or eggs in missing; that is expected and counts towards the 3 missing ingredients.' : ''
  }`;
  const system = `${base}\n\n${goal}\n\n${dietText}`;
  const prompt = [
    `Pantry (${pantry.length} items):\n${pantry.map(p => `- ${formatPantryItem(p)}`).join('\n')}`,
    refine ? `The cook's request: ${refine}` : '',
    `Suggest ${ASK[mode]} dishes.`,
  ].filter(Boolean).join('\n\n');
  return { system, prompt };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // Counted from the start, so a slow tote read leaves Gemini less time rather than overrunning.
  const deadline = Date.now() + (maxDuration - 5) * 1000;

  const body = (await req.json().catch(() => ({}))) as {
    mode?: unknown; refine?: unknown; targets?: Partial<Targets>; cuisine?: unknown; diet?: unknown;
  };
  const mode: PantryMode = body.mode === 'protein' ? 'protein' : 'pantry';
  const refine = cleanRefine(body.refine);
  const targets = clampTargets(body.targets);
  const cuisine = cleanCuisine(body.cuisine);
  const diet = cleanDiet(body.diet);

  const pantryRes = await getPantry();
  if (!pantryRes.ok) {
    return Response.json({ ok: false, pantryError: { reason: pantryRes.reason, message: pantryRes.message } } satisfies PantryRecipesResponse);
  }
  const pantry = pantryRes.items;
  if (pantry.length === 0) {
    return Response.json({
      ok: false,
      pantryError: { reason: 'empty', message: 'Your tote pantry has nothing marked In stock or Running low yet.' },
    } satisfies PantryRecipesResponse);
  }

  let raw: RawRecipe[];
  try {
    const { system, prompt } = prompts(mode, pantry, refine, targets, cuisine, diet);
    const data = await generateJson<{ recipes: RawRecipe[] }>({
      tier: 'full',
      deadline,
      system,
      prompt,
      temperature: mode === 'protein' ? 0.6 : 0.8,
      schema: schema(ASK[mode]),
    });
    raw = data.recipes ?? [];
  } catch (err) {
    return aiErrorResponse(err);
  }

  let recipes = raw.filter(r => r?.name).map(r => finalize(r, pantry));

  // The model is told the diet; this makes it a guarantee.
  const offDiet = recipes.filter(r => !fitsDiet(dishText(r), diet)).map(r => r.name);
  if (offDiet.length) console.warn(`[pantry-recipes] dropped ${offDiet.length} dish(es) outside the ${diet} diet: ${offDiet.join('; ')}`);
  recipes = recipes.filter(r => fitsDiet(dishText(r), diet));

  if (mode === 'protein') {
    // The model is asked to hit the targets; this makes them a guarantee, and
    // drops dishes whose numbers contradict themselves.
    const implausible = recipes.filter(r => !nutritionAddsUp(r.nutrition)).length;
    if (implausible) console.warn(`[pantry-recipes] dropped ${implausible} dish(es) whose calories don't match their macros`);
    recipes = recipes
      .filter(r => nutritionAddsUp(r.nutrition) && r.nutrition.protein >= targets.minProtein && r.nutrition.calories <= targets.maxCalories)
      .sort((a, b) => b.proteinPer100kcal - a.proteinPer100kcal);
  } else {
    recipes.sort((a, b) => a.missing.length - b.missing.length);
  }

  return Response.json({
    ok: true,
    pantry: {
      count: pantry.length,
      lowCount: pantry.filter(p => p.status === 'LOW').length,
      items: pantry.map(p => ({ name: p.name, low: p.status === 'LOW' })),
    },
    recipes: recipes.slice(0, SHOW),
    ...(mode === 'protein' ? { targets, noneMatched: recipes.length === 0 } : {}),
  } satisfies PantryRecipesResponse);
}
