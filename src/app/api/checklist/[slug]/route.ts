import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const result = await db.execute({
    sql: 'SELECT item_ids, saved_at FROM recipe_checklists WHERE user_id = ? AND recipe_slug = ?',
    args: [userId, slug],
  });

  if (result.rows.length === 0) return Response.json({ ids: [], savedAt: null });

  const row = result.rows[0];
  return Response.json({
    ids: JSON.parse(row.item_ids as string),
    savedAt: row.saved_at as string,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const { ids } = await req.json();
  const savedAt = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO recipe_checklists (user_id, recipe_slug, item_ids, saved_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, recipe_slug) DO UPDATE SET item_ids = excluded.item_ids, saved_at = excluded.saved_at`,
    args: [userId, slug, JSON.stringify(ids), savedAt],
  });

  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  await db.execute({
    sql: 'DELETE FROM recipe_checklists WHERE user_id = ? AND recipe_slug = ?',
    args: [userId, slug],
  });

  return Response.json({ ok: true });
}
