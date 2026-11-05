import { auth } from '@clerk/nextjs/server';
import { aiErrorResponse, generateJson } from '@/lib/gemini';

export const maxDuration = 60;

type RecipeInfo = { slug: string; name: string; prepTime: number | null; cookTime: number | null; tags: string[]; mealTypes: string[] };

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type Day = (typeof DAYS)[number];
type Plan = Record<Day, { slug: string; name: string } | null>;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const requestId = crypto.randomUUID();
  const deadline = Date.now() + (maxDuration - 5) * 1000;

  const { preferences, recipes } = await req.json() as { preferences: string; recipes: RecipeInfo[] };
  if (!preferences?.trim() || !recipes?.length) {
    return Response.json({ error: 'preferences and recipes required' }, { status: 400 });
  }

  const recipeList = recipes
    .map(r => {
      const time = (r.prepTime ?? 0) + (r.cookTime ?? 0);
      const tags = [...r.tags, ...r.mealTypes].join(', ');
      return `- ${r.name} (slug: ${r.slug}${time ? `, ~${time} min` : ''}${tags ? `, tags: ${tags}` : ''})`;
    })
    .join('\n');

  // Only slugs from the user's cookbook are valid; an enum makes that a hard
  // constraint of the response rather than a request in the prompt.
  const slugs = [...new Set(recipes.map(r => r.slug))];
  const daySchema = {
    anyOf: [
      {
        type: 'object',
        properties: { slug: { type: 'string', enum: slugs }, name: { type: 'string' } },
        required: ['slug', 'name'],
      },
      { type: 'null' },
    ],
  };
  const schema = {
    type: 'object',
    properties: {
      plan: {
        type: 'object',
        properties: Object.fromEntries(DAYS.map(d => [d, daySchema])),
        required: [...DAYS],
      },
    },
    required: ['plan'],
  };

  try {
    const data = await generateJson<{ plan: Partial<Plan> }>({
      requestId,
      tier: 'full',
      deadline,
      system: `You are a meal planning assistant. Given a list of recipes and user preferences, assign at most one recipe per day (Monday-Sunday). Set a day to null if the preferences don't call for a meal that day. Use only recipes from the list, with their exact slug and name.`,
      prompt: `User preferences: ${preferences}\n\nAvailable recipes:\n${recipeList}`,
      temperature: 0.5,
      schema,
    });

    // Defensive: re-check against the real list and use the canonical names.
    const bySlug = new Map(recipes.map(r => [r.slug, r.name]));
    const plan = Object.fromEntries(
      DAYS.map(d => {
        const entry = data.plan?.[d];
        const name = entry ? bySlug.get(entry.slug) : undefined;
        return [d, entry && name ? { slug: entry.slug, name } : null];
      })
    ) as Plan;

    return Response.json({ plan });
  } catch (err) {
    // No `plan` key on failure: the client clears the week before saving a plan.
    return aiErrorResponse(err, requestId);
  }
}
