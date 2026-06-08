import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get('weekStart');
  if (!weekStart) return Response.json({ error: 'weekStart required' }, { status: 400 });

  const result = await db.execute({
    sql: 'SELECT id, recipe_slug, recipe_name, day FROM meal_plan WHERE user_id = ? AND week_start = ?',
    args: [userId, weekStart],
  });

  const plan: Record<string, { id: string; slug: string; name: string }[]> = {};
  for (const row of result.rows) {
    const day = row.day as string;
    if (!plan[day]) plan[day] = [];
    plan[day].push({ id: row.id as string, slug: row.recipe_slug as string, name: row.recipe_name as string });
  }

  return Response.json({ plan });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, slug, name, day, weekStart } = await req.json();

  await db.execute({
    sql: 'INSERT OR REPLACE INTO meal_plan (id, user_id, recipe_slug, recipe_name, day, week_start, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, userId, slug, name, day, weekStart, new Date().toISOString()],
  });

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const weekStart = searchParams.get('weekStart');

  if (id) {
    await db.execute({ sql: 'DELETE FROM meal_plan WHERE id = ? AND user_id = ?', args: [id, userId] });
  } else if (weekStart) {
    await db.execute({ sql: 'DELETE FROM meal_plan WHERE user_id = ? AND week_start = ?', args: [userId, weekStart] });
  }

  return Response.json({ ok: true });
}
