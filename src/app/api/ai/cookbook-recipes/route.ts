import { auth } from '@clerk/nextjs/server';
import { getCookbookIndex } from '@/lib/cookbook-index';

export const maxDuration = 60;
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json({ recipes: await getCookbookIndex() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[cookbook-index] failed', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'Could not load your recipes. Refresh pantry to retry.' }, { status: 502 });
  }
}
