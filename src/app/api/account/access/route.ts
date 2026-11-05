import { auth } from '@clerk/nextjs/server';
import { isOwnerUser } from '@/lib/access';

export async function GET() {
  const { userId } = await auth();
  const owner = isOwnerUser(userId);
  return Response.json({ canEditImages: owner, canUsePantry: owner }, { headers: { 'Cache-Control': 'private, no-store' } });
}
