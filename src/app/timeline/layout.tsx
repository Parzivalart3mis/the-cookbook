import { notFound } from 'next/navigation';
import { FEATURES } from '@/lib/features';

/** Hidden from the UI (see src/lib/features.ts); the page code is kept. */
export default function TimelineLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.timeline) notFound();
  return children;
}
