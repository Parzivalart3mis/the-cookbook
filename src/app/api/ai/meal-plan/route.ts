import { auth } from '@clerk/nextjs/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type RecipeInfo = { slug: string; name: string; prepTime: number | null; cookTime: number | null; tags: string[]; mealTypes: string[] };

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a meal planning assistant. Given a list of recipes and user preferences, assign one recipe per day (Mon–Sun) for the week. Some days can be left empty if not needed.

Reply ONLY with valid JSON in this exact format, no markdown, no extra text:
{"plan":{"monday":{"slug":"recipe-slug","name":"Recipe Name"},"tuesday":null,"wednesday":{"slug":"recipe-slug","name":"Recipe Name"},"thursday":null,"friday":{"slug":"recipe-slug","name":"Recipe Name"},"saturday":null,"sunday":null}}

Use only slugs from the provided recipe list. Set a day to null if not planning a meal for that day.`,
      },
      {
        role: 'user',
        content: `User preferences: ${preferences}\n\nAvailable recipes:\n${recipeList}`,
      },
    ],
    max_tokens: 500,
    temperature: 0.5,
    response_format: { type: 'json_object' },
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
    return Response.json(parsed);
  } catch {
    return Response.json({ plan: {} });
  }
}
