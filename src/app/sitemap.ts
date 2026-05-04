import type { MetadataRoute } from 'next';
import { getAllRecipes } from '@/lib/notion';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://the-cookbook.vercel.app').replace(/\/$/, '');
  const recipes = await getAllRecipes().catch(() => []);

  return [
    { url: base, lastModified: new Date() },
    ...recipes.map((r) => ({
      url: `${base}/recipes/${r.slug}`,
      lastModified: new Date(),
    })),
  ];
}
