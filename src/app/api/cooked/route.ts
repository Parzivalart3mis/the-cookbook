import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await db.execute({
    sql: 'SELECT recipe_slug, cooked_at FROM cooked_history WHERE user_id = ?',
    args: [userId],
  });

  const map: Record<string, string> = {};
  for (const row of result.rows) {
    map[row.recipe_slug as string] = row.cooked_at as string;
  }

  return Response.json({ cooked: map });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await req.json();
  const cookedAt = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO cooked_history (user_id, recipe_slug, cooked_at)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, recipe_slug) DO UPDATE SET cooked_at = excluded.cooked_at`,
    args: [userId, slug, cookedAt],
  });

  return Response.json({ cookedAt });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  if (!slug) return Response.json({ error: 'slug required' }, { status: 400 });

  await db.execute({
    sql: 'DELETE FROM cooked_history WHERE user_id = ? AND recipe_slug = ?',
    args: [userId, slug],
  });

  return Response.json({ ok: true });
}
