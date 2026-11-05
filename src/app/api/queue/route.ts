import { canonicalRecipeKey, recipeReferenceKeys, keyPlaceholders } from '@/lib/recipe-identity';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await db.execute({
    sql: 'SELECT slug, name, prep_time, cook_time FROM meal_queue WHERE user_id = ? ORDER BY added_at ASC',
    args: [userId],
  });

  const queue = result.rows.map(r => ({
    slug: canonicalRecipeKey(r.slug as string),
    name: r.name as string,
    prepTime: r.prep_time as number | null,
    cookTime: r.cook_time as number | null,
  }));

  return Response.json({ queue: [...new Map(queue.map(item => [item.slug, item])).values()] });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug, name, prepTime, cookTime } = await req.json();
  if (typeof slug !== 'string' || !slug || slug.length > 200) return Response.json({ error: 'A recipe reference is required.' }, { status: 400 });
  if (typeof name !== 'string' || !name.trim() || ![prepTime, cookTime].every(n => n == null || (typeof n === 'number' && Number.isFinite(n) && n >= 0))) return Response.json({ error: 'Invalid recipe details.' }, { status: 400 });
  await db.execute({
    sql: `INSERT INTO meal_queue (user_id, slug, name, prep_time, cook_time) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, slug) DO UPDATE SET name = excluded.name, prep_time = excluded.prep_time, cook_time = excluded.cook_time`,
    args: [userId, canonicalRecipeKey(slug), name, prepTime ?? null, cookTime ?? null],
  });

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (slug) {
    await db.execute({ sql: `DELETE FROM meal_queue WHERE user_id = ? AND slug IN (${keyPlaceholders(recipeReferenceKeys(slug))})`, args: [userId, ...recipeReferenceKeys(slug)] });
  } else {
    await db.execute({ sql: 'DELETE FROM meal_queue WHERE user_id = ?', args: [userId] });
  }

  return Response.json({ ok: true });
}
