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
    slug: r.slug as string,
    name: r.name as string,
    prepTime: r.prep_time as number | null,
    cookTime: r.cook_time as number | null,
  }));

  return Response.json({ queue });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug, name, prepTime, cookTime } = await req.json();
  await db.execute({
    sql: 'INSERT OR IGNORE INTO meal_queue (user_id, slug, name, prep_time, cook_time) VALUES (?, ?, ?, ?, ?)',
    args: [userId, slug, name, prepTime ?? null, cookTime ?? null],
  });

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (slug) {
    await db.execute({ sql: 'DELETE FROM meal_queue WHERE user_id = ? AND slug = ?', args: [userId, slug] });
  } else {
    await db.execute({ sql: 'DELETE FROM meal_queue WHERE user_id = ?', args: [userId] });
  }

  return Response.json({ ok: true });
}
