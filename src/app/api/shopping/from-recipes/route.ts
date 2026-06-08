import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { getRecipeBySlug } from '@/lib/notion';
import { extractIngredients, categorize } from '@/lib/ingredients';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slugs } = await req.json() as { slugs: string[] };
  if (!Array.isArray(slugs) || slugs.length === 0) {
    return Response.json({ error: 'slugs required' }, { status: 400 });
  }

  const uniqueSlugs = [...new Set(slugs)];
  const allItems: { id: string; text: string; category: string; recipeName: string }[] = [];

  for (const slug of uniqueSlugs) {
    const recipe = await getRecipeBySlug(slug);
    if (!recipe) continue;
    const ingredients = extractIngredients(recipe.blocks);
    for (const text of ingredients) {
      allItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text,
        category: categorize(text),
        recipeName: recipe.name,
      });
    }
  }

  for (const item of allItems) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO shopping_items (id, user_id, text, category, recipe_name) VALUES (?, ?, ?, ?, ?)',
      args: [item.id, userId, item.text, item.category, item.recipeName],
    });
  }

  return Response.json({ ok: true, count: allItems.length });
}
