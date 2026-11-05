import { isOwnerUser } from '@/lib/access';
import { auth } from '@clerk/nextjs/server';
import { getPantry } from '@/lib/tote';
import { pantryFingerprint } from '@/lib/pantry-matching';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOwnerUser(userId)) return Response.json({ error: 'This connected pantry is private to the cookbook owner.' }, { status: 403 });
  const result = await getPantry(userId);
  return Response.json(result.ok
    ? { ...result, fingerprint: pantryFingerprint(result.items), checkedAt: Date.now() }
    : result, { headers: { 'Cache-Control': 'private, no-store' } });
}
