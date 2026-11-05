import { auth } from '@clerk/nextjs/server';
import { getPantry } from '@/lib/tote';
import { pantryFingerprint } from '@/lib/pantry-matching';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await getPantry();
  return Response.json(result.ok
    ? { ...result, fingerprint: pantryFingerprint(result.items), checkedAt: Date.now() }
    : result, { headers: { 'Cache-Control': 'private, no-store' } });
}
