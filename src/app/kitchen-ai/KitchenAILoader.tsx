'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import { Skeleton } from '@/components/Skeleton';
import type { TabId } from './KitchenAIClient';

/**
 * The AI Kitchen restores your last results and targets from localStorage, so
 * it renders on the client only (no hydration mismatch, no flash of empty state).
 */
const KitchenAIClient = dynamic(() => import('./KitchenAIClient'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-72" />
      <Skeleton className="mb-6 h-11 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  ),
});

export default function KitchenAILoader({ initialTab }: { initialTab: TabId }) {
  const { userId, isLoaded } = useAuth();
  if (!isLoaded || !userId) return <div className="p-10"><Skeleton className="h-24 w-full rounded-xl" /></div>;
  return <KitchenAIClient key={userId} initialTab={initialTab} storageScope={userId} />;
}
