import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { aiErrorResponse, generateJson } from '@/lib/gemini';
import { cleanCuisine, cleanRefine, type Difficulty, type IdeasResponse, type RecipeIdea } from '@/lib/kitchen-ai';
import { getAllRecipes } from '@/lib/notion';
import { popularVideosFor, youtubeConfigured, youtubeSearchUrl } from '@/lib/youtube';

export const maxDuration = 60;

const IDEA_COUNT = 6;

const SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      minItems: IDEA_COUNT,
      maxItems: IDEA_COUNT,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Dish name, as people search for it' },
          description: { type: 'string', description: 'One appetising sentence' },
          cuisine: { type: 'string' },
          timeMinutes: { type: 'integer', minimum: 5, maximum: 600 },
          difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
          whyPopular: { type: 'string', description: 'Why this dish is popular or went viral, one short sentence' },
          searchQuery: { type: 'string', description: 'Short YouTube search query that finds a video of this exact dish' },
        },
        required: ['name', 'description', 'cuisine', 'timeMinutes', 'difficulty', 'whyPopular', 'searchQuery'],
      },
    },
  },
  required: ['ideas'],
};

type RawIdea = Omit<RecipeIdea, 'videos' | 'searchUrl'> & { difficulty: Difficulty };

/** What the user already has or plans to make, so ideas are actually new. */
async function knownDishes(userId: string): Promise<{ names: string[]; tastes: string[] }> {
  const [recipes, future] = await Promise.all([
    getAllRecipes().catch(() => []),
    db
      .execute({ sql: 'SELECT name FROM future_recipes WHERE user_id = ?', args: [userId] })
      .then(r => r.rows.map(row => String(row.name)))
      .catch(() => [] as string[]),
  ]);
  const counts = new Map<string, number>();
  for (const r of recipes) for (const t of [...r.tags, ...r.mealTypes]) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tastes = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  return { names: [...recipes.map(r => r.name), ...future], tastes };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  // Leaves 20 s of maxDuration for the YouTube lookups that run after Gemini.
  const deadline = Date.now() + (maxDuration - 20) * 1000;

  const body = (await req.json().catch(() => ({}))) as { refine?: unknown; cuisine?: unknown };
  const refine = cleanRefine(body.refine);
  const cuisine = cleanCuisine(body.cuisine);
  const { names, tastes } = await knownDishes(userId);

  let raw: RawIdea[];
  try {
    const data = await generateJson<{ ideas: RawIdea[] }>({
      tier: 'full',
      deadline,
      system: `You are a food trend scout for a home cook. Suggest ${IDEA_COUNT} fresh recipe ideas: dishes that are popular or have gone viral on YouTube, TikTok and Instagram food content. ${
        cuisine
          ? `Every idea must be a ${cuisine} dish; mix meal types and effort levels.`
          : 'Mix cuisines, meal types and effort levels unless the cook asks otherwise.'
      } Never suggest a dish the cook already has (exact or near-duplicate names). Favour dishes that a home kitchen can realistically make.`,
      prompt: [
        tastes.length ? `The cook's collection leans towards: ${tastes.join(', ')}. Use this as a taste hint, not a restriction.` : '',
        names.length ? `Dishes the cook already has. Do NOT suggest these:\n${names.map(n => `- ${n}`).join('\n')}` : '',
        refine ? `The cook's request for this batch: ${refine}` : '',
        `Give ${IDEA_COUNT} ideas.`,
      ].filter(Boolean).join('\n\n'),
      temperature: 1,
      schema: SCHEMA,
    });
    raw = data.ideas ?? [];
  } catch (err) {
    return aiErrorResponse(err);
  }

  // Drop anything that slipped through as a duplicate of an existing dish.
  const have = new Set(names.map(n => n.toLowerCase().trim()));
  const fresh = raw.filter(i => i.name && !have.has(i.name.toLowerCase().trim())).slice(0, IDEA_COUNT);

  const ideas: RecipeIdea[] = await Promise.all(
    fresh.map(async i => {
      const q = i.searchQuery?.trim() || `${i.name} recipe`;
      return { ...i, searchQuery: q, searchUrl: youtubeSearchUrl(q), videos: await popularVideosFor(q, 3) };
    })
  );

  return Response.json({ ideas, youtube: youtubeConfigured() } satisfies IdeasResponse);
}
