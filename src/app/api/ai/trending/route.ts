import { auth } from '@clerk/nextjs/server';
import { cleanCuisine, type TrendingResponse } from '@/lib/kitchen-ai';
import { trendingRecipeVideos, youtubeConfigured } from '@/lib/youtube';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const cuisine = cleanCuisine(new URL(req.url).searchParams.get('cuisine'));
  const videos = youtubeConfigured() ? await trendingRecipeVideos(9, cuisine) : [];
  return Response.json({ videos, youtube: youtubeConfigured() } satisfies TrendingResponse);
}
