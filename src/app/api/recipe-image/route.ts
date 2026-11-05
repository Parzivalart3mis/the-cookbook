import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { isOwnerUser } from '@/lib/access';
import { getAllRecipes } from '@/lib/notion';
import { isRecipeId, recipeReferenceKeys, stableRecipeId } from '@/lib/recipe-identity';
import { unsplashDownloadUrl, validImageUrl } from '@/lib/image-security';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isOwnerUser(userId)) return Response.json({ error: 'Only the cookbook owner can edit recipe images.' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.pageId !== 'string' || !isRecipeId(body.pageId) || !validImageUrl(body.imageUrl)) {
    return Response.json({ error: 'A valid recipe page ID and HTTPS image URL (or null) are required.' }, { status: 400 });
  }
  const download = body.downloadLocation == null ? null : unsplashDownloadUrl(body.downloadLocation);
  if (body.downloadLocation != null && !download) return Response.json({ error: 'Invalid Unsplash download location.' }, { status: 400 });

  try {
    const recipe = (await getAllRecipes()).find(r => stableRecipeId(r.id) === stableRecipeId(body.pageId));
    if (!recipe) return Response.json({ error: 'Recipe is not in this cookbook.' }, { status: 404 });
    const res = await fetch(`https://api.notion.com/v1/pages/${recipe.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
      body: JSON.stringify({ properties: { 'Cover Image': { url: body.imageUrl } } }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });
    if (!res.ok) return Response.json({ error: 'Could not update the Notion Cover Image property. Check the database schema and integration permissions.' }, { status: 502 });

    // Validate the origin/path before adding the key. Never follow redirects.
    if (download && process.env.UNSPLASH_ACCESS_KEY) {
      download.searchParams.set('client_id', process.env.UNSPLASH_ACCESS_KEY);
      try {
        await fetch(download, { redirect: 'error', signal: AbortSignal.timeout(5_000) });
      } catch { console.warn('[recipe-image] Unsplash download tracking failed'); }
    }
    revalidatePath('/');
    revalidatePath('/recipes');
    for (const key of recipeReferenceKeys(recipe.slug)) revalidatePath(`/recipes/${key}`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Could not reach the recipe service. Try again.' }, { status: 502 });
  }
}
