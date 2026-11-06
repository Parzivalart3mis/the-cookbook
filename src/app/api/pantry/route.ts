import { auth } from '@clerk/nextjs/server';
import { getPantry, pantryFailureStatus } from '@/lib/tote-server';
import { pantryFingerprint } from '@/lib/pantry-matching';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await getPantry(userId);
  return Response.json(result.ok
    ? { ...result, fingerprint: pantryFingerprint(result.items, result.connectionId), checkedAt: Date.now() }
    : result, { status: result.ok ? 200 : pantryFailureStatus(result.reason), headers: { 'Cache-Control': 'private, no-store' } });
}
