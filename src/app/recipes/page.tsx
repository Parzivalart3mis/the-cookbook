import type { Metadata } from 'next';
import RecipeBrowser from '@/components/RecipeBrowser';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'All Recipes — The Cookbook',
  description: 'Browse the full collection.',
};

/** Public browse route — reachable from the landing page without signing in. */
export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  return <RecipeBrowser tag={tag} />;
}
