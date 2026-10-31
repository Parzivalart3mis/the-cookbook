import { auth } from '@clerk/nextjs/server';
import { aiErrorResponse, generateJson } from '@/lib/gemini';

export const maxDuration = 30;

const SCHEMA = {
  type: 'object',
  properties: {
    substitutes: {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Substitute ingredient' },
          note: { type: 'string', description: 'Brief effect on the dish' },
        },
        required: ['name', 'note'],
      },
    },
  },
  required: ['substitutes'],
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { ingredient, recipeName } = await req.json() as { ingredient: string; recipeName: string };
  if (!ingredient?.trim()) return Response.json({ error: 'ingredient required' }, { status: 400 });

  try {
    const data = await generateJson<{ substitutes: { name: string; note: string }[] }>({
      tier: 'lite',
      system: 'You are a cooking assistant. Suggest 1-2 practical ingredient substitutions, each with a brief note on how it changes the dish.',
      prompt: `Recipe: ${recipeName}\nIngredient to substitute: ${ingredient}`,
      temperature: 0.4,
      timeoutMs: 12_000,
      schema: SCHEMA,
    });
    return Response.json({ substitutes: data.substitutes ?? [] });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
