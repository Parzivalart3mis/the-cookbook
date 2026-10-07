import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await db.execute({
    sql: 'SELECT recipe_slug FROM favorites WHERE user_id = ? ORDER BY added_at ASC',
    args: [userId],
  });

  return Response.json({ favorites: result.rows.map(r => r.recipe_slug as string) });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await req.json();
  if (typeof slug !== 'string' || !slug) return Response.json({ error: 'slug required' }, { status: 400 });

  await db.execute({
    sql: 'INSERT OR IGNORE INTO favorites (user_id, recipe_slug) VALUES (?, ?)',
    args: [userId, slug],
  });

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  if (!slug) return Response.json({ error: 'slug required' }, { status: 400 });

  await db.execute({
    sql: 'DELETE FROM favorites WHERE user_id = ? AND recipe_slug = ?',
    args: [userId, slug],
  });

  return Response.json({ ok: true });
}
