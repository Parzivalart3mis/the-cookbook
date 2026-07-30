import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import RecipeBrowser from '@/components/RecipeBrowser';

export const revalidate = 60;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  // Signed-out visitors get the landing page; signed-in users go straight to
  // their recipes. Only this route is dynamic — recipe pages stay static.
  const { userId } = await auth();
  if (!userId) redirect('/welcome');

  const { tag } = await searchParams;
  return <RecipeBrowser tag={tag} />;
}
