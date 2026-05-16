import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await db.execute({
    sql: 'SELECT id, text, category, checked, recipe_name FROM shopping_items WHERE user_id = ? ORDER BY created_at ASC',
    args: [userId],
  });

  const items = result.rows.map(r => ({
    id: r.id as string,
    text: r.text as string,
    category: r.category as string,
    checked: (r.checked as number) === 1,
    recipeName: r.recipe_name as string,
  }));

  return Response.json({ items });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { items } = await req.json() as { items: { id: string; text: string; category: string; recipeName: string }[] };

  for (const item of items) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO shopping_items (id, user_id, text, category, recipe_name) VALUES (?, ?, ?, ?, ?)',
      args: [item.id, userId, item.text, item.category, item.recipeName],
    });
  }

  return Response.json({ ok: true });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, checked } = await req.json();
  await db.execute({
    sql: 'UPDATE shopping_items SET checked = ? WHERE id = ? AND user_id = ?',
    args: [checked ? 1 : 0, id, userId],
  });

  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const clearChecked = searchParams.get('clearChecked');
  const clearAll = searchParams.get('clearAll');

  if (id) {
    await db.execute({ sql: 'DELETE FROM shopping_items WHERE id = ? AND user_id = ?', args: [id, userId] });
  } else if (clearChecked) {
    await db.execute({ sql: 'DELETE FROM shopping_items WHERE user_id = ? AND checked = 1', args: [userId] });
  } else if (clearAll) {
    await db.execute({ sql: 'DELETE FROM shopping_items WHERE user_id = ?', args: [userId] });
  }

  return Response.json({ ok: true });
}
