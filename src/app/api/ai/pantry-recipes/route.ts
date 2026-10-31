import { auth } from '@clerk/nextjs/server';
import { aiErrorResponse, generateJson } from '@/lib/gemini';
import {
  clampTargets,
  cleanRefine,
  type Difficulty,
  type Nutrition,
  type PantryMode,
  type PantryRecipe,
  type PantryRecipesResponse,
  type Targets,
} from '@/lib/kitchen-ai';
import { formatPantryItem, getPantry, type PantryItem } from '@/lib/tote';
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

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).map(w => w.replace(/(es|s)$/, '')).join(' ');

/** Map a model-written ingredient back to the real pantry item, if there is one. */
function matchPantry(candidate: string, pantry: PantryItem[]): PantryItem | undefined {
  const c = norm(candidate);
  if (!c) return undefined;
  const exact = pantry.find(p => norm(p.name) === c);
  if (exact) return exact;
  const cWords = new Set(c.split(' '));
  return pantry.find(p => {
    const pWords = norm(p.name).split(' ');
    // "chicken breast" ↔ "boneless chicken breasts": every word of the shorter name appears in the longer one.
    return pWords.length > 0 && (pWords.every(w => cWords.has(w)) || [...cWords].every(w => pWords.includes(w)));
  });
}

const isStaple = (s: string) => STAPLES.includes(norm(s)) || STAPLES.includes(s.toLowerCase().trim());

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

function prompts(mode: PantryMode, pantry: PantryItem[], refine: string, targets: Targets) {
  const base = `You are a practical home-cooking assistant. Suggest dishes the cook can make RIGHT NOW from their pantry. Most ingredients must come from the pantry list; at most 3 missing ingredients per dish, fewer is better. Salt, pepper, water and cooking oil are always available. Items marked [running low] can be used but only in small amounts. In usesFromPantry, copy pantry item names exactly as written. Steps are short and actionable. Nutrition is a realistic per-serving estimate.`;
  const system =
    mode === 'protein'
      ? `${base}\n\nEvery dish MUST be high-protein and low-calorie: at least ${targets.minProtein} g protein and at most ${targets.maxCalories} kcal per serving. Maximise protein per calorie (lean proteins, eggs, Greek yogurt, legumes, tofu, cottage cheese, etc.). Pick a serving size that makes the numbers honest. Don't shrink portions to hit the targets.`
      : `${base}\n\nVary the dishes (breakfast, mains, snacks; different cuisines) and prefer ones that use up items marked [running low].`;
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

  const body = (await req.json().catch(() => ({}))) as { mode?: unknown; refine?: unknown; targets?: Partial<Targets> };
  const mode: PantryMode = body.mode === 'protein' ? 'protein' : 'pantry';
  const refine = cleanRefine(body.refine);
  const targets = clampTargets(body.targets);

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
    const { system, prompt } = prompts(mode, pantry, refine, targets);
    const data = await generateJson<{ recipes: RawRecipe[] }>({
      tier: 'full',
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

  if (mode === 'protein') {
    // The model is asked to hit the targets; this makes them a guarantee.
    recipes = recipes
      .filter(r => r.nutrition.protein >= targets.minProtein && r.nutrition.calories > 0 && r.nutrition.calories <= targets.maxCalories)
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
