import { canonicalRecipeKey, recipeReferenceKeys, keyPlaceholders } from '@/lib/recipe-identity';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const keys = recipeReferenceKeys(slug);
  const result = await db.execute({
    sql: `SELECT item_ids, saved_at FROM recipe_checklists WHERE user_id = ? AND recipe_slug IN (${keyPlaceholders(keys)}) ORDER BY saved_at DESC LIMIT 1`,
    args: [userId, ...keys],
  });

  if (result.rows.length === 0) return Response.json({ ids: [], itemIds: [], savedAt: null });

  const row = result.rows[0];
  let ids: unknown;
  try { ids = JSON.parse(row.item_ids as string); } catch { ids = []; }
  if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) ids = [];
  return Response.json({
    ids, itemIds: ids,
    savedAt: row.saved_at as string,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const ids = body?.ids ?? body?.itemIds;
  if (!Array.isArray(ids) || ids.length > 2000 || !ids.every(id => typeof id === 'string' && id.length <= 200)) {
    return Response.json({ error: 'ids must be an array of strings.' }, { status: 400 });
  }
  const savedAt = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO recipe_checklists (user_id, recipe_slug, item_ids, saved_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, recipe_slug) DO UPDATE SET item_ids = excluded.item_ids, saved_at = excluded.saved_at`,
    args: [userId, canonicalRecipeKey(slug), JSON.stringify(ids), savedAt],
  });

  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const keys = recipeReferenceKeys(slug);
  await db.execute({
    sql: `DELETE FROM recipe_checklists WHERE user_id = ? AND recipe_slug IN (${keyPlaceholders(keys)})`,
    args: [userId, ...keys],
  });

  return Response.json({ ok: true });
}
