import { auth } from '@clerk/nextjs/server';
import { cleanCuisine, cleanDiet, fitsDiet, type TrendingResponse } from '@/lib/kitchen-ai';
import { trendingRecipeVideos, youtubeConfigured } from '@/lib/youtube';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cuisine = cleanCuisine(searchParams.get('cuisine'));
  const diet = cleanDiet(searchParams.get('diet'));
  // Search for vegetarian recipes outright; eggs and meat are filtered by title.
  const query = [diet === 'vegetarian' ? 'vegetarian' : '', cuisine, 'recipe'].filter(Boolean).join(' ');
  const keep = diet === 'non-veg' ? undefined : (v: { title: string }) => fitsDiet(v.title, diet);

  const videos = youtubeConfigured() ? await trendingRecipeVideos(9, { query, keep }) : [];
  return Response.json({ videos, youtube: youtubeConfigured() } satisfies TrendingResponse);
}
