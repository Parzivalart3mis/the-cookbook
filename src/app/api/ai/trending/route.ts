import { auth } from '@clerk/nextjs/server';
import type { TrendingResponse } from '@/lib/kitchen-ai';
import { trendingRecipeVideos, youtubeConfigured } from '@/lib/youtube';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const videos = youtubeConfigured() ? await trendingRecipeVideos(9) : [];
  return Response.json({ videos, youtube: youtubeConfigured() } satisfies TrendingResponse);
}
