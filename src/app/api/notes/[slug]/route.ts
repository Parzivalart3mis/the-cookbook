import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const result = await db.execute({
    sql: 'SELECT text, saved_at FROM recipe_notes WHERE user_id = ? AND recipe_slug = ?',
    args: [userId, slug],
  });

  if (result.rows.length === 0) return Response.json({ text: '', savedAt: null });

  const row = result.rows[0];
  return Response.json({ text: row.text as string, savedAt: row.saved_at as string });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const { text } = await req.json();
  const savedAt = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO recipe_notes (user_id, recipe_slug, text, saved_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, recipe_slug) DO UPDATE SET text = excluded.text, saved_at = excluded.saved_at`,
    args: [userId, slug, text, savedAt],
  });

  return Response.json({ ok: true });
}
