import { canonicalRecipeKey, recipeReferenceKeys, keyPlaceholders } from '@/lib/recipe-identity';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const keys = recipeReferenceKeys(slug);

  try {
    const result = await db.execute({
      sql: `SELECT text, saved_at FROM recipe_notes WHERE user_id = ? AND recipe_slug IN (${keyPlaceholders(keys)}) ORDER BY saved_at DESC LIMIT 1`,
      args: [userId, ...keys],
    });

    if (result.rows.length === 0) return Response.json({ text: '', savedAt: null });

    const row = result.rows[0];
    return Response.json({ text: row.text as string, savedAt: row.saved_at as string });
  } catch (err) {
    console.error('[notes GET]', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const { text } = await req.json();
  if (typeof text !== 'string' || text.length > 100_000) return Response.json({ error: 'A note of up to 100,000 characters is required.' }, { status: 400 });
  const savedAt = new Date().toISOString();

  try {
    await db.execute({
      sql: `INSERT INTO recipe_notes (user_id, recipe_slug, text, saved_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, recipe_slug) DO UPDATE SET text = excluded.text, saved_at = excluded.saved_at`,
      args: [userId, canonicalRecipeKey(slug), text, savedAt],
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[notes POST]', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
