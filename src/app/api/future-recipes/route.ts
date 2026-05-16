import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await db.execute({
    sql: 'SELECT id, name, done, created_at FROM future_recipes WHERE user_id = ? ORDER BY created_at DESC',
    args: [userId],
  });

  const items = result.rows.map(r => ({
    id: r.id as string,
    name: r.name as string,
    done: (r.done as number) === 1,
    createdAt: r.created_at as string,
  }));

  return Response.json({ items });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return Response.json({ error: 'name required' }, { status: 400 });

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.execute({
    sql: 'INSERT INTO future_recipes (id, user_id, name) VALUES (?, ?, ?)',
    args: [id, userId, name.trim()],
  });

  return Response.json({ id, name: name.trim(), done: false, createdAt: new Date().toISOString() });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, done } = await req.json();
  await db.execute({
    sql: 'UPDATE future_recipes SET done = ? WHERE id = ? AND user_id = ?',
    args: [done ? 1 : 0, id, userId],
  });

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const clearDone = searchParams.get('clearDone');

  if (id) {
    await db.execute({ sql: 'DELETE FROM future_recipes WHERE id = ? AND user_id = ?', args: [id, userId] });
  } else if (clearDone) {
    await db.execute({ sql: 'DELETE FROM future_recipes WHERE user_id = ? AND done = 1', args: [userId] });
  }

  return Response.json({ ok: true });
}
